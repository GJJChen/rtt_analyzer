param(
  [switch]$SkipBackendBuild
)

$ErrorActionPreference = "Stop"

Write-Host "== Bootstrap RTT Analyzer Dev Environment ==" -ForegroundColor Cyan

# Go to repo root (script is inside scripts/)
Set-Location (Join-Path $PSScriptRoot "..")

# 1) Python venv
if (-not (Test-Path ".venv")) {
  Write-Host "Creating Python venv..."
  python -m venv .venv
}
Write-Host "Activating venv..."
. .\.venv\Scripts\Activate.ps1

# 2) Python deps
Write-Host "Installing Python dependencies..."
python -m pip install --upgrade pip
pip install -r requirements.txt

# 3) Backend build (optional)
if (-not $SkipBackendBuild) {
  Write-Host "Building backend exe..."
  pip install pyinstaller
  pyinstaller --onefile --name rtt_analyzer_backend rtt_analyzer_backend.py --icon=favicon.ico
}

# 4) Copy backend exe into Tauri bin (if exists)
$exePath = Join-Path (Get-Location) "dist/rtt_analyzer_backend.exe"
$binPath = Join-Path (Get-Location) "rtt_analyzer/src-tauri/bin/rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"
if (Test-Path $exePath) {
  New-Item -ItemType Directory -Force -Path (Split-Path $binPath) | Out-Null
  Copy-Item -Path $exePath -Destination $binPath -Force
  Write-Host "Copied backend to $binPath" -ForegroundColor Green
} else {
  Write-Host "Backend exe not found at $exePath (skipping copy)" -ForegroundColor Yellow
}

# 5) Frontend deps
Set-Location "rtt_analyzer"
Write-Host "Installing frontend dependencies via pnpm..."
pnpm install

# 6) Run dev
Write-Host "Starting Tauri dev..."
pnpm tauri dev
