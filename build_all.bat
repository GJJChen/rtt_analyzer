@echo off
REM 完整打包流程脚本 (批处理版本)

echo ============================================
echo   RTT Analyzer - 完整打包流程
echo ============================================
echo.

REM 步骤 1: 打包后端
echo [1/3] 打包后端...
echo ----------------------------------------

if not exist ".venv\Scripts\activate.bat" (
    echo 虚拟环境不存在，正在创建...
    python -m venv .venv
)

echo 激活虚拟环境...
call .venv\Scripts\activate.bat

echo 安装后端依赖...
pip install -q pyinstaller pandas numpy fastapi uvicorn pydantic

echo 使用 PyInstaller 打包后端...
pyinstaller --onefile --name rtt_analyzer_backend rtt_analyzer_backend.py --icon=favicon.ico --clean

echo 复制到 Tauri bin 目录...
if not exist "rtt_analyzer\src-tauri\bin" mkdir "rtt_analyzer\src-tauri\bin"
copy /Y "dist\rtt_analyzer_backend.exe" "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"

echo [OK] 后端打包完成
echo.

REM 步骤 2: 进入前端目录
echo [2/3] 准备前端...
echo ----------------------------------------
cd rtt_analyzer

if not exist "node_modules" (
    echo 安装前端依赖...
    call pnpm install
) else (
    echo 前端依赖已安装
)

echo [OK] 前端准备完成
echo.

REM 步骤 3: 打包应用
echo [3/3] 打包 Tauri 应用...
echo ----------------------------------------
echo 这可能需要几分钟时间，请耐心等待...
echo.

call pnpm tauri build

echo.
echo ============================================
echo   打包完成！
echo ============================================
echo.
echo 安装包位置：
echo   MSI:  src-tauri\target\release\bundle\msi\
echo   NSIS: src-tauri\target\release\bundle\nsis\
echo.
pause
