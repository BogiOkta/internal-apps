$ErrorActionPreference = "Stop"

$localEnvPath = Join-Path (Split-Path $PSScriptRoot -Parent | Split-Path -Parent) ".env"
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

$required = @(
    "SMOKE_ADMIN_USERNAME",
    "SMOKE_ADMIN_PASSWORD",
    "SMOKE_BASIC_USERNAME",
    "SMOKE_BASIC_PASSWORD",
    "SMOKE_BASIC_DISPLAY_NAME"
)
foreach ($name in $required) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
        throw "Required environment variable $name is not set."
    }
}

$apiBaseUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL.TrimEnd("/") } else { "http://localhost:5000" }

function ConvertFrom-ResponseJson {
    param([object]$Content)

    if ($null -eq $Content) {
        return $null
    }

    $jsonText = if ($Content -is [byte[]]) {
        [System.Text.Encoding]::UTF8.GetString($Content)
    } else {
        [string]$Content
    }

    if ([string]::IsNullOrWhiteSpace($jsonText)) {
        return $null
    }

    $jsonText | ConvertFrom-Json
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [string]$Token,
        [object]$Body
    )
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
    $json = ConvertFrom-ResponseJson $response.Content
    [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $json }
}

function Assert-Status([object]$Response, [int[]]$Expected, [string]$Step) {
    if ($Response.Status -notin $Expected) {
        throw "$Step failed with HTTP $($Response.Status)."
    }
}

function Get-ProblemCode {
    param([object]$Body)

    if ($null -eq $Body) {
        return $null
    }

    $property = $Body.PSObject.Properties["code"]
    if ($null -eq $property -or
        [string]::IsNullOrWhiteSpace([string]$property.Value)) {
        return $null
    }

    [string]$property.Value
}

function Login([string]$Username, [string]$Password) {
    $response = Invoke-Api POST "/api/v1/auth/login" "" @{
        username = $Username
        password = $Password
    }
    Assert-Status $response @(200) "Login"
    $response.Body
}

$admin = $null
$basic = $null
$originalBasicActive = $null
$originalLink = $null
$finalEmployeeId = $null
$primaryFailure = $null
$cleanupFailures = [System.Collections.Generic.List[string]]::new()

try {
    Write-Output "Authenticating configured Administrator."
    $admin = Login $env:SMOKE_ADMIN_USERNAME $env:SMOKE_ADMIN_PASSWORD
    $users = Invoke-Api GET "/api/v1/identity/users" $admin.accessToken $null
    Assert-Status $users @(200) "List users"
    $basic = $users.Body | Where-Object username -EQ $env:SMOKE_BASIC_USERNAME | Select-Object -First 1

    if (-not $basic) {
        Write-Output "Creating configured smoke basic user."
        $created = Invoke-Api POST "/api/v1/identity/users" $admin.accessToken @{
            username = $env:SMOKE_BASIC_USERNAME
            displayName = $env:SMOKE_BASIC_DISPLAY_NAME
            initialPassword = $env:SMOKE_BASIC_PASSWORD
            isActive = $true
        }
        Assert-Status $created @(201) "Create user"
        $basic = $created.Body
    }

    $originalBasicActive = [bool]$basic.isActive
    if (($basic.roles.Count -ne 1) -or ($basic.roles[0] -ne "User")) {
        throw "Smoke basic user does not have exactly the User role."
    }
    if ($basic.PSObject.Properties.Name -match "password|passwordHash|refreshToken") {
        throw "A user response exposed a secret field."
    }

    $duplicate = Invoke-Api POST "/api/v1/identity/users" $admin.accessToken @{
        username = $env:SMOKE_BASIC_USERNAME
        displayName = $env:SMOKE_BASIC_DISPLAY_NAME
        initialPassword = $env:SMOKE_BASIC_PASSWORD
        isActive = $true
    }
    Assert-Status $duplicate @(409) "Duplicate username"

    if (-not $basic.isActive) {
        Assert-Status (Invoke-Api POST "/api/v1/identity/users/$($basic.publicId)/activate" $admin.accessToken $null) @(200) "Activate user"
    }
    $basicSession = Login $env:SMOKE_BASIC_USERNAME $env:SMOKE_BASIC_PASSWORD
    if ($basicSession.user.permissions -contains "identity.users.manage") {
        throw "Smoke basic user received Identity user management permission."
    }
    Assert-Status (Invoke-Api GET "/api/v1/identity/users" $basicSession.accessToken $null) @(403) "Ordinary management denial"
    Assert-Status (Invoke-Api POST "/api/v1/identity/users" "" @{
        username = "not-created"
        displayName = "Not Created"
        initialPassword = $env:SMOKE_BASIC_PASSWORD
        isActive = $true
    }) @(401) "Unauthenticated management denial"

    Assert-Status (Invoke-Api POST "/api/v1/identity/users/$($basic.publicId)/deactivate" $admin.accessToken $null) @(200) "Deactivate user"
    Assert-Status (Invoke-Api POST "/api/v1/identity/users/$($basic.publicId)/deactivate" $admin.accessToken $null) @(200) "Repeated deactivate"
    $inactiveLogin = Invoke-Api POST "/api/v1/auth/login" "" @{
        username = $env:SMOKE_BASIC_USERNAME
        password = $env:SMOKE_BASIC_PASSWORD
    }
    Assert-Status $inactiveLogin @(401) "Inactive login denial"
    Assert-Status (Invoke-Api POST "/api/v1/identity/users/$($basic.publicId)/activate" $admin.accessToken $null) @(200) "Reactivate user"
    Assert-Status (Invoke-Api POST "/api/v1/identity/users/$($basic.publicId)/activate" $admin.accessToken $null) @(200) "Repeated activate"
    $basicSession = Login $env:SMOKE_BASIC_USERNAME $env:SMOKE_BASIC_PASSWORD

    Assert-Status (Invoke-Api GET "/api/v1/organization/user-employee-links" $basicSession.accessToken $null) @(403) "Ordinary link-management denial"
    $links = Invoke-Api GET "/api/v1/organization/user-employee-links" $admin.accessToken $null
    $options = Invoke-Api GET "/api/v1/organization/user-employee-links/options" $admin.accessToken $null
    Assert-Status $links @(200) "List links"
    Assert-Status $options @(200) "Link options"
    $link = $links.Body | Where-Object userPublicId -EQ $basic.publicId | Select-Object -First 1
    $originalLink = $link

    if (-not $link) {
        $linkedEmployeeIds = @($links.Body | ForEach-Object { $_.employee.publicId })
        $employee = $options.Body.employees |
            Where-Object { $_.isActive -and $_.publicId -notin $linkedEmployeeIds } |
            Select-Object -First 1
        if (-not $employee) {
            Write-Output "Link mutation checks skipped: no active unlinked employee is safely available."
            return
        }
        $createdLink = Invoke-Api POST "/api/v1/organization/user-employee-links" $admin.accessToken @{
            userPublicId = $basic.publicId
            employeePublicId = $employee.publicId
        }
        Assert-Status $createdLink @(201) "Create link"
        $link = $createdLink.Body
    }

    $finalEmployeeId = $link.employee.publicId
    $finalEmployee = $options.Body.employees |
        Where-Object publicId -EQ $finalEmployeeId | Select-Object -First 1
    $duplicateUser = Invoke-Api POST "/api/v1/organization/user-employee-links" $admin.accessToken @{
        userPublicId = $basic.publicId
        employeePublicId = $finalEmployeeId
    }
    Assert-Status $duplicateUser @(409) "Duplicate user link"

    $linkedUserIds = @($links.Body | ForEach-Object { $_.userPublicId })
    $secondUser = $options.Body.users |
        Where-Object { $_.isActive -and $_.publicId -ne $basic.publicId -and $_.publicId -notin $linkedUserIds } |
        Select-Object -First 1
    if ($secondUser) {
        $duplicateEmployee = Invoke-Api POST "/api/v1/organization/user-employee-links" $admin.accessToken @{
            userPublicId = $secondUser.publicId
            employeePublicId = $finalEmployeeId
        }
        Assert-Status $duplicateEmployee @(409) "Duplicate employee link"
    } else {
        Write-Output "Duplicate employee-link check skipped: no second active unlinked user is available."
    }

    $me = Invoke-Api GET "/api/v1/me/employee" $basicSession.accessToken $null
    Assert-Status $me @(200) "Current employee"
    if ($me.Body.publicId -ne $finalEmployeeId) {
        throw "Current employee did not match the explicit link."
    }

    if (-not $finalEmployee -or -not $finalEmployee.isActive) {
        Write-Output "Unlink/relink checks skipped: the existing employee link is inactive and cannot be safely restored."
    } else {
        Assert-Status (Invoke-Api POST "/api/v1/organization/user-employee-links/$($link.publicId)/unlink" $admin.accessToken $null) @(200) "Unlink"
        $unlinked = Invoke-Api GET "/api/v1/me/employee" $basicSession.accessToken $null
        Assert-Status $unlinked @(404) "Unlinked current employee"
        $problemCode = Get-ProblemCode $unlinked.Body
        if ($problemCode -ne "current_user_employee_not_linked") {
            $actual = if ($problemCode) { $problemCode } else { "<missing>" }
            throw "Unlinked response used unexpected problem code: $actual."
        }
        $relinked = Invoke-Api POST "/api/v1/organization/user-employee-links" $admin.accessToken @{
            userPublicId = $basic.publicId
            employeePublicId = $finalEmployeeId
        }
        Assert-Status $relinked @(201) "Relink"
    }

    Write-Output "Audit verification requires an approved read-only audit query and is intentionally not performed by this API-only script."
    Write-Output "Sprint 04B/04C controlled smoke checks passed. The configured basic user is active and linked."
}
catch {
    $primaryFailure = $_
}
finally {
    if ($admin -and $basic) {
        try {
            $currentUsers = Invoke-Api GET "/api/v1/identity/users" $admin.accessToken $null
            Assert-Status $currentUsers @(200) "Cleanup list users"
            $currentBasic = $currentUsers.Body |
                Where-Object username -EQ $env:SMOKE_BASIC_USERNAME | Select-Object -First 1
            if ($currentBasic -and -not $currentBasic.isActive) {
                Assert-Status (Invoke-Api POST "/api/v1/identity/users/$($basic.publicId)/activate" $admin.accessToken $null) @(200) "Cleanup activate user"
            }
        } catch {
            $cleanupFailures.Add("Could not restore the configured basic user to active state: $($_.Exception.Message)")
        }

        if ($finalEmployeeId) {
            try {
                $currentLinks = Invoke-Api GET "/api/v1/organization/user-employee-links" $admin.accessToken $null
                Assert-Status $currentLinks @(200) "Cleanup list links"
                $currentLink = $currentLinks.Body |
                    Where-Object userPublicId -EQ $basic.publicId | Select-Object -First 1
                if (-not $currentLink) {
                    $cleanupOptions = Invoke-Api GET "/api/v1/organization/user-employee-links/options" $admin.accessToken $null
                    Assert-Status $cleanupOptions @(200) "Cleanup link options"
                    $safeEmployee = $cleanupOptions.Body.employees |
                        Where-Object { $_.publicId -eq $finalEmployeeId -and $_.isActive } |
                        Select-Object -First 1
                    if ($safeEmployee) {
                        Assert-Status (Invoke-Api POST "/api/v1/organization/user-employee-links" $admin.accessToken @{
                            userPublicId = $basic.publicId
                            employeePublicId = $finalEmployeeId
                        }) @(201) "Cleanup relink"
                    } else {
                        $cleanupFailures.Add("The original employee is not active; the link was not recreated.")
                    }
                }
            } catch {
                $cleanupFailures.Add("Could not restore the configured basic-user link: $($_.Exception.Message)")
            }
        }
    }
}

foreach ($cleanupFailure in $cleanupFailures) {
    Write-Warning "Smoke cleanup: $cleanupFailure"
}
if ($primaryFailure) { throw $primaryFailure }
if ($cleanupFailures.Count -gt 0) {
    throw "Smoke checks completed but one or more cleanup operations failed."
}
