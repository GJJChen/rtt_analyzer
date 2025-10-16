@echo off
title RTT Analyzer Backend Server
color 0A
echo ========================================
echo   RTT Analyzer Backend Server
echo ========================================
echo.
echo Starting server on http://127.0.0.1:8000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM 如果是打包后的 exe
if exist rtt_analyzer_backend.exe (
    rtt_analyzer_backend.exe
) else (
    REM 如果是 Python 脚本
    if exist .venv\Scripts\python.exe (
        .venv\Scripts\python.exe rtt_analyzer_backend.py
    ) else (
        python rtt_analyzer_backend.py
    )
)
