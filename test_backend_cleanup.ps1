#!/usr/bin/env pwsh
# 测试后端进程清理脚本

Write-Host "=== 后端进程清理测试 ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. 检查当前运行的后端进程..." -ForegroundColor Yellow
$processes = Get-Process | Where-Object {$_.ProcessName -eq 'rtt_analyzer_backend'}
if ($processes) {
    Write-Host "找到 $($processes.Count) 个后端进程:" -ForegroundColor Red
    $processes | Format-Table Id, ProcessName, StartTime -AutoSize
    
    Write-Host ""
    $response = Read-Host "是否要清理这些进程? (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        $processes | ForEach-Object {
            Stop-Process -Id $_.Id -Force
            Write-Host "已终止进程 PID: $($_.Id)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "✓ 没有发现残留的后端进程" -ForegroundColor Green
}

Write-Host ""
Write-Host "2. 说明:" -ForegroundColor Yellow
Write-Host "   - 修改后，关闭前端窗口时会自动清理后端进程" -ForegroundColor White
Write-Host "   - 使用了两层保护：窗口关闭事件 + 应用退出事件" -ForegroundColor White
Write-Host "   - 如果仍有残留进程，请运行此脚本清理" -ForegroundColor White
Write-Host ""
