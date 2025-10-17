@echo off
chcp 65001 >nul
echo ========================================
echo   RTT Analyzer 发布构建工具
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0create_release.ps1"

pause
