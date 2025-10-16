#!/usr/bin/env pwsh
# 完整打包流程脚本

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  RTT Analyzer - 完整打包流程" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 步骤 1: 打包后端
Write-Host "[1/3] 打包后端..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

# 检查虚拟环境是否存在
if (-not (Test-Path ".venv\Scripts\Activate.ps1")) {
    Write-Host "虚拟环境不存在，正在创建..." -ForegroundColor Yellow
    python -m venv .venv
}

# 激活虚拟环境
Write-Host "激活虚拟环境..." -ForegroundColor Green
& .venv\Scripts\Activate.ps1

# 安装依赖
Write-Host "安装后端依赖..." -ForegroundColor Green
pip install -q pyinstaller pandas numpy fastapi uvicorn pydantic

# 打包后端
Write-Host "使用 PyInstaller 打包后端..." -ForegroundColor Green
pyinstaller --onefile --name rtt_analyzer_backend rtt_analyzer_backend.py --icon=favicon.ico --clean

# 复制到 Tauri bin 目录
$tauriBinDir = "rtt_analyzer\src-tauri\bin"
if (-not (Test-Path $tauriBinDir)) {
    New-Item -ItemType Directory -Path $tauriBinDir -Force | Out-Null
}

Write-Host "复制到 Tauri bin 目录..." -ForegroundColor Green
Copy-Item "dist\rtt_analyzer_backend.exe" "$tauriBinDir\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe" -Force

Write-Host "✓ 后端打包完成" -ForegroundColor Green
Write-Host ""

# 步骤 2: 进入前端目录并检查依赖
Write-Host "[2/3] 准备前端..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray

Set-Location rtt_analyzer

# 检查 node_modules 是否存在
if (-not (Test-Path "node_modules")) {
    Write-Host "安装前端依赖..." -ForegroundColor Green
    pnpm install
} else {
    Write-Host "前端依赖已安装" -ForegroundColor Green
}

Write-Host "✓ 前端准备完成" -ForegroundColor Green
Write-Host ""

# 步骤 3: 使用 Tauri 打包应用
Write-Host "[3/3] 打包 Tauri 应用..." -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "这可能需要几分钟时间，请耐心等待..." -ForegroundColor Cyan
Write-Host ""

pnpm tauri build

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  打包完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

Write-Host "安装包位置：" -ForegroundColor White
Write-Host "  • MSI: " -NoNewline -ForegroundColor Gray
Write-Host "src-tauri\target\release\bundle\msi\" -ForegroundColor Yellow
Write-Host "  • NSIS: " -NoNewline -ForegroundColor Gray
Write-Host "src-tauri\target\release\bundle\nsis\" -ForegroundColor Yellow
Write-Host ""

# 列出生成的文件
if (Test-Path "src-tauri\target\release\bundle\msi") {
    Write-Host "MSI 安装包：" -ForegroundColor Cyan
    Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  $($_.Name) ($size MB)" -ForegroundColor White
    }
}

if (Test-Path "src-tauri\target\release\bundle\nsis") {
    Write-Host "NSIS 安装包：" -ForegroundColor Cyan
    Get-ChildItem "src-tauri\target\release\bundle\nsis\*.exe" | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Host "  $($_.Name) ($size MB)" -ForegroundColor White
    }
}
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
