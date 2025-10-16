@echo off
echo ========================================
echo RTT Analyzer - 首次设置
echo ========================================
echo.

echo [1/3] 构建后端...
call build_backend.bat

echo.
echo [2/3] 进入前端目录...
cd rtt_analyzer

echo.
echo [3/3] 安装前端依赖...
call pnpm install

echo.
echo ========================================
echo 设置完成！
echo ========================================
echo.
echo 现在你可以运行:
echo   - 开发模式: cd rtt_analyzer ^&^& pnpm tauri dev
echo   - 打包应用: cd rtt_analyzer ^&^& pnpm tauri build
echo.
pause
