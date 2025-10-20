#!/usr/bin/env pwsh
# 查看 RTT Analyzer 的日志文件

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RTT Analyzer 日志查看工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 可能的日志位置
$logLocations = @(
    # 1. 开发环境
    "rtt_analyzer\src-tauri\target\debug\rtt_analyzer.log",
    "rtt_analyzer\src-tauri\target\release\rtt_analyzer.log",
    
    # 2. 常见安装位置
    "C:\Program Files\RTT Analyzer GUI\rtt_analyzer.log",
    "$env:LOCALAPPDATA\Programs\RTT Analyzer GUI\rtt_analyzer.log",
    
    # 3. 用户桌面（如果从桌面快捷方式启动）
    "$env:USERPROFILE\Desktop\rtt_analyzer.log"
)

$foundLogs = @()

Write-Host "正在搜索日志文件..." -ForegroundColor Yellow
foreach ($location in $logLocations) {
    if (Test-Path $location) {
        $foundLogs += $location
        Write-Host "✓ 找到: $location" -ForegroundColor Green
    }
}

if ($foundLogs.Count -eq 0) {
    Write-Host "❌ 未找到任何日志文件" -ForegroundColor Red
    Write-Host ""
    Write-Host "提示：" -ForegroundColor Yellow
    Write-Host "1. 确保已经运行过 RTT Analyzer" -ForegroundColor White
    Write-Host "2. 日志文件会生成在 rtt_analyzer.exe 所在的目录" -ForegroundColor White
    Write-Host "3. 手动查找 'rtt_analyzer.log' 文件" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "日志文件内容" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($logFile in $foundLogs) {
    Write-Host ""
    Write-Host "📄 文件: $logFile" -ForegroundColor Magenta
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    $content = Get-Content $logFile -ErrorAction SilentlyContinue
    
    if ($content) {
        # 转换时间戳为可读格式
        foreach ($line in $content) {
            if ($line -match '^\[(\d+)\] (.+)$') {
                $timestamp = $Matches[1]
                $message = $Matches[2]
                
                # 转换 Unix 时间戳
                $dateTime = [DateTimeOffset]::FromUnixTimeSeconds([long]$timestamp).LocalDateTime
                $formattedTime = $dateTime.ToString("yyyy-MM-dd HH:mm:ss")
                
                # 根据内容着色
                if ($message -match '✓|Found|started|success') {
                    Write-Host "[$formattedTime] $message" -ForegroundColor Green
                } elseif ($message -match 'ERROR|Failed|not found') {
                    Write-Host "[$formattedTime] $message" -ForegroundColor Red
                } elseif ($message -match '===') {
                    Write-Host "[$formattedTime] $message" -ForegroundColor Cyan
                } else {
                    Write-Host "[$formattedTime] $message" -ForegroundColor White
                }
            } else {
                Write-Host $line -ForegroundColor White
            }
        }
    } else {
        Write-Host "（日志文件为空）" -ForegroundColor Gray
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "提示：使用 Ctrl+C 可以停止查看" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
