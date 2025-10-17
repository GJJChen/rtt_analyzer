@echo off
REM 完整打包流程脚本 (批处理版本)
REM 为避免中文输出乱码，优先调用 PowerShell 脚本执行（UTF-8 友好）

setlocal EnableExtensions
REM 切换到 UTF-8 代码页（对少数 cmd 输出生效）
chcp 65001 >nul

REM 确保 Python 子进程以 UTF-8 输出
set PYTHONIOENCODING=utf-8

REM 调用 PowerShell 版本脚本（建议在 VS Code 终端中运行）
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_all.ps1"
set EXITCODE=%ERRORLEVEL%

if %EXITCODE% NEQ 0 (
  echo.
  echo 发生错误，退出代码：%EXITCODE%
)

exit /b %EXITCODE%
