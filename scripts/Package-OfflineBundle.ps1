param(
  [string]$OutputDir,
  [switch]$SkipBuild,
  [switch]$Zip
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
[OfflinePack] Docker daemon is not reachable.
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

function Test-DockerImageExists {
  param([string]$Image)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    & docker image inspect $Image 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Assert-DockerImageExists {
  param(
    [string]$Image,
    [string]$Hint
  )

  if (-not (Test-DockerImageExists -Image $Image)) {
    throw "Missing local image: $Image. $Hint"
  }
}

function Ensure-DockerImage {
  param([string]$Image)

  if (Test-DockerImageExists -Image $Image) {
    return
  }

  Write-Host "[OfflinePack] Pulling image: $Image" -ForegroundColor DarkCyan
  Invoke-External -FilePath 'docker' -Arguments @('pull', $Image)
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Require-Command 'docker'
Assert-DockerDaemonReady

if (-not $OutputDir) {
  $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $OutputDir = Join-Path $repoRoot ("offline-bundle\$timestamp")
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$webImageSource = 'openvideo-editor-web'
$webImageOffline = 'openvideo-editor-web:offline'

if (-not $SkipBuild) {
  Write-Host '[OfflinePack] Building web image...' -ForegroundColor Cyan
  Invoke-External -FilePath 'docker' -Arguments @(
    'build',
    '-t', $webImageSource,
    '-f', 'Dockerfile',
    '.'
  )
}

Assert-DockerImageExists -Image $webImageSource -Hint 'Build the web image first, or rerun without -SkipBuild.'

Write-Host '[OfflinePack] Tagging offline image...' -ForegroundColor Cyan
Invoke-External -FilePath 'docker' -Arguments @('tag', $webImageSource, $webImageOffline)

$images = @(
  $webImageOffline,
  'postgres:16-alpine'
)

foreach ($image in $images) {
  if ($image -eq $webImageOffline) {
    Assert-DockerImageExists -Image $image -Hint 'Offline image tag was not created.'
    continue
  }

  Ensure-DockerImage -Image $image
}

$imagesTar = Join-Path $OutputDir 'openvideo-editor-images-offline.tar'
Write-Host "[OfflinePack] Saving images -> $imagesTar" -ForegroundColor Cyan
$saveArguments = @('save', '-o', $imagesTar)
$saveArguments += $images
Invoke-External -FilePath 'docker' -Arguments $saveArguments

if (-not (Test-Path $imagesTar)) {
  throw "Images tar was not generated: $imagesTar"
}

$composeSrc = Join-Path $repoRoot 'docker-compose.offline.yml'
$envExampleSrc = Join-Path $repoRoot '.env.docker.example'
$deployScriptPs1 = Join-Path $PSScriptRoot 'Deploy-OfflineBundle.ps1'
$verifyScriptPs1 = Join-Path $PSScriptRoot 'Verify-OfflineBundle.ps1'
$deployScriptSh = Join-Path $PSScriptRoot 'Deploy-OfflineBundle.sh'
$verifyScriptSh = Join-Path $PSScriptRoot 'Verify-OfflineBundle.sh'

Copy-Item -Path $composeSrc -Destination (Join-Path $OutputDir 'docker-compose.offline.yml') -Force
Copy-Item -Path $envExampleSrc -Destination (Join-Path $OutputDir '.env.example') -Force
Copy-Item -Path $deployScriptPs1 -Destination (Join-Path $OutputDir 'Deploy-OfflineBundle.ps1') -Force
Copy-Item -Path $verifyScriptPs1 -Destination (Join-Path $OutputDir 'Verify-OfflineBundle.ps1') -Force
Copy-Item -Path $deployScriptSh -Destination (Join-Path $OutputDir 'Deploy-OfflineBundle.sh') -Force
Copy-Item -Path $verifyScriptSh -Destination (Join-Path $OutputDir 'Verify-OfflineBundle.sh') -Force

$hash = Get-FileHash -Path $imagesTar -Algorithm SHA256
$hash | Format-List | Out-File -FilePath (Join-Path $OutputDir 'openvideo-editor-images-offline.sha256.txt') -Encoding utf8

$readme = @"
OpenVideo Editor offline delivery bundle

Files:
- openvideo-editor-images-offline.tar
- openvideo-editor-images-offline.sha256.txt
- docker-compose.offline.yml
- .env.example
- Deploy-OfflineBundle.ps1 / .sh
- Verify-OfflineBundle.ps1 / .sh

This bundle deploys only react-video-editor (web + postgres).
AIFilm remains independent and communicates over HTTP.
Postgres is intended for internal container networking only and is not exposed on the host by default.

Windows deploy:
1) Copy this bundle directory to target machine
2) Copy .env.example to .env and update values
3) powershell -ExecutionPolicy Bypass -File .\Deploy-OfflineBundle.ps1
4) powershell -ExecutionPolicy Bypass -File .\Verify-OfflineBundle.ps1

Linux deploy:
1) Copy this bundle directory to target machine
2) cp .env.example .env and update values
3) bash ./Deploy-OfflineBundle.sh
4) bash ./Verify-OfflineBundle.sh
"@
$readme | Out-File -FilePath (Join-Path $OutputDir 'README_OFFLINE.txt') -Encoding utf8

if ($Zip) {
  $zipPath = "$OutputDir.zip"
  if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
  }
  Compress-Archive -Path (Join-Path $OutputDir '*') -DestinationPath $zipPath -Force
  Write-Host "[OfflinePack] Zip created: $zipPath" -ForegroundColor Green
}

Write-Host '[OfflinePack] Done.' -ForegroundColor Green
Write-Host "Bundle dir: $OutputDir" -ForegroundColor Green
Write-Host "Images SHA256: $($hash.Hash)" -ForegroundColor Green
