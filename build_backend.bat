@echo off
echo ========================================
echo Building RTT Analyzer Backend
echo ========================================
echo.

REM 激活虚拟环境
call .venv\Scripts\activate.bat

REM 安装 PyInstaller（如果还没安装）
echo Installing PyInstaller...
pip install pyinstaller

REM 打包后端为目录模式（onedir，启动更快）
echo Building backend executable (onedir mode for faster startup)...
pyinstaller rtt_analyzer_backend.spec

REM 复制到 Tauri bin 目录
echo Copying to Tauri bin directory...
if not exist "rtt_analyzer\src-tauri\bin" mkdir "rtt_analyzer\src-tauri\bin"

REM 清理旧的目录和文件
if exist "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend" (
    rmdir /S /Q "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend"
)
if exist "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc" (
    rmdir /S /Q "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc"
)
if exist "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe" (
    del /Q "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"
)

REM 复制并重命名目录为带架构后缀的名称（Tauri 要求）
xcopy /E /I /Y "dist\rtt_analyzer_backend" "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc"

REM 重命名主执行文件以匹配 Tauri 的期望
if exist "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc\rtt_analyzer_backend.exe" (
    move /Y "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc\rtt_analyzer_backend.exe" "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"
    echo Backend executable renamed to match Tauri requirements
)

REM 同时复制到 debug 和 release 目录，用于 Tauri 开发模式
echo Copying to debug/release directories for dev mode...

for %%m in (debug release) do (
    if not exist "rtt_analyzer\src-tauri\target\%%m" mkdir "rtt_analyzer\src-tauri\target\%%m"
    
    if exist "rtt_analyzer\src-tauri\target\%%m\rtt_analyzer_backend-x86_64-pc-windows-msvc" (
        rmdir /S /Q "rtt_analyzer\src-tauri\target\%%m\rtt_analyzer_backend-x86_64-pc-windows-msvc"
    )
    
    xcopy /E /I /Y "dist\rtt_analyzer_backend" "rtt_analyzer\src-tauri\target\%%m\rtt_analyzer_backend-x86_64-pc-windows-msvc"
    
    if exist "rtt_analyzer\src-tauri\target\%%m\rtt_analyzer_backend-x86_64-pc-windows-msvc\rtt_analyzer_backend.exe" (
        move /Y "rtt_analyzer\src-tauri\target\%%m\rtt_analyzer_backend-x86_64-pc-windows-msvc\rtt_analyzer_backend.exe" "rtt_analyzer\src-tauri\target\%%m\rtt_analyzer_backend-x86_64-pc-windows-msvc\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"
    )
    
    echo   - Copied to %%m directory
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo Output: dist\rtt_analyzer_backend\
echo Copied to: rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc\
echo.
pause

