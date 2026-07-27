param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Command = "status"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$internalDirectory = Join-Path $root ".internal"
$statePath = Join-Path $internalDirectory "runner.json"
$logDirectory = Join-Path $internalDirectory "logs"
$portalDirectory = Join-Path $root "apps/portal"
$apiProject = Join-Path $root "apps/api/src/Api/InternalApps.Api.csproj"
$apiDll = Join-Path $root "apps/api/src/Api/bin/Debug/net8.0/InternalApps.Api.dll"

function Get-Port([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($value)) {
        $line = Get-Content (Join-Path $root ".env") |
            Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
            Select-Object -Last 1
        if ($line) { $value = ($line -split "=", 2)[1].Trim().Trim('"').Trim("'") }
    }
    $port = 0
    if (-not [int]::TryParse($value, [ref]$port) -or $port -notin 1..65535) {
        throw "$Name must contain a valid port."
    }
    $port
}

$apiPort = Get-Port "DEV_API_PORT"
$portalPort = Get-Port "DEV_PORTAL_PORT"
$apiUrl = "http://localhost:$apiPort"
$healthUrl = "$apiUrl/health"
$portalUrl = "http://localhost:$portalPort"

function Read-State {
    if (-not (Test-Path $statePath)) { return $null }
    try { Get-Content $statePath -Raw | ConvertFrom-Json }
    catch { return $null }
}

function Remove-State { Remove-Item $statePath -Force -ErrorAction SilentlyContinue }

function Get-OwnedProcess([object]$ProcessState, [string]$ExpectedName) {
    if (-not $ProcessState -or -not $ProcessState.pid -or -not $ProcessState.startedAtUtc) {
        return $null
    }
    $process = Get-Process -Id ([int]$ProcessState.pid) -ErrorAction SilentlyContinue
    if (-not $process -or $process.ProcessName -ne $ExpectedName) { return $null }
    try {
        $storedStart = ([datetime]$ProcessState.startedAtUtc).ToUniversalTime()
        if ($process.StartTime.ToUniversalTime() -ne $storedStart) { return $null }
        return $process
    }
    catch { return $null }
}

function Stop-Tree([object]$ProcessState, [string]$ExpectedName) {
    $process = Get-OwnedProcess $ProcessState $ExpectedName
    if ($process) {
        & taskkill.exe /PID $process.Id /T /F *> $null
    }
}

function Stop-Services([switch]$Quiet) {
    $state = Read-State
    Stop-Tree $state.portal "node"
    Stop-Tree $state.api "dotnet"
    Remove-State
    $occupied = $false
    foreach ($service in @(
        @{ Name = "API"; Port = $apiPort },
        @{ Name = "Portal"; Port = $portalPort }
    )) {
        $listener = Get-NetTCPConnection -LocalPort $service.Port -State Listen `
            -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($listener) {
            $occupied = $true
            Write-Host "$($service.Name): port $($service.Port) is occupied by PID $($listener.OwningProcess)."
        }
    }
    if (-not $Quiet) { Write-Host "API and Portal stopped." }
    return $occupied
}

function Test-Ready([string]$Url) {
    try { return (Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
    catch { return $false }
}

function Wait-Ready([string]$Name, [string]$Url, [int]$ProcessId) {
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if (Test-Ready $Url) { return }
        if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            throw "$Name exited before it was ready."
        }
        Start-Sleep -Milliseconds 500
    }
    throw "$Name did not become ready within 30 seconds."
}

function Start-Services {
    if (Stop-Services -Quiet) { throw "Start failed: a configured port is still occupied." }
    Remove-State
    $apiProcess = $null
    $portalProcess = $null

    try {
        $nextDirectory = Join-Path $portalDirectory ".next"
        if (Test-Path $nextDirectory) {
            try { Remove-Item $nextDirectory -Recurse -Force }
            catch { throw "Portal .next directory could not be removed." }
        }

        New-Item -ItemType Directory $logDirectory -Force | Out-Null
        & dotnet build $apiProject --no-restore
        if ($LASTEXITCODE -ne 0) { throw "API build failed." }

        $apiProcess = Start-Process dotnet -ArgumentList $apiDll -WorkingDirectory $root `
            -Environment @{ ASPNETCORE_ENVIRONMENT = "Development"; ASPNETCORE_URLS = $apiUrl; PORTAL_URL = $portalUrl } `
            -RedirectStandardOutput (Join-Path $logDirectory "api.log") `
            -RedirectStandardError (Join-Path $logDirectory "api.err.log") -PassThru
        Wait-Ready "API" $healthUrl $apiProcess.Id

        $next = Join-Path $portalDirectory "node_modules/next/dist/bin/next"
        if (-not (Test-Path $next)) { throw "Portal dependencies are missing." }
        $portalProcess = Start-Process node -ArgumentList @($next, "dev", "--port", "$portalPort") `
            -WorkingDirectory $portalDirectory `
            -Environment @{ PORT = "$portalPort"; API_BASE_URL = $apiUrl; NEXT_PUBLIC_API_BASE_URL = $apiUrl } `
            -RedirectStandardOutput (Join-Path $logDirectory "portal.log") `
            -RedirectStandardError (Join-Path $logDirectory "portal.err.log") -PassThru
        Wait-Ready "Portal" $portalUrl $portalProcess.Id

        [ordered]@{
            api = [ordered]@{
                pid = $apiProcess.Id
                startedAtUtc = $apiProcess.StartTime.ToUniversalTime().ToString("o")
            }
            portal = [ordered]@{
                pid = $portalProcess.Id
                startedAtUtc = $portalProcess.StartTime.ToUniversalTime().ToString("o")
            }
        } |
            ConvertTo-Json | Set-Content $statePath -Encoding utf8
        Write-Host "API: running - PID $($apiProcess.Id) - $apiUrl"
        Write-Host "Portal: running - PID $($portalProcess.Id) - $portalUrl"
    }
    catch {
        if ($portalProcess) {
            Stop-Tree ([pscustomobject]@{
                pid = $portalProcess.Id
                startedAtUtc = $portalProcess.StartTime.ToUniversalTime().ToString("o")
            }) "node"
        }
        if ($apiProcess) {
            Stop-Tree ([pscustomobject]@{
                pid = $apiProcess.Id
                startedAtUtc = $apiProcess.StartTime.ToUniversalTime().ToString("o")
            }) "dotnet"
        }
        Remove-State
        throw "Start failed: $($_.Exception.Message)"
    }
}

function Show-Status {
    $state = Read-State
    $ownedProcessCount = 0
    foreach ($service in @(
        @{ Name = "API"; Process = $state.api; ExpectedName = "dotnet"; Probe = $healthUrl; Url = $apiUrl },
        @{ Name = "Portal"; Process = $state.portal; ExpectedName = "node"; Probe = $portalUrl; Url = $portalUrl }
    )) {
        $process = Get-OwnedProcess $service.Process $service.ExpectedName
        if ($process -and (Test-Ready $service.Probe)) {
            $ownedProcessCount++
            Write-Host "$($service.Name): running - PID $($process.Id) - $($service.Url)"
        } else {
            Write-Host "$($service.Name): stopped"
        }
    }
    if ($state -and $ownedProcessCount -eq 0) { Remove-State }
}

switch ($Command) {
    "start" { Start-Services }
    "restart" { Start-Services }
    "stop" { Stop-Services | Out-Null }
    "status" { Show-Status }
}
