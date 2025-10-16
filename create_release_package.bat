@echo off
chcp 65001 >nul
echo ========================================
echo   RTT Analyzer 完整发布包打包工具
echo ========================================
echo.

REM 设置变量
set VERSION=0.1.0
set RELEASE_DIR=RTT_Analyzer_v%VERSION%
set BUNDLE_DIR=rtt_analyzer\src-tauri\target\release\bundle

REM 创建发布文件夹
echo [1/5] 创建发布文件夹...
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

REM 复制前端安装程序
echo [2/5] 复制前端安装程序...
if exist "%BUNDLE_DIR%\nsis\rtt_analyzer_%VERSION%_x64-setup.exe" (
    copy "%BUNDLE_DIR%\nsis\rtt_analyzer_%VERSION%_x64-setup.exe" "%RELEASE_DIR%\"
    echo ✓ NSIS 安装程序已复制
) else (
    echo ✗ 未找到 NSIS 安装程序，请先运行: pnpm tauri build
)

if exist "%BUNDLE_DIR%\msi\rtt_analyzer_%VERSION%_x64_en-US.msi" (
    copy "%BUNDLE_DIR%\msi\rtt_analyzer_%VERSION%_x64_en-US.msi" "%RELEASE_DIR%\"
    echo ✓ MSI 安装包已复制
)

REM 复制后端文件
echo [3/5] 准备后端文件...

REM 选项 A：如果已经打包了后端 exe
if exist "dist\rtt_analyzer_backend.exe" (
    copy "dist\rtt_analyzer_backend.exe" "%RELEASE_DIR%\"
    echo ✓ 后端可执行文件已复制
) else (
    REM 选项 B：复制 Python 脚本版本
    copy "rtt_analyzer_backend.py" "%RELEASE_DIR%\"
    echo ✓ 后端 Python 脚本已复制
    echo.
    echo 💡 提示：如需打包后端为 exe，请运行 build_backend.bat
)

REM 复制启动脚本和文档
echo [4/5] 复制配置和文档文件...
copy "start_backend.bat" "%RELEASE_DIR%\"
copy "USER_MANUAL.txt" "%RELEASE_DIR%\使用说明.txt"

REM 创建 requirements.txt
echo [5/5] 生成依赖文件...
(
echo fastapi^>=0.104.0
echo uvicorn^>=0.24.0
echo pandas^>=2.1.0
echo numpy^>=1.24.0
echo pydantic^>=2.0.0
) > "%RELEASE_DIR%\requirements.txt"

REM 创建快速开始文档
(
echo ========================================
echo   RTT Analyzer v%VERSION% - 快速开始
echo ========================================
echo.
echo 1. 启动后端服务器：
echo    双击运行 "start_backend.bat"
echo.
echo 2. 安装应用程序：
echo    双击运行 "rtt_analyzer_%VERSION%_x64-setup.exe"
echo.
echo 3. 开始使用：
echo    启动 RTT Analyzer，拖拽 CSV 文件进行分析
echo.
echo 详细说明请查看：使用说明.txt
echo.
) > "%RELEASE_DIR%\快速开始.txt"

echo.
echo ========================================
echo   打包完成！
echo ========================================
echo.
echo 📦 发布包位置: %RELEASE_DIR%\
echo.
echo 📋 包含文件:
dir /b "%RELEASE_DIR%"
echo.
echo 💡 提示：
echo    - 使用 NSIS 安装程序（rtt_analyzer_%VERSION%_x64-setup.exe）分发给用户
echo    - 或使用 MSI 安装包用于企业部署
echo    - 后端需要用户有 Python 环境，或使用打包后的 exe
echo.
pause
