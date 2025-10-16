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

REM 打包后端为单个可执行文件
echo Building backend executable...
pyinstaller --onefile --name rtt_analyzer_backend rtt_analyzer_backend.py --icon=favicon.ico --clean --hidden-import=pandas --hidden-import=numpy --hidden-import=uvicorn.logging --hidden-import=uvicorn.loops --hidden-import=uvicorn.loops.auto --hidden-import=uvicorn.protocols --hidden-import=uvicorn.protocols.http --hidden-import=uvicorn.protocols.http.auto --hidden-import=uvicorn.protocols.websockets --hidden-import=uvicorn.protocols.websockets.auto --hidden-import=uvicorn.lifespan --hidden-import=uvicorn.lifespan.on --collect-all=pandas --collect-all=numpy

REM 复制到 Tauri bin 目录
echo Copying to Tauri bin directory...
if not exist "rtt_analyzer\src-tauri\bin" mkdir "rtt_analyzer\src-tauri\bin"
copy /Y "dist\rtt_analyzer_backend.exe" "rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe"

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo Output: dist\rtt_analyzer_backend.exe
echo Copied to: rtt_analyzer\src-tauri\bin\rtt_analyzer_backend-x86_64-pc-windows-msvc.exe
echo.
pause

