param(
  [string]$BundleDir = '.'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Command not found: $Name"
  }
}

function Assert-DockerDaemonReady {
  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & docker info 1>$null 2>$null
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -eq 0) {
    return
  }

  $context = ''
  try {
    $context = (& docker context show 2>$null)
  } catch {
    $context = ''
  }
  if (-not $context) {
    $context = 'unknown'
  }

  throw @"
[OfflineDeploy] Docker daemon is not reachable.
Current docker context: $context

Please do:
1) Start Docker Desktop and wait until it is fully running.
2) Ensure Linux engine context:
   docker context use desktop-linux
3) Verify:
   docker info
"@
}

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & $FilePath @Arguments
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    $commandText = (@($FilePath) + $Arguments) -join ' '
    throw "External command failed (exit code $exitCode): $commandText"
  }
}

Require-Command 'docker'
Assert-DockerDaemonReady

$bundlePath = (Resolve-Path $BundleDir).Path
$imagesTar = Join-Path $bundlePath 'openvideo-editor-images-offline.tar'
$composeFile = Join-Path $bundlePath 'docker-compose.offline.yml'
$envExample = Join-Path $bundlePath '.env.example'
$envFile = Join-Path $bundlePath '.env'

if (-not (Test-Path $imagesTar)) {
  throw "Images tar not found: $imagesTar"
}

if (-not (Test-Path $composeFile)) {
  throw "Compose file not found: $composeFile"
}

if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
  Copy-Item -Path $envExample -Destination $envFile -Force
  Write-Host "[OfflineDeploy] .env created from template: $envFile" -ForegroundColor Yellow
}

Set-Location $bundlePath

Write-Host '[OfflineDeploy] Loading docker images...' -ForegroundColor Cyan
Invoke-External -FilePath 'docker' -Arguments @('load', '-i', $imagesTar)

Write-Host '[OfflineDeploy] Starting services...' -ForegroundColor Cyan
Invoke-External -FilePath 'docker' -Arguments @('compose', '-f', $composeFile, 'up', '-d')

Write-Host '[OfflineDeploy] Current status:' -ForegroundColor Cyan
Invoke-External -FilePath 'docker' -Arguments @('compose', '-f', $composeFile, 'ps')

Write-Host '[OfflineDeploy] Done.' -ForegroundColor Green
