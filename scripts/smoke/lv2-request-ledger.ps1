[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://localhost:5100",
    [switch]$SkipCancellation
)

$ErrorActionPreference = "Stop"

# Mirror the documented local configuration precedence without writing or displaying secrets.
Get-Content (Join-Path $PSScriptRoot "..\\..\\.env") | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$' -and -not [Environment]::GetEnvironmentVariable($matches[1].Trim())) {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
    }
}

foreach ($name in "SMOKE_ADMIN_USERNAME", "SMOKE_ADMIN_PASSWORD", "SMOKE_BASIC_USERNAME", "SMOKE_BASIC_PASSWORD", "APP_DB_USER", "APP_DB_PASSWORD", "DB_HOST", "DB_PORT", "DB_NAME", "DB_SSL_MODE", "DB_TRUST_SERVER_CERTIFICATE") {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "Missing required smoke environment setting: $name"
    }
}

$prefix = "LV2SMOKE-$((Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss'))"
$year = (Get-Date).Year
$suffix = $prefix.Replace('-', '').ToLowerInvariant()
$result = [ordered]@{ Prefix = $prefix; Year = $year; Retained = [ordered]@{}; Checks = @() }

function Invoke-Api($method, $path, $token, $body = $null, $language = "en") {
    $headers = @{ Authorization = "Bearer $token"; "Accept-Language" = $language }
    $parameters = @{ Uri = "$ApiBaseUrl$path"; Method = $method; Headers = $headers; SkipHttpErrorCheck = $true }
    if ($null -ne $body) { $parameters.ContentType = "application/json"; $parameters.Body = ($body | ConvertTo-Json -Depth 8 -Compress) }
    $response = Invoke-WebRequest @parameters
    $content = if ($response.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($response.Content) } else { $response.Content }
    $parsed = if ($content) { $content | ConvertFrom-Json } else { $null }
    [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Login($username, $password) {
    $response = Invoke-WebRequest -Uri "$ApiBaseUrl/api/v1/auth/login" -Method Post -ContentType "application/json" -Body (@{ username = $username; password = $password } | ConvertTo-Json -Compress)
    ($response.Content | ConvertFrom-Json).accessToken
}

function Invoke-DbScalar([string]$sql, [hashtable]$parameters) {
    $connection = [Npgsql.NpgsqlConnection]::new($builder.ConnectionString); $connection.Open()
    try {
        $command = $connection.CreateCommand(); $command.CommandText = $sql
        foreach ($key in $parameters.Keys) { [void]$command.Parameters.AddWithValue($key, $parameters[$key]) }
        try { $command.ExecuteScalar() } finally { $command.Dispose() }
    } finally { $connection.Dispose() }
}

$adminToken = Login $env:SMOKE_ADMIN_USERNAME $env:SMOKE_ADMIN_PASSWORD
$userToken = Login $env:SMOKE_BASIC_USERNAME $env:SMOKE_BASIC_PASSWORD
$employee = Invoke-Api Get "/api/v1/me/employee" $userToken
if ($employee.Status -ne 200 -or $employee.Body.employmentStatus -ne "ACTIVE") { throw "Configured authenticated smoke user is not linked to an active employee." }
$result.Retained.SmokeUser = $env:SMOKE_BASIC_USERNAME
$result.Retained.EmployeeId = $employee.Body.publicId

function New-LeaveType($code, $label) {
    $response = Invoke-Api Post "/api/v1/vacation/leave-types" $adminToken @{ code = $code; nameSr = "$prefix $label"; nameEn = "$prefix $label"; countsAgainstVacationBalance = $true; requiresBalance = $true; requiresApproval = $true; isActive = $true; displayOrder = 999 }
    if ($response.Status -ne 201) { throw "Leave Type creation failed: $($response.Status) $($response.Body | ConvertTo-Json -Compress)" }
    $response.Body
}

$codeSuffix = $suffix.ToUpperInvariant()
$sufficientType = New-LeaveType "LV2_$codeSuffix`_S" "sufficient"
$insufficientType = New-LeaveType "LV2_$codeSuffix`_I" "insufficient"
$nonBalanceType = Invoke-Api Post "/api/v1/vacation/leave-types" $adminToken @{ code = "LV2_$codeSuffix`_N"; nameSr = "$prefix non-balance"; nameEn = "$prefix non-balance"; countsAgainstVacationBalance = $false; requiresBalance = $false; requiresApproval = $true; isActive = $true; displayOrder = 999 }
if ($nonBalanceType.Status -ne 201) { throw "Non-balance Leave Type creation failed." }
$result.Retained.SufficientLeaveTypeId = $sufficientType.publicId
$result.Retained.InsufficientLeaveTypeId = $insufficientType.publicId
$result.Retained.NonBalanceLeaveTypeId = $nonBalanceType.Body.publicId

# The existing runtime role has the documented INSERT-only legacy-balance grant.
Add-Type -Path (Resolve-Path "tools/migrator/bin/Debug/net8.0/Npgsql.dll")
$builder = [Npgsql.NpgsqlConnectionStringBuilder]::new()
$builder.Host = $env:DB_HOST; $builder.Port = [int]$env:DB_PORT; $builder.Database = $env:DB_NAME
$builder.Username = $env:APP_DB_USER; $builder.Password = $env:APP_DB_PASSWORD
$builder.SslMode = [System.Enum]::Parse([Npgsql.SslMode], $env:DB_SSL_MODE, $true)
$builder.TrustServerCertificate = [bool]::Parse($env:DB_TRUST_SERVER_CERTIFICATE)
$connection = [Npgsql.NpgsqlConnection]::new($builder.ConnectionString); $connection.Open()
try {
    foreach ($typeId in @($sufficientType.publicId, $insufficientType.publicId)) {
        $command = $connection.CreateCommand()
        $command.CommandText = "INSERT INTO vacation.leave_balances (employee_id, leave_type_id, year, entitlement_days, carry_over_days, adjustment_days, used_days) SELECT e.id, l.id, @year, 20, 0, 0, 0 FROM organization.employees e CROSS JOIN vacation.leave_types l WHERE e.public_id = @employee AND l.public_id = @type RETURNING public_id;"
        [void]$command.Parameters.AddWithValue("year", $year); [void]$command.Parameters.AddWithValue("employee", [guid]$employee.Body.publicId); [void]$command.Parameters.AddWithValue("type", [guid]$typeId)
        $balanceId = $command.ExecuteScalar(); $command.Dispose()
        if ($typeId -eq $sufficientType.publicId) { $result.Retained.SufficientLegacyBalanceId = $balanceId } else { $result.Retained.InsufficientLegacyBalanceId = $balanceId }
    }
} finally { $connection.Dispose() }

$credit = Invoke-Api Post "/api/v1/vacation/leave-balances/entitlements" $adminToken @{ employeeId = $employee.Body.publicId; leaveTypeId = $sufficientType.publicId; leaveYear = $year; quantityDays = 10; effectiveDate = "$year-01-01"; reason = "smoke_fixture_credit"; explanation = $prefix; sourceReference = "$prefix-CREDIT" }
if ($credit.Status -ne 201) { throw "Sufficient ledger credit failed: $($credit.Status) $($credit.Body | ConvertTo-Json -Compress)" }
$result.Retained.CreditEntryId = $credit.Body.publicId

$existingRequests = (Invoke-Api Get "/api/v1/vacation/me/requests" $userToken).Body
$smokeDates = [System.Collections.Generic.List[string]]::new()
foreach ($day in 1..31) {
    $candidate = [datetime]::new($year, 12, $day)
    if ($candidate.DayOfWeek -in @([DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) { continue }
    if (@($existingRequests | Where-Object { $_.status -in @("SUBMITTED", "APPROVED") -and $_.dateFrom -le $candidate.ToString("yyyy-MM-dd") -and $_.dateTo -ge $candidate.ToString("yyyy-MM-dd") }).Count -gt 0) { continue }
    $workingCandidate = Invoke-Api Get "/api/v1/business-calendar/working-days?from=$($candidate.ToString("yyyy-MM-dd"))&to=$($candidate.ToString("yyyy-MM-dd"))" $userToken
    if ($workingCandidate.Status -eq 200 -and $workingCandidate.Body.workingDays -eq 1) { $smokeDates.Add($candidate.ToString("yyyy-MM-dd")) }
    if ($smokeDates.Count -eq 3) { break }
}
if ($smokeDates.Count -lt 3) { throw "No three unblocked one-day working dates are available in December for the smoke fixture." }
$dateOne = $smokeDates[0]; $dateTwo = $smokeDates[1]; $dateThree = $smokeDates[2]
$working = Invoke-Api Get "/api/v1/business-calendar/working-days?from=$dateOne&to=$dateOne" $userToken
if ($working.Status -ne 200 -or $working.Body.workingDays -ne 1) { throw "The documented smoke date does not have exactly one stored working day." }

function New-Request($typeId, $tag, $date = $dateOne) {
    $response = Invoke-Api Post "/api/v1/vacation/me/requests" $userToken @{ leaveTypeId = $typeId; dateFrom = $date; dateTo = $date; note = "$prefix $tag" }
    if ($response.Status -ne 201) { throw "Request creation failed: $($response.Status)" }; $response.Body
}

$approvedRequest = New-Request $sufficientType.publicId "approval"
$result.Retained.ApprovedRequestId = $approvedRequest.publicId
$approval = Invoke-Api Post "/api/v1/vacation/requests/$($approvedRequest.publicId)/approve" $adminToken @{ comment = "$prefix approve" }
if ($approval.Status -ne 200 -or $approval.Body.status -ne "APPROVED") { throw "Sufficient approval failed: $($approval.Status) $($approval.Body | ConvertTo-Json -Compress)" }
$historyAfterApproval = Invoke-Api Get "/api/v1/vacation/requests/$($approvedRequest.publicId)/history" $adminToken
if ($historyAfterApproval.Status -ne 200 -or @($historyAfterApproval.Body | Where-Object { $_.newStatus -eq "APPROVED" }).Count -ne 1) { throw "Approval history was not appended exactly once." }
$ledgerAfterApproval = Invoke-Api Get "/api/v1/vacation/leave-balances/history?employeeId=$($employee.Body.publicId)&leaveTypeId=$($sufficientType.publicId)&year=$year" $adminToken
$consumption = @($ledgerAfterApproval.Body | Where-Object { $_.entryKind -eq "request_consumption" })
if ($consumption.Count -ne 1) { throw "Expected exactly one request consumption." }
$consumptionLink = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_balance_entries e JOIN vacation.leave_requests r ON r.id=e.leave_request_id WHERE r.public_id=@request AND e.entry_kind='request_consumption' AND e.source_reference=r.id::text" @{ request = [guid]$approvedRequest.publicId }
if ($consumptionLink -ne 1) { throw "Request consumption linkage or source reference did not match migration 020." }
$result.Retained.ConsumptionEntryId = $consumption[0].publicId

if (-not $SkipCancellation) {
    $cancellation = Invoke-Api Post "/api/v1/vacation/requests/$($approvedRequest.publicId)/cancel" $adminToken @{ comment = "$prefix cancel" }
    if ($cancellation.Status -ne 200 -or $cancellation.Body.status -ne "CANCELLED") { throw "Approved cancellation failed." }
    $historyAfterCancel = Invoke-Api Get "/api/v1/vacation/requests/$($approvedRequest.publicId)/history" $adminToken
    if ($historyAfterCancel.Status -ne 200 -or @($historyAfterCancel.Body | Where-Object { $_.newStatus -eq "CANCELLED" }).Count -ne 1) { throw "Cancellation history was not appended exactly once." }
    $ledgerAfterCancel = Invoke-Api Get "/api/v1/vacation/leave-balances/history?employeeId=$($employee.Body.publicId)&leaveTypeId=$($sufficientType.publicId)&year=$year" $adminToken
    $reversal = @($ledgerAfterCancel.Body | Where-Object { $_.entryKind -eq "cancellation_reversal" })
    if ($reversal.Count -ne 1) { throw "Expected exactly one cancellation reversal." }
    $reversalLink = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_balance_entries reversal JOIN vacation.leave_requests r ON r.id=reversal.leave_request_id JOIN vacation.leave_balance_entries consumption ON consumption.id=reversal.reverses_entry_id WHERE r.public_id=@request AND reversal.entry_kind='cancellation_reversal' AND reversal.source_reference=r.id::text AND consumption.entry_kind='request_consumption' AND consumption.leave_request_id=r.id AND reversal.quantity_days=-consumption.quantity_days" @{ request = [guid]$approvedRequest.publicId }
    if ($reversalLink -ne 1) { throw "Cancellation reversal linkage did not match migration 020." }
    $duplicateCancellation = Invoke-Api Post "/api/v1/vacation/requests/$($approvedRequest.publicId)/cancel" $adminToken @{ comment = "$prefix duplicate cancel" }
    if ($duplicateCancellation.Status -ne 409) { throw "Duplicate cancellation did not return conflict." }
    $reversalAfterDuplicate = Invoke-DbScalar "SELECT count(*) FROM vacation.leave_balance_entries reversal JOIN vacation.leave_requests r ON r.id=reversal.leave_request_id WHERE r.public_id=@request AND reversal.entry_kind='cancellation_reversal'" @{ request = [guid]$approvedRequest.publicId }
    if ($reversalAfterDuplicate -ne 1) { throw "Duplicate cancellation created another reversal." }
    $result.Retained.ReversalEntryId = $reversal[0].publicId
}

$insufficientRequest = New-Request $insufficientType.publicId "insufficient" $(if ($SkipCancellation) { $dateTwo } else { $dateOne })
$result.Retained.InsufficientRequestId = $insufficientRequest.publicId
$dbScope = @{ employee = [guid]$employee.Body.publicId; type = [guid]$insufficientType.publicId; year = $year; request = [guid]$insufficientRequest.publicId }
$before = @{ request = (Invoke-Api Get "/api/v1/vacation/requests/$($insufficientRequest.publicId)" $adminToken).Body; history = (Invoke-Api Get "/api/v1/vacation/requests/$($insufficientRequest.publicId)/history" $adminToken).Body; ledger = (Invoke-Api Get "/api/v1/vacation/leave-balances/history?employeeId=$($employee.Body.publicId)&leaveTypeId=$($insufficientType.publicId)&year=$year" $adminToken).Body; used = Invoke-DbScalar "SELECT b.used_days FROM vacation.leave_balances b JOIN organization.employees e ON e.id=b.employee_id JOIN vacation.leave_types l ON l.id=b.leave_type_id WHERE e.public_id=@employee AND l.public_id=@type AND b.year=@year" $dbScope }
$insufficient = Invoke-Api Post "/api/v1/vacation/requests/$($insufficientRequest.publicId)/approve" $adminToken @{ comment = "$prefix insufficient" }
if ($insufficient.Status -ne 409 -or $insufficient.Body.code -ne "vacation_balance_insufficient") { throw "Expected vacation_balance_insufficient." }
$after = @{ request = (Invoke-Api Get "/api/v1/vacation/requests/$($insufficientRequest.publicId)" $adminToken).Body; history = (Invoke-Api Get "/api/v1/vacation/requests/$($insufficientRequest.publicId)/history" $adminToken).Body; ledger = (Invoke-Api Get "/api/v1/vacation/leave-balances/history?employeeId=$($employee.Body.publicId)&leaveTypeId=$($insufficientType.publicId)&year=$year" $adminToken).Body; used = Invoke-DbScalar "SELECT b.used_days FROM vacation.leave_balances b JOIN organization.employees e ON e.id=b.employee_id JOIN vacation.leave_types l ON l.id=b.leave_type_id WHERE e.public_id=@employee AND l.public_id=@type AND b.year=@year" $dbScope }
if ($after.request.status -ne "SUBMITTED" -or ($after.history | ConvertTo-Json -Compress) -ne ($before.history | ConvertTo-Json -Compress) -or ($after.ledger | ConvertTo-Json -Compress) -ne ($before.ledger | ConvertTo-Json -Compress) -or $after.used -ne $before.used) { throw "Insufficient approval was not fully rolled back." }

$duplicateApprove = Invoke-Api Post "/api/v1/vacation/requests/$($approvedRequest.publicId)/approve" $adminToken @{ comment = "$prefix duplicate" }
if ($duplicateApprove.Status -ne 409) { throw "Duplicate transition did not return conflict." }
$nonBalanceRequest = New-Request $nonBalanceType.Body.publicId "non-balance" $(if ($SkipCancellation) { $dateThree } else { $dateTwo })
$result.Retained.NonBalanceRequestId = $nonBalanceRequest.publicId
$nonBalanceApproval = Invoke-Api Post "/api/v1/vacation/requests/$($nonBalanceRequest.publicId)/approve" $adminToken @{ comment = "$prefix non-balance approve" }
if ($nonBalanceApproval.Status -ne 200) { throw "Non-balance approval failed." }
$nonBalanceLedger = Invoke-Api Get "/api/v1/vacation/leave-balances/history?employeeId=$($employee.Body.publicId)&leaveTypeId=$($nonBalanceType.Body.publicId)&year=$year" $adminToken
if ($nonBalanceLedger.Status -ne 200 -or @($nonBalanceLedger.Body).Count -ne 0) { throw "Non-balance approval unexpectedly created ledger history." }
$result.Checks += "authenticated linked active employee; active balance-consuming types; two legacy balances; sufficient credit"
$result.Checks += if ($SkipCancellation) { "known stored one working day; approval/consumption exactly once; cancellation intentionally skipped" } else { "known stored one working day; approval/consumption and cancellation/reversal exactly once; duplicate cancellation conflict" }
$result.Checks += "insufficient ledger approval 409 with request, history, and ledger unchanged; duplicate transition conflict"
$result.Checks += "non-balance approval created no ledger entry"
$result | ConvertTo-Json -Depth 8
