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

# 打包后端（使用 onedir 模式以提升启动速度）
Write-Host "Building backend executable (onedir mode for faster startup)..." -ForegroundColor Green
pyinstaller rtt_analyzer_backend.spec

# 复制到 Tauri bin 目录
$tauriBinDir = "rtt_analyzer\src-tauri\bin"
if (-not (Test-Path $tauriBinDir)) {
    New-Item -ItemType Directory -Path $tauriBinDir -Force | Out-Null
}

Write-Host "Copying backend to Tauri bin directory..." -ForegroundColor Green

# onedir 模式会生成一个目录，需要复制整个目录
$backendDir = "dist\rtt_analyzer_backend"
if (Test-Path $backendDir) {
    # 清理旧的文件和目录
    if (Test-Path "$tauriBinDir\rtt_analyzer_backend") {
        Remove-Item "$tauriBinDir\rtt_analyzer_backend" -Recurse -Force
    }
    if (Test-Path "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc") {
        Remove-Item "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc" -Recurse -Force
    }
    if (Test-Path "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe") {
        Remove-Item "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe" -Force
    }
    
    # 复制并重命名目录为带架构后缀的名称（Tauri 要求）
    Copy-Item $backendDir "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc" -Recurse -Force
    
    # 重命名主执行文件以匹配 Tauri 的期望
    $originalExe = "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc\rtt_analyzer_backend.exe"
    $renamedExe = "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"
    if (Test-Path $originalExe) {
        Move-Item $originalExe $renamedExe -Force
        Write-Host '✓ Backend executable renamed to match Tauri requirements' -ForegroundColor Green
    }
    
    Write-Host '✓ Backend directory copied to' $tauriBinDir'\rtt_analyzer_backend-x86_64-pc-windows-msvc\' -ForegroundColor Green
} else {
    Write-Host '✗ Backend build failed:' $backendDir 'not found' -ForegroundColor Red
    exit 1
}

# 同时复制到 debug 和 release 目录，用于 Tauri 开发模式
Write-Host "Copying to debug/release directories for dev mode..." -ForegroundColor Green
$projectRoot = Get-Location
$tauriTargetDir = Join-Path $projectRoot "rtt_analyzer\src-tauri\target"

foreach ($buildMode in @("debug", "release")) {
    $targetPath = Join-Path $tauriTargetDir $buildMode
    if (-not (Test-Path $targetPath)) {
        New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
    }
    
    $devBackendDir = Join-Path $targetPath "rtt_analyzer_backend-x86_64-pc-windows-msvc"
    if (Test-Path $devBackendDir) {
        Remove-Item $devBackendDir -Recurse -Force
    }
    
    Copy-Item $backendDir $devBackendDir -Recurse -Force
    
    # 重命名主执行文件
    $devOriginalExe = Join-Path $devBackendDir "rtt_analyzer_backend.exe"
    $devRenamedExe = Join-Path $devBackendDir "rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"
    if (Test-Path $devOriginalExe) {
        Move-Item $devOriginalExe $devRenamedExe -Force
    }
    
    Write-Host "  ✓ Copied to $buildMode directory" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Output: dist\rtt_analyzer_backend\" -ForegroundColor White
Write-Host "Copied to: $tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe" -ForegroundColor White
Write-Host ""
