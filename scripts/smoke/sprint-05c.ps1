$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$localEnvPath = Join-Path $repositoryRoot ".env"
if (Test-Path -LiteralPath $localEnvPath) {
    Get-Content -LiteralPath $localEnvPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $name = $matches[1].Trim()
            if (-not [Environment]::GetEnvironmentVariable($name)) {
                [Environment]::SetEnvironmentVariable($name, $matches[2].Trim())
            }
        }
    }
}

foreach ($name in @(
    "SMOKE_ADMIN_USERNAME", "SMOKE_ADMIN_PASSWORD",
    "SMOKE_BASIC_USERNAME", "SMOKE_BASIC_PASSWORD",
    "SMOKE_VACATION_DATE_FROM", "SMOKE_VACATION_DATE_TO"
)) {
    if ([string]::IsNullOrWhiteSpace(
        [Environment]::GetEnvironmentVariable($name))) {
        throw "Required environment variable $name is not set."
    }
}

$apiBaseUrl = if ($env:API_BASE_URL) {
    $env:API_BASE_URL.TrimEnd("/")
} else {
    "http://localhost:5000"
}
$createdRequestIds = [System.Collections.Generic.List[string]]::new()
$adminToken = $null
$primaryFailure = $null
$cleanupFailures = [System.Collections.Generic.List[string]]::new()

function ConvertFrom-ResponseJson {
    param([object]$Content)
    if ($null -eq $Content) { return $null }
    $text = if ($Content -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($Content)
    } else {
        [string]$Content
    }
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    $text | ConvertFrom-Json
}

function Invoke-Api {
    param([string]$Method, [string]$Path, [string]$Token, [object]$Body)
    $headers = @{}
    if ($Token) { $headers.Authorization = "Bearer $Token" }
    $arguments = @{
        Uri = "$apiBaseUrl$Path"
        Method = $Method
        Headers = $headers
        SkipHttpErrorCheck = $true
    }
    if ($null -ne $Body) {
        $arguments.ContentType = "application/json"
        $arguments.Body = $Body | ConvertTo-Json -Depth 8 -Compress
    }
    $response = Invoke-WebRequest @arguments
    [pscustomobject]@{
        Status = [int]$response.StatusCode
        Body = ConvertFrom-ResponseJson $response.Content
    }
}

function Assert-Status([object]$Response, [int[]]$Expected, [string]$Step) {
    if ($Response.Status -notin $Expected) {
        throw "$Step failed with HTTP $($Response.Status)."
    }
}

function Assert-ProblemCode(
    [object]$Response, [string]$Expected, [string]$Step) {
    $actual = if ($Response.Body) { [string]$Response.Body.code } else { "" }
    if ($actual -ne $Expected) {
        $display = if ($actual) { $actual } else { "<missing>" }
        throw "$Step returned problem code $display."
    }
    $serialized = $Response.Body | ConvertTo-Json -Depth 8 -Compress
    if ($serialized -match '(?i)postgres|sqlstate|constraint|vacation\.leave_|npgsql') {
        throw "$Step exposed database implementation details."
    }
}

function Login([string]$Username, [string]$Password) {
    $response = Invoke-Api POST "/api/v1/auth/login" "" @{
        username = $Username
        password = $Password
    }
    Assert-Status $response @(200) "Login"
    $response.Body.accessToken
}

function Calculate-Weekdays([datetime]$From, [datetime]$To) {
    $count = 0
    for ($date = $From.Date; $date -le $To.Date; $date = $date.AddDays(1)) {
        if ($date.DayOfWeek -notin @(
            [DayOfWeek]::Saturday, [DayOfWeek]::Sunday)) {
            $count++
        }
    }
    $count
}

function New-Request([string]$Token, [string]$LeaveTypeId,
    [string]$From, [string]$To, [string]$Note) {
    Invoke-Api POST "/api/v1/vacation/me/requests" $Token @{
        leaveTypeId = $LeaveTypeId
        dateFrom = $From
        dateTo = $To
        note = $Note
        employeeId = "00000000-0000-0000-0000-000000000000"
        workingDays = 999
    }
}

try {
    $adminToken = Login $env:SMOKE_ADMIN_USERNAME $env:SMOKE_ADMIN_PASSWORD
    $basicToken = Login $env:SMOKE_BASIC_USERNAME $env:SMOKE_BASIC_PASSWORD

    Assert-Status (Invoke-Api GET "/api/v1/vacation/me/requests" "" $null) `
        @(401) "Unauthenticated self-service denial"
    Assert-Status (Invoke-Api GET "/api/v1/vacation/requests" `
        $basicToken $null) @(403) "Ordinary administrator denial"

    if ($env:SMOKE_UNLINKED_USERNAME -and $env:SMOKE_UNLINKED_PASSWORD) {
        $unlinkedToken = Login $env:SMOKE_UNLINKED_USERNAME `
            $env:SMOKE_UNLINKED_PASSWORD
        $unlinked = Invoke-Api GET "/api/v1/vacation/me/requests" `
            $unlinkedToken $null
        Assert-Status $unlinked @(404) "Unlinked employee denial"
        Assert-ProblemCode $unlinked "current_user_employee_not_linked" `
            "Unlinked employee denial"
    } else {
        Write-Output "Unlinked-user check skipped: safe configured credentials are unavailable."
    }

    $employee = Invoke-Api GET "/api/v1/me/employee" $basicToken $null
    Assert-Status $employee @(200) "Resolve current employee"
    if ($employee.Body.employmentStatus -ne "Active") {
        throw "Configured smoke employee is not active."
    }

    $leaveTypes = Invoke-Api GET "/api/v1/vacation/me/leave-types" `
        $basicToken $null
    $balances = Invoke-Api GET "/api/v1/vacation/me/balances" `
        $basicToken $null
    Assert-Status $leaveTypes @(200) "List active leave types"
    Assert-Status $balances @(200) "List balances"

    $from = [datetime]::ParseExact(
        $env:SMOKE_VACATION_DATE_FROM, "yyyy-MM-dd",
        [Globalization.CultureInfo]::InvariantCulture)
    $to = [datetime]::ParseExact(
        $env:SMOKE_VACATION_DATE_TO, "yyyy-MM-dd",
        [Globalization.CultureInfo]::InvariantCulture)
    $expectedDays = Calculate-Weekdays $from $to
    if ($expectedDays -lt 1 -or $from.Year -ne $to.Year) {
        throw "Configured Vacation smoke dates must be same-year and include a weekday."
    }

    $leaveType = $leaveTypes.Body |
        Where-Object requiresBalance -EQ $true |
        Where-Object {
            $balance = $balances.Body |
                Where-Object leaveTypePublicId -EQ $_.publicId |
                Where-Object year -EQ $from.Year |
                Select-Object -First 1
            $balance -and $balance.availableDays -ge $expectedDays
        } |
        Select-Object -First 1
    if (-not $leaveType) {
        throw "No active balance-backed Leave Type has sufficient configured balance."
    }
    $balanceBefore = $balances.Body |
        Where-Object leaveTypePublicId -EQ $leaveType.publicId |
        Where-Object year -EQ $from.Year |
        Select-Object -First 1
    Write-Output "Balance before smoke: used=$($balanceBefore.usedDays), available=$($balanceBefore.availableDays)."

    $reversed = New-Request $basicToken $leaveType.publicId `
        $to.ToString("yyyy-MM-dd") $from.ToString("yyyy-MM-dd") "SMOKE-05C reversed"
    Assert-Status $reversed @(400) "Reversed dates"
    Assert-ProblemCode $reversed "vacation_request_invalid_date_range" "Reversed dates"

    $crossYear = New-Request $basicToken $leaveType.publicId `
        "$($from.Year)-12-31" "$($from.Year + 1)-01-02" "SMOKE-05C cross-year"
    Assert-Status $crossYear @(400) "Cross-year dates"
    Assert-ProblemCode $crossYear "vacation_request_cross_year_not_allowed" `
        "Cross-year dates"

    $weekend = $from
    while ($weekend.DayOfWeek -ne [DayOfWeek]::Saturday) {
        $weekend = $weekend.AddDays(1)
    }
    $weekendOnly = New-Request $basicToken $leaveType.publicId `
        $weekend.ToString("yyyy-MM-dd") $weekend.AddDays(1).ToString("yyyy-MM-dd") `
        "SMOKE-05C weekend"
    Assert-Status $weekendOnly @(400) "Weekend-only dates"
    Assert-ProblemCode $weekendOnly "vacation_request_no_working_days" `
        "Weekend-only dates"

    $created = New-Request $basicToken $leaveType.publicId `
        $from.ToString("yyyy-MM-dd") $to.ToString("yyyy-MM-dd") "SMOKE-05C approval"
    Assert-Status $created @(201) "Create request"
    $createdRequestIds.Add([string]$created.Body.publicId)
    if ($created.Body.workingDays -ne $expectedDays) {
        throw "Server working-day calculation was unexpected."
    }
    if ($created.Body.employeePublicId -ne $employee.Body.publicId) {
        throw "Server did not enforce the current linked employee."
    }

    $overlap = New-Request $basicToken $leaveType.publicId `
        $from.ToString("yyyy-MM-dd") $to.ToString("yyyy-MM-dd") "SMOKE-05C overlap"
    Assert-Status $overlap @(409) "Overlapping request"
    Assert-ProblemCode $overlap "vacation_request_overlap" "Overlapping request"

    Assert-Status (Invoke-Api GET `
        "/api/v1/vacation/me/requests/$($created.Body.publicId)" `
        $basicToken $null) @(200) "Read own request"
    if ($env:SMOKE_OTHER_LINKED_USERNAME -and
        $env:SMOKE_OTHER_LINKED_PASSWORD) {
        $otherToken = Login $env:SMOKE_OTHER_LINKED_USERNAME `
            $env:SMOKE_OTHER_LINKED_PASSWORD
        $otherRead = Invoke-Api GET `
            "/api/v1/vacation/me/requests/$($created.Body.publicId)" `
            $otherToken $null
        Assert-Status $otherRead @(404) "Other employee request isolation"
        Assert-ProblemCode $otherRead "vacation_request_not_found" `
            "Other employee request isolation"
    } else {
        Write-Output "Other-employee isolation check skipped: safe configured credentials are unavailable."
    }
    Assert-Status (Invoke-Api POST `
        "/api/v1/vacation/requests/$($created.Body.publicId)/approve" `
        $basicToken @{ comment = "not authorized" }) @(403) "Ordinary approval denial"

    $approved = Invoke-Api POST `
        "/api/v1/vacation/requests/$($created.Body.publicId)/approve" `
        $adminToken @{ comment = "SMOKE-05C approved" }
    Assert-Status $approved @(200) "Approve request"
    $repeatApproval = Invoke-Api POST `
        "/api/v1/vacation/requests/$($created.Body.publicId)/approve" `
        $adminToken @{ comment = "repeat" }
    Assert-Status $repeatApproval @(409) "Repeated approval"
    Assert-ProblemCode $repeatApproval "vacation_request_invalid_transition" `
        "Repeated approval"

    $balancesAfterApproval = Invoke-Api GET "/api/v1/vacation/me/balances" `
        $basicToken $null
    $balanceAfterApproval = $balancesAfterApproval.Body |
        Where-Object publicId -EQ $balanceBefore.publicId | Select-Object -First 1
    if ($balanceAfterApproval.usedDays -ne
        ($balanceBefore.usedDays + $expectedDays)) {
        throw "Approval did not consume the expected balance."
    }
    $history = Invoke-Api GET `
        "/api/v1/vacation/requests/$($created.Body.publicId)/history" `
        $adminToken $null
    Assert-Status $history @(200) "Read request history"
    if (($history.Body.newStatus -join ",") -ne "SUBMITTED,APPROVED") {
        throw "Approval history did not contain SUBMITTED and APPROVED."
    }

    $cancelled = Invoke-Api POST `
        "/api/v1/vacation/me/requests/$($created.Body.publicId)/cancel" `
        $basicToken @{ comment = "SMOKE-05C cancelled" }
    Assert-Status $cancelled @(200) "Cancel approved request"
    $balancesAfterCancellation = Invoke-Api GET "/api/v1/vacation/me/balances" `
        $basicToken $null
    $restored = $balancesAfterCancellation.Body |
        Where-Object publicId -EQ $balanceBefore.publicId | Select-Object -First 1
    if ($restored.usedDays -ne $balanceBefore.usedDays) {
        throw "Cancellation did not restore the expected balance."
    }
    $cancelledHistory = Invoke-Api GET `
        "/api/v1/vacation/requests/$($created.Body.publicId)/history" `
        $adminToken $null
    Assert-Status $cancelledHistory @(200) "Read cancellation history"
    if (($cancelledHistory.Body.newStatus -join ",") -ne
        "SUBMITTED,APPROVED,CANCELLED") {
        throw "Cancellation history was incomplete or out of order."
    }

    $replacement = New-Request $basicToken $leaveType.publicId `
        $from.ToString("yyyy-MM-dd") $to.ToString("yyyy-MM-dd") "SMOKE-05C rejection"
    Assert-Status $replacement @(201) "Reuse cancelled period"
    $createdRequestIds.Add([string]$replacement.Body.publicId)
    $rejected = Invoke-Api POST `
        "/api/v1/vacation/requests/$($replacement.Body.publicId)/reject" `
        $adminToken @{ comment = "SMOKE-05C rejected" }
    Assert-Status $rejected @(200) "Reject request"
    $balancesAfterRejection = Invoke-Api GET "/api/v1/vacation/me/balances" `
        $basicToken $null
    $afterRejection = $balancesAfterRejection.Body |
        Where-Object publicId -EQ $balanceBefore.publicId | Select-Object -First 1
    if ($afterRejection.usedDays -ne $balanceBefore.usedDays) {
        throw "Rejection changed the persisted balance."
    }

    $nonBalanceType = $leaveTypes.Body |
        Where-Object requiresBalance -EQ $false | Select-Object -First 1
    if (-not $nonBalanceType) {
        throw "No active non-balance Leave Type is available."
    }
    $nonBalanceRequest = New-Request $basicToken $nonBalanceType.publicId `
        $from.ToString("yyyy-MM-dd") $to.ToString("yyyy-MM-dd") `
        "SMOKE-05C non-balance"
    Assert-Status $nonBalanceRequest @(201) "Create non-balance request"
    $createdRequestIds.Add([string]$nonBalanceRequest.Body.publicId)
    Assert-Status (Invoke-Api POST `
        "/api/v1/vacation/requests/$($nonBalanceRequest.Body.publicId)/approve" `
        $adminToken @{ comment = "SMOKE-05C non-balance approved" }) `
        @(200) "Approve request without balance"
    Assert-Status (Invoke-Api POST `
        "/api/v1/vacation/requests/$($nonBalanceRequest.Body.publicId)/cancel" `
        $adminToken @{ comment = "SMOKE-05C non-balance cleanup" }) `
        @(200) "Cancel non-balance request"

    $unknownRequestId = [guid]::NewGuid().ToString()
    $unknown = Invoke-Api GET "/api/v1/vacation/requests/$unknownRequestId" `
        $adminToken $null
    Assert-Status $unknown @(404) "Unknown request"
    Assert-ProblemCode $unknown "vacation_request_not_found" "Unknown request"

    $finalBalances = Invoke-Api GET "/api/v1/vacation/me/balances" `
        $basicToken $null
    $finalBalance = $finalBalances.Body |
        Where-Object publicId -EQ $balanceBefore.publicId | Select-Object -First 1
    if ($finalBalance.usedDays -ne $balanceBefore.usedDays) {
        throw "Final smoke balance differs from its original value."
    }
    Write-Output "Balance after smoke: used=$($finalBalance.usedDays), available=$($finalBalance.availableDays)."
    Write-Output "Sprint 05C controlled API smoke checks passed."
} catch {
    $primaryFailure = $_
} finally {
    if ($adminToken) {
        foreach ($requestId in $createdRequestIds) {
            try {
                $current = Invoke-Api GET "/api/v1/vacation/requests/$requestId" `
                    $adminToken $null
                if ($current.Status -eq 200 -and
                    $current.Body.status -in @("SUBMITTED", "APPROVED")) {
                    $cleanup = Invoke-Api POST `
                        "/api/v1/vacation/requests/$requestId/cancel" `
                        $adminToken @{ comment = "SMOKE-05C guarded cleanup" }
                    Assert-Status $cleanup @(200) "Cleanup request $requestId"
                }
            } catch {
                $cleanupFailures.Add("Request $requestId cleanup failed: $($_.Exception.Message)")
            }
        }
    }
}

foreach ($failure in $cleanupFailures) {
    Write-Warning $failure
}
if ($primaryFailure) {
    throw $primaryFailure
}
if ($cleanupFailures.Count -gt 0) {
    throw "Smoke assertions passed, but guarded cleanup reported failures."
}
