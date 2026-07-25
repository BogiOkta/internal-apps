[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Command
)

$ErrorActionPreference = "Stop"

$repositoryRoot = $PSScriptRoot
$stateDirectory = Join-Path $repositoryRoot ".internal"
$statePath = Join-Path $stateDirectory "runner.json"
$apiUrl = "http://localhost:5000"
$apiHealthUrl = "$apiUrl/health"
$portalUrl = "http://localhost:3000"

function Read-RunnerState {
    if (-not (Test-Path -LiteralPath $statePath)) {
        return $null
    }

    try {
        return Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    }
    catch {
        Write-Warning "Runner state is unreadable and will be treated as stale: $statePath"
        return $null
    }
}

function Write-RunnerState {
    param([object]$State)

    New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
    $State | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $statePath -Encoding utf8
}

function Test-OwnedProcess {
    param([object]$ProcessState)

    if ($null -eq $ProcessState -or $null -eq $ProcessState.pid -or $null -eq $ProcessState.startedAtUtc) {
        return $false
    }

    $process = Get-Process -Id ([int]$ProcessState.pid) -ErrorAction SilentlyContinue
    if ($null -eq $process) {
        return $false
    }

    try {
        $storedStartTime = ([datetime]$ProcessState.startedAtUtc).ToUniversalTime()
        return $process.StartTime.ToUniversalTime() -eq $storedStartTime
    }
    catch {
        return $false
    }
}

function Test-PortInUse {
    param([int]$Port)

    return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Test-HttpEndpoint {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 3 -UseBasicParsing
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    }
    catch {
        return $false
    }
}

function Get-ServiceStatus {
    param(
        [int]$Port,
        [string]$ProbeUrl
    )

    if (Test-HttpEndpoint -Url $ProbeUrl) {
        return "running"
    }

    if (Test-PortInUse -Port $Port) {
        return "port occupied"
    }

    return "stopped"
}

function Show-Status {
    $state = Read-RunnerState
    $apiStatus = Get-ServiceStatus -Port 5000 -ProbeUrl $apiHealthUrl
    $portalStatus = Get-ServiceStatus -Port 3000 -ProbeUrl $portalUrl

    Write-Host "API:    $apiStatus - $apiUrl"
    Write-Host "Portal: $portalStatus - $portalUrl"

    foreach ($serviceName in @("api", "portal")) {
        $processState = if ($null -ne $state) { $state.$serviceName } else { $null }
        if ($null -eq $processState) {
            Write-Host "$($serviceName.ToUpper()) stored PID: none"
        }
        elseif (Test-OwnedProcess -ProcessState $processState) {
            Write-Host "$($serviceName.ToUpper()) stored PID: $($processState.pid) (current)"
        }
        else {
            Write-Host "$($serviceName.ToUpper()) stored PID: $($processState.pid) (stale)"
        }
    }
}

function Start-ServiceWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Body
    )

    $windowScript = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location -LiteralPath '$($WorkingDirectory.Replace("'", "''"))'
$Body
"@
    $encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($windowScript))
    $powerShellPath = (Get-Process -Id $PID).Path
    $process = Start-Process -FilePath $powerShellPath -ArgumentList "-NoExit", "-EncodedCommand", $encodedCommand -PassThru

    return [ordered]@{
        pid = $process.Id
        startedAtUtc = $process.StartTime.ToUniversalTime().ToString("o")
    }
}

function Start-Runner {
    $state = Read-RunnerState
    $newState = [ordered]@{}

    foreach ($service in @(
        [pscustomobject]@{ Name = "api"; Label = "API"; Port = 5000; Probe = $apiHealthUrl },
        [pscustomobject]@{ Name = "portal"; Label = "Portal"; Port = 3000; Probe = $portalUrl }
    )) {
        $status = Get-ServiceStatus -Port $service.Port -ProbeUrl $service.Probe
        if ($status -eq "running") {
            Write-Host "$($service.Label) is already responsive; reusing it."
            if ($null -ne $state -and (Test-OwnedProcess -ProcessState $state.($service.Name))) {
                $newState[$service.Name] = $state.($service.Name)
            }
        }
        elseif ($status -eq "port occupied") {
            throw "$($service.Label) cannot start: port $($service.Port) is occupied by an unknown or unresponsive process."
        }
    }

    if (-not $newState.Contains("api") -and -not (Test-HttpEndpoint -Url $apiHealthUrl)) {
        Write-Host "Starting API in a visible PowerShell window..."
        $newState.api = Start-ServiceWindow `
            -Title "Internal Apps API" `
            -WorkingDirectory $repositoryRoot `
            -Body '$env:PORTAL_URL = "http://localhost:3000"; dotnet run --project apps/api/src/Api/InternalApps.Api.csproj --launch-profile http'
    }

    if (-not $newState.Contains("portal") -and -not (Test-HttpEndpoint -Url $portalUrl)) {
        Write-Host "Starting Portal in a visible PowerShell window..."
        $newState.portal = Start-ServiceWindow `
            -Title "Internal Apps Portal" `
            -WorkingDirectory (Join-Path $repositoryRoot "apps/portal") `
            -Body '$env:NEXT_PUBLIC_API_BASE_URL = "http://localhost:5000"; npm run dev'
    }

    Write-RunnerState -State $newState

    $deadline = (Get-Date).AddSeconds(30)
    do {
        $apiReady = Test-HttpEndpoint -Url $apiHealthUrl
        $portalReady = Test-HttpEndpoint -Url $portalUrl
        if ($apiReady -and $portalReady) {
            break
        }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    Write-Host "API:    $(if ($apiReady) { "ready" } else { "not ready" }) - $apiUrl"
    Write-Host "Portal: $(if ($portalReady) { "ready" } else { "not ready" }) - $portalUrl"

    if (-not ($apiReady -and $portalReady)) {
        throw "One or more services did not become responsive within 30 seconds. Check the visible service windows."
    }
}

function Stop-Runner {
    $state = Read-RunnerState
    if ($null -eq $state) {
        Write-Host "No runner-owned processes are recorded. Nothing to stop."
        return
    }

    foreach ($serviceName in @("portal", "api")) {
        $processState = $state.$serviceName
        if ($null -eq $processState) {
            continue
        }

        if (-not (Test-OwnedProcess -ProcessState $processState)) {
            Write-Host "$($serviceName.ToUpper()) stored PID $($processState.pid) is stale; skipping it."
            continue
        }

        Write-Host "Stopping runner-owned $($serviceName.ToUpper()) process tree (PID $($processState.pid))..."
        & taskkill.exe /PID ([int]$processState.pid) /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Could not stop $($serviceName.ToUpper()) PID $($processState.pid)."
        }
    }

    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    Write-Host "Runner-owned processes stopped."
}

switch ($Command) {
    "start" { Start-Runner }
    "stop" { Stop-Runner }
    "restart" {
        Stop-Runner
        Start-Runner
    }
    "status" { Show-Status }
}
