# RTT Analyzer 发布脚本
# 用于自动化构建和打包中文安装包

param(
    [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RTT Analyzer 发布构建工具" -ForegroundColor Cyan
Write-Host "  版本: $Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查当前目录
Write-Host "[1/8] 检查工作目录..." -ForegroundColor Yellow
$projectRoot = Split-Path -Parent $PSScriptRoot
$rttAnalyzerDir = Join-Path $projectRoot "rtt_analyzer"

if (-not (Test-Path $rttAnalyzerDir)) {
    Write-Host "错误: 找不到 rtt_analyzer 目录" -ForegroundColor Red
    exit 1
}

Set-Location $rttAnalyzerDir
Write-Host "✓ 工作目录: $rttAnalyzerDir" -ForegroundColor Green
Write-Host ""

# 2. 检查必要工具
Write-Host "[2/8] 检查必要工具..." -ForegroundColor Yellow
$hasNode = Get-Command node -ErrorAction SilentlyContinue
$hasPnpm = Get-Command pnpm -ErrorAction SilentlyContinue
$hasRust = Get-Command cargo -ErrorAction SilentlyContinue

if (-not $hasNode) {
    Write-Host "错误: 未安装 Node.js" -ForegroundColor Red
    exit 1
}
if (-not $hasPnpm) {
    Write-Host "错误: 未安装 pnpm" -ForegroundColor Red
    exit 1
}
if (-not $hasRust) {
    Write-Host "错误: 未安装 Rust" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Node.js: $(node --version)" -ForegroundColor Green
Write-Host "✓ pnpm: $(pnpm --version)" -ForegroundColor Green
Write-Host "✓ Rust: $(rustc --version)" -ForegroundColor Green
Write-Host ""

# 3. 检查后端程序
Write-Host "[3/8] 检查后端程序..." -ForegroundColor Yellow
$backendExe = Join-Path $rttAnalyzerDir "src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"

if (-not (Test-Path $backendExe)) {
    Write-Host "错误: 找不到后端程序: $backendExe" -ForegroundColor Red
    Write-Host "请先运行 build_backend.bat 构建后端" -ForegroundColor Yellow
    exit 1
}

$backendSize = (Get-Item $backendExe).Length / 1MB
Write-Host "✓ 后端程序: $([math]::Round($backendSize, 2)) MB" -ForegroundColor Green
Write-Host ""

# 4. 清理旧的构建
Write-Host "[4/8] 清理旧的构建文件..." -ForegroundColor Yellow
$bundleDir = Join-Path $rttAnalyzerDir "src-tauri\target\release\bundle"
if (Test-Path $bundleDir) {
    Remove-Item -Recurse -Force $bundleDir
    Write-Host "✓ 已清理旧的构建文件" -ForegroundColor Green
} else {
    Write-Host "✓ 无需清理" -ForegroundColor Green
}
Write-Host ""

# 5. 安装依赖
Write-Host "[5/8] 检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "安装前端依赖..." -ForegroundColor Yellow
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 安装依赖失败" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✓ 依赖已就绪" -ForegroundColor Green
Write-Host ""

# 6. 构建应用程序
Write-Host "[6/8] 构建 Tauri 应用程序..." -ForegroundColor Yellow
Write-Host "这可能需要几分钟时间，请耐心等待..." -ForegroundColor Cyan
Write-Host ""

pnpm tauri build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "错误: 构建失败" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ 构建完成" -ForegroundColor Green
Write-Host ""

# 7. 检查生成的文件
Write-Host "[7/8] 检查生成的安装包..." -ForegroundColor Yellow

$nsisDir = Join-Path $rttAnalyzerDir "src-tauri\target\release\bundle\nsis"
$msiDir = Join-Path $rttAnalyzerDir "src-tauri\target\release\bundle\msi"

$nsisFiles = Get-ChildItem $nsisDir -Filter "*.exe" -ErrorAction SilentlyContinue
$msiFiles = Get-ChildItem $msiDir -Filter "*.msi" -ErrorAction SilentlyContinue

if ($nsisFiles.Count -eq 0 -and $msiFiles.Count -eq 0) {
    Write-Host "错误: 未找到安装包文件" -ForegroundColor Red
    exit 1
}

Write-Host "✓ NSIS 安装包:" -ForegroundColor Green
foreach ($file in $nsisFiles) {
    $size = [math]::Round($file.Length / 1MB, 2)
    Write-Host "  - $($file.Name) ($size MB)" -ForegroundColor Cyan
}

Write-Host "✓ MSI 安装包:" -ForegroundColor Green
foreach ($file in $msiFiles) {
    $size = [math]::Round($file.Length / 1MB, 2)
    Write-Host "  - $($file.Name) ($size MB)" -ForegroundColor Cyan
}
Write-Host ""

# 8. 创建发布包
Write-Host "[8/8] 创建发布包..." -ForegroundColor Yellow

$releaseDir = Join-Path $projectRoot "release\v$Version"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

# 复制安装包
foreach ($file in $nsisFiles) {
    Copy-Item $file.FullName $releaseDir -Force
}
foreach ($file in $msiFiles) {
    Copy-Item $file.FullName $releaseDir -Force
}

# 复制文档
$docs = @(
    "USER_MANUAL.txt",
    "README.md",
    "CHINESE_INSTALLER_GUIDE.md"
)

foreach ($doc in $docs) {
    $docPath = Join-Path $projectRoot $doc
    if (Test-Path $docPath) {
        Copy-Item $docPath $releaseDir -Force
    }
}

Write-Host "✓ 发布包已创建: $releaseDir" -ForegroundColor Green
Write-Host ""

# 9. 计算校验和
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  安装包校验和 (SHA256)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$installers = Get-ChildItem $releaseDir -Include "*.exe", "*.msi" -Recurse

foreach ($installer in $installers) {
    $hash = (Get-FileHash $installer.FullName -Algorithm SHA256).Hash
    Write-Host ""
    Write-Host "文件: $($installer.Name)" -ForegroundColor Yellow
    Write-Host "SHA256: $hash" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✓ 构建完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "发布包位置: $releaseDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "下一步:" -ForegroundColor Cyan
Write-Host "1. 在干净的 Windows 系统上测试安装包" -ForegroundColor White
Write-Host "2. 验证所有功能正常工作" -ForegroundColor White
Write-Host "3. 将安装包上传到发布平台" -ForegroundColor White
Write-Host ""

# 询问是否打开发布文件夹
$openFolder = Read-Host "是否打开发布文件夹? (Y/N)"
if ($openFolder -eq "Y" -or $openFolder -eq "y") {
    Invoke-Item $releaseDir
}
