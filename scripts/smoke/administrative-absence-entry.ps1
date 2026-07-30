[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:5100",
    [string]$PortalBaseUrl = "http://localhost:3100"
)

$ErrorActionPreference = "Stop"

Get-Content (Join-Path $PSScriptRoot "..\..\.env") | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$' -and -not [Environment]::GetEnvironmentVariable($matches[1].Trim())) {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

foreach ($name in "SMOKE_ADMIN_USERNAME", "SMOKE_ADMIN_PASSWORD", "APP_DB_USER", "APP_DB_PASSWORD", "DB_OWNER_USER", "DB_OWNER_PASSWORD", "DB_HOST", "DB_PORT", "DB_NAME", "DB_SSL_MODE", "DB_TRUST_SERVER_CERTIFICATE") {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "Missing required smoke environment setting: $name"
    }
}

$prefix = "ADMSMOKE-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"
$suffix = $prefix.Replace("-", "").ToUpperInvariant()
$year = (Get-Date).Year
$result = [ordered]@{
    Prefix = $prefix
    ApiBaseUrl = $ApiBaseUrl
    PortalBaseUrl = $PortalBaseUrl
    Checks = [System.Collections.Generic.List[string]]::new()
    Retained = [ordered]@{}
}

function Invoke-Api($method, $path, $token = $null, $body = $null, $language = "en") {
    $headers = @{ "Accept-Language" = $language }
    if ($token) { $headers.Authorization = "Bearer $token" }
    $parameters = @{
        Uri = "$ApiBaseUrl$path"
        Method = $method
        Headers = $headers
        SkipHttpErrorCheck = $true
    }
    if ($null -ne $body) {
        $parameters.ContentType = "application/json"
        $parameters.Body = $body | ConvertTo-Json -Depth 8 -Compress
    }
    $response = Invoke-WebRequest @parameters
    $content = if ($response.Content -is [byte[]]) {
        [Text.Encoding]::UTF8.GetString($response.Content)
    } else {
        $response.Content
    }
    $parsed = if ($content) { $content | ConvertFrom-Json } else { $null }
    [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Login($username, $password) {
    $response = Invoke-WebRequest -Uri "$ApiBaseUrl/api/v1/auth/login" -Method Post `
        -ContentType "application/json" `
        -Body (@{ username = $username; password = $password } | ConvertTo-Json -Compress)
    ($response.Content | ConvertFrom-Json).accessToken
}

Add-Type -Path (Resolve-Path "tools/migrator/bin/Debug/net8.0/Npgsql.dll")
$runtimeBuilder = [Npgsql.NpgsqlConnectionStringBuilder]::new()
$runtimeBuilder.Host = $env:DB_HOST
$runtimeBuilder.Port = [int]$env:DB_PORT
$runtimeBuilder.Database = $env:DB_NAME
$runtimeBuilder.Username = $env:APP_DB_USER
$runtimeBuilder.Password = $env:APP_DB_PASSWORD
$runtimeBuilder.SslMode = [System.Enum]::Parse([Npgsql.SslMode], $env:DB_SSL_MODE, $true)
$runtimeBuilder.TrustServerCertificate = [bool]::Parse($env:DB_TRUST_SERVER_CERTIFICATE)
$ownerBuilder = [Npgsql.NpgsqlConnectionStringBuilder]::new($runtimeBuilder.ConnectionString)
$ownerBuilder.Username = $env:DB_OWNER_USER
$ownerBuilder.Password = $env:DB_OWNER_PASSWORD

function Invoke-DbScalar([string]$sql, [hashtable]$parameters = @{}) {
    $connection = [Npgsql.NpgsqlConnection]::new($ownerBuilder.ConnectionString)
    $connection.Open()
    try {
        $command = $connection.CreateCommand()
        $command.CommandText = $sql
        foreach ($key in $parameters.Keys) {
            [void]$command.Parameters.AddWithValue($key, $parameters[$key])
        }
        try { $command.ExecuteScalar() } finally { $command.Dispose() }
    } finally {
        $connection.Dispose()
    }
}

function Assert-Status($response, [int]$expected, [string]$message) {
    if ($response.Status -ne $expected) {
        throw "$message Expected HTTP $expected, received $($response.Status): $($response.Body | ConvertTo-Json -Depth 8 -Compress)"
    }
}

function New-LeaveType($codeSuffix, $label, [bool]$requiresBalance) {
    $response = Invoke-Api Post "/api/v1/vacation/leave-types" $adminToken @{
        code = "ADM_${suffix}_$codeSuffix"
        nameSr = "$prefix $label"
        nameEn = "$prefix $label"
        countsAgainstVacationBalance = $requiresBalance
        requiresBalance = $requiresBalance
        requiresApproval = $true
        isActive = $true
        displayOrder = 999
    }
    Assert-Status $response 201 "Leave Type creation failed."
    $response.Body
}

function Record-Absence($employeeId, $leaveTypeId, $date, $tag) {
    Invoke-Api Post "/api/v1/vacation/requests/record" $adminToken @{
        employeeId = $employeeId
        leaveTypeId = $leaveTypeId
        dateFrom = $date
        dateTo = $date
        note = "$prefix $tag"
    }
}

$health = Invoke-Api Get "/health"
Assert-Status $health 200 "API health check failed."
if ($health.Body.status -ne "healthy") { throw "API is not healthy." }

$routeProbe = Invoke-Api Post "/api/v1/vacation/requests/record" $null @{}
if ($routeProbe.Status -ne 401) {
    throw "Administrative-record route probe expected HTTP 401, received $($routeProbe.Status)."
}
$result.Checks.Add("fresh API health and authenticated administrative-record route")

$adminToken = Login $env:SMOKE_ADMIN_USERNAME $env:SMOKE_ADMIN_PASSWORD
$departments = Invoke-Api Get "/api/v1/organization/departments?status=active" $adminToken
Assert-Status $departments 200 "Active Department lookup failed."
$department = @($departments.Body)[0]
if (-not $department) { throw "No active Department is available for the dedicated smoke employee." }
$employee = Invoke-Api Post "/api/v1/organization/employees" $adminToken @{
    employeeNumber = $prefix
    firstName = "ADM"
    lastName = "SMOKE"
    email = "$($prefix.ToLowerInvariant())@example.internal"
    departmentPublicId = $department.publicId
    isActive = $true
}
Assert-Status $employee 201 "Dedicated smoke employee creation failed."
$employeeId = $employee.Body.publicId
$result.Retained.EmployeeId = $employeeId

$sufficientType = New-LeaveType "S" "balance" $true
$insufficientType = New-LeaveType "I" "insufficient" $true
$nonBalanceType = New-LeaveType "N" "non-balance" $false
$inactiveType = New-LeaveType "X" "inactive" $false
$deactivated = Invoke-Api Post "/api/v1/vacation/leave-types/$($inactiveType.publicId)/deactivate" $adminToken
Assert-Status $deactivated 200 "Inactive Leave Type setup failed."

$result.Retained.SufficientLeaveTypeId = $sufficientType.publicId
$result.Retained.InsufficientLeaveTypeId = $insufficientType.publicId
$result.Retained.NonBalanceLeaveTypeId = $nonBalanceType.publicId
$result.Retained.InactiveLeaveTypeId = $inactiveType.publicId

$connection = [Npgsql.NpgsqlConnection]::new($runtimeBuilder.ConnectionString)
$connection.Open()
try {
    foreach ($typeId in @($sufficientType.publicId, $insufficientType.publicId)) {
        $command = $connection.CreateCommand()
        $command.CommandText = "INSERT INTO vacation.leave_balances (employee_id, leave_type_id, year, entitlement_days, carry_over_days, adjustment_days, used_days) SELECT e.id, l.id, @year, 20, 0, 0, 0 FROM organization.employees e CROSS JOIN vacation.leave_types l WHERE e.public_id=@employee AND l.public_id=@type RETURNING public_id;"
        [void]$command.Parameters.AddWithValue("year", $year)
        [void]$command.Parameters.AddWithValue("employee", [guid]$employeeId)
        [void]$command.Parameters.AddWithValue("type", [guid]$typeId)
        $balanceId = $command.ExecuteScalar()
        $command.Dispose()
        if ($typeId -eq $sufficientType.publicId) {
            $result.Retained.SufficientLegacyBalanceId = $balanceId
        } else {
            $result.Retained.InsufficientLegacyBalanceId = $balanceId
        }
    }
} finally {
    $connection.Dispose()
}

$credit = Invoke-Api Post "/api/v1/vacation/leave-balances/entitlements" $adminToken @{
    employeeId = $employeeId
    leaveTypeId = $sufficientType.publicId
    leaveYear = $year
    quantityDays = 10
    effectiveDate = "$year-01-01"
    reason = "administrative_absence_smoke_credit"
    explanation = $prefix
    sourceReference = "$prefix-CREDIT"
}
Assert-Status $credit 201 "Sufficient ledger credit failed."
$result.Retained.CreditEntryId = $credit.Body.publicId

$existingRequests = @()
$dates = [System.Collections.Generic.List[string]]::new()
foreach ($day in 1..31) {
    $candidate = [datetime]::new($year, 12, $day)
    if ($candidate.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) { continue }
    $formatted = $candidate.ToString("yyyy-MM-dd")
    if (@($existingRequests | Where-Object {
        $_.status -in @("SUBMITTED", "APPROVED") -and
        $_.dateFrom -le $formatted -and $_.dateTo -ge $formatted
    }).Count -gt 0) { continue }
    $working = Invoke-Api Get "/api/v1/business-calendar/working-days?from=$formatted&to=$formatted" $adminToken
    if ($working.Status -eq 200 -and $working.Body.workingDays -eq 1) {
        $dates.Add($formatted)
    }
    if ($dates.Count -eq 4) { break }
}
if ($dates.Count -lt 4) { throw "Four free one-working-day dates were not available." }

$dateBalance = $dates[0]
$dateInsufficient = $dates[1]
$dateNonBalance = $dates[2]
$dateInactive = $dates[3]
$balanceScope = @{ employee = [guid]$employeeId; type = [guid]$sufficientType.publicId; year = $year }
$usedBefore = Invoke-DbScalar "SELECT used_days FROM vacation.leave_balances b JOIN organization.employees e ON e.id=b.employee_id JOIN vacation.leave_types l ON l.id=b.leave_type_id WHERE e.public_id=@employee AND l.public_id=@type AND b.year=@year" $balanceScope

$recorded = Record-Absence $employeeId $sufficientType.publicId $dateBalance "balance"
Assert-Status $recorded 201 "Balance-consuming administrative recording failed."
if ($recorded.Body.status -ne "APPROVED" -or $recorded.Body.source -ne "ADMINISTRATIVE_ENTRY" -or $recorded.Body.workingDays -ne 1) {
    throw "Recorded request response does not contain APPROVED, ADMINISTRATIVE_ENTRY, and one working day."
}
$recordedId = $recorded.Body.publicId
$result.Retained.BalanceRequestId = $recordedId

$history = Invoke-Api Get "/api/v1/vacation/requests/$recordedId/history" $adminToken
Assert-Status $history 200 "Recorded request history failed."
if (@($history.Body).Count -ne 1 -or $history.Body[0].previousStatus -ne $null -or $history.Body[0].newStatus -ne "APPROVED") {
    throw "Recorded request did not have exactly one null-to-APPROVED history row."
}
$requestScope = @{ request = [guid]$recordedId }
$consumptionCount = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_balance_entries e JOIN vacation.leave_requests r ON r.id=e.leave_request_id WHERE r.public_id=@request AND e.entry_kind='request_consumption'" $requestScope
$auditCount = Invoke-DbScalar "SELECT count(*) FROM audit.audit_events WHERE target_public_id=@request AND action='leave_request_recorded'" $requestScope
$usedAfter = Invoke-DbScalar "SELECT used_days FROM vacation.leave_balances b JOIN organization.employees e ON e.id=b.employee_id JOIN vacation.leave_types l ON l.id=b.leave_type_id WHERE e.public_id=@employee AND l.public_id=@type AND b.year=@year" $balanceScope
if ($consumptionCount -ne 1 -or $auditCount -ne 1 -or $usedAfter -ne ($usedBefore + 1)) {
    throw "Balance request consumption, audit, or used-day delta validation failed."
}

$overlapBefore = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_requests r JOIN organization.employees e ON e.id=r.employee_id WHERE e.public_id=@employee AND r.employee_note=@note" @{ employee = [guid]$employeeId; note = "$prefix overlap" }
$overlap = Record-Absence $employeeId $nonBalanceType.publicId $dateBalance "overlap"
if ($overlap.Status -ne 409 -or $overlap.Body.code -ne "vacation_request_overlap") { throw "Overlap did not return the expected conflict." }
$overlapAfter = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_requests r JOIN organization.employees e ON e.id=r.employee_id WHERE e.public_id=@employee AND r.employee_note=@note" @{ employee = [guid]$employeeId; note = "$prefix overlap" }
if ($overlapAfter -ne $overlapBefore) { throw "Overlap left a partial request." }

$cancel = Invoke-Api Post "/api/v1/vacation/requests/$recordedId/cancel" $adminToken @{ comment = "$prefix cancel" }
Assert-Status $cancel 200 "Administrative cancellation failed."
if ($cancel.Body.status -ne "CANCELLED") { throw "Administrative cancellation did not persist CANCELLED." }
$reversalValid = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_balance_entries reversal JOIN vacation.leave_requests r ON r.id=reversal.leave_request_id JOIN vacation.leave_balance_entries consumption ON consumption.id=reversal.reverses_entry_id WHERE r.public_id=@request AND reversal.entry_kind='cancellation_reversal' AND consumption.entry_kind='request_consumption' AND reversal.quantity_days=-consumption.quantity_days" $requestScope
$usedRestored = Invoke-DbScalar "SELECT used_days FROM vacation.leave_balances b JOIN organization.employees e ON e.id=b.employee_id JOIN vacation.leave_types l ON l.id=b.leave_type_id WHERE e.public_id=@employee AND l.public_id=@type AND b.year=@year" $balanceScope
if ($reversalValid -ne 1 -or $usedRestored -ne $usedBefore) { throw "Cancellation reversal or used-balance restoration failed." }
$duplicateCancel = Invoke-Api Post "/api/v1/vacation/requests/$recordedId/cancel" $adminToken @{ comment = "$prefix duplicate cancel" }
if ($duplicateCancel.Status -ne 409) { throw "Repeated cancellation did not return conflict." }
$reversalAfterDuplicate = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_balance_entries e JOIN vacation.leave_requests r ON r.id=e.leave_request_id WHERE r.public_id=@request AND e.entry_kind='cancellation_reversal'" $requestScope
if ($reversalAfterDuplicate -ne 1) { throw "Repeated cancellation created a duplicate reversal." }
$result.Checks.Add("balance recording, exact consumption, audit, cancellation, exact reversal, duplicate protection")

$nonBalance = Record-Absence $employeeId $nonBalanceType.publicId $dateNonBalance "portal non-balance"
Assert-Status $nonBalance 201 "Non-balance administrative recording failed."
$nonBalanceId = $nonBalance.Body.publicId
$nonBalanceLedger = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_balance_entries e JOIN vacation.leave_requests r ON r.id=e.leave_request_id WHERE r.public_id=@request" @{ request = [guid]$nonBalanceId }
if ($nonBalance.Body.status -ne "APPROVED" -or $nonBalance.Body.source -ne "ADMINISTRATIVE_ENTRY" -or $nonBalanceLedger -ne 0) {
    throw "Non-balance administrative request validation failed."
}
$result.Retained.PortalRequestId = $nonBalanceId
$result.Retained.PortalRequestUrl = "$PortalBaseUrl/vacation/admin/requests/$nonBalanceId"
$result.Checks.Add("non-balance recording without ledger entry")

$insufficientCountsBefore = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_requests r JOIN organization.employees e ON e.id=r.employee_id JOIN vacation.leave_types l ON l.id=r.leave_type_id WHERE e.public_id=@employee AND l.public_id=@type AND r.date_from=@date" @{ employee = [guid]$employeeId; type = [guid]$insufficientType.publicId; date = [datetime]$dateInsufficient }
$insufficient = Record-Absence $employeeId $insufficientType.publicId $dateInsufficient "insufficient"
if ($insufficient.Status -ne 409 -or $insufficient.Body.code -ne "vacation_balance_insufficient") { throw "Insufficient balance did not return expected conflict." }
$insufficientCountsAfter = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_requests r JOIN organization.employees e ON e.id=r.employee_id JOIN vacation.leave_types l ON l.id=r.leave_type_id WHERE e.public_id=@employee AND l.public_id=@type AND r.date_from=@date" @{ employee = [guid]$employeeId; type = [guid]$insufficientType.publicId; date = [datetime]$dateInsufficient }
$insufficientAudit = Invoke-DbScalar "SELECT count(*) FROM audit.audit_events a JOIN vacation.leave_requests r ON r.public_id=a.target_public_id JOIN vacation.leave_types l ON l.id=r.leave_type_id WHERE l.public_id=@type AND r.employee_note=@note" @{ type = [guid]$insufficientType.publicId; note = "$prefix insufficient" }
if ($insufficientCountsAfter -ne $insufficientCountsBefore -or $insufficientAudit -ne 0) { throw "Insufficient balance left partial request or audit data." }
$result.Checks.Add("overlap and insufficient-balance complete rollback")

$inactiveEmployeeId = Invoke-DbScalar "SELECT public_id FROM organization.employees WHERE employment_status='Inactive' ORDER BY id LIMIT 1"
if (-not $inactiveEmployeeId) { throw "No existing inactive employee is available for rejection validation." }
$inactiveEmployee = Record-Absence $inactiveEmployeeId $nonBalanceType.publicId $dateInactive "inactive employee"
if ($inactiveEmployee.Status -ne 409 -or $inactiveEmployee.Body.code -ne "vacation_employee_inactive") { throw "Inactive employee rejection failed." }
$inactiveLeaveType = Record-Absence $employeeId $inactiveType.publicId $dateInactive "inactive leave type"
if ($inactiveLeaveType.Status -ne 409 -or $inactiveLeaveType.Body.code -ne "vacation_leave_type_inactive") { throw "Inactive Leave Type rejection failed." }
$result.Checks.Add("inactive employee and inactive Leave Type rejection")

$filtered = Invoke-Api Get "/api/v1/vacation/requests?source=ADMINISTRATIVE_ENTRY&search=$([uri]::EscapeDataString($employee.Body.employeeNumber))&dateFrom=$year-01-01&dateTo=$year-12-31&page=1&pageSize=100" $adminToken
Assert-Status $filtered 200 "Administrative source filter failed."
$filteredIds = @($filtered.Body.items | ForEach-Object { $_.publicId })
if ($recordedId -notin $filteredIds -or $nonBalanceId -notin $filteredIds -or @($filtered.Body.items | Where-Object { $_.source -ne "ADMINISTRATIVE_ENTRY" }).Count -ne 0) {
    throw "Administrative source filter returned an incorrect result set."
}
$result.Checks.Add("ADMINISTRATIVE_ENTRY source filter")

foreach ($typeId in @($sufficientType.publicId, $insufficientType.publicId, $nonBalanceType.publicId)) {
    $response = Invoke-Api Post "/api/v1/vacation/leave-types/$typeId/deactivate" $adminToken
    Assert-Status $response 200 "Retained Leave Type deactivation failed."
}
$employeeDeactivated = Invoke-Api Post "/api/v1/organization/employees/$employeeId/deactivate" $adminToken
Assert-Status $employeeDeactivated 200 "Retained smoke employee deactivation failed."
$result.Retained.Note = "Ledger/history rows are append-only. Balance request is CANCELLED; Portal request remains APPROVED for browser inspection and must be cancelled afterward. All dedicated Leave Types are inactive."
$result | ConvertTo-Json -Depth 8
