#!/usr/bin/env pwsh
# PowerShell script to build the backend

Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "Building RTT Analyzer Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查虚拟环境是否存在
if (-not (Test-Path ".venv\Scripts\Activate.ps1")) {
    Write-Host "Virtual environment not found. Creating..." -ForegroundColor Yellow
    python -m venv .venv
}

# 激活虚拟环境
Write-Host "Activating virtual environment..." -ForegroundColor Green
& .venv\Scripts\Activate.ps1

# 安装依赖
Write-Host "Installing dependencies..." -ForegroundColor Green
pip install -q pyinstaller pandas numpy fastapi uvicorn pydantic

# 打包后端
Write-Host "Building backend executable..." -ForegroundColor Green
pyinstaller --onefile --name rtt_analyzer_backend rtt_analyzer_backend.py --icon=favicon.ico 

# 复制到 Tauri bin 目录
$tauriBinDir = "rtt_analyzer\src-tauri\bin"
if (-not (Test-Path $tauriBinDir)) {
    New-Item -ItemType Directory -Path $tauriBinDir -Force | Out-Null
}

Write-Host "Copying executable to Tauri bin directory..." -ForegroundColor Green
Copy-Item "dist\rtt_analyzer_backend.exe" "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe" -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Output: dist\rtt_analyzer_backend.exe" -ForegroundColor White
Write-Host "Copied to: $tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe" -ForegroundColor White
Write-Host ""
