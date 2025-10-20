# 清理残留的后端进程
# 用于在开发过程中手动清理可能残留的 rtt_analyzer_backend.exe 进程

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "清理 RTT Analyzer 后端进程" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 查找所有 rtt_analyzer_backend.exe 进程
$processes = Get-Process -Name "rtt_analyzer_backend" -ErrorAction SilentlyContinue

if ($processes) {
    Write-Host "找到 $($processes.Count) 个后端进程:" -ForegroundColor Yellow
    $processes | ForEach-Object {
        Write-Host "  - PID: $($_.Id)" -ForegroundColor White
    }
    Write-Host ""
    
    # 强制终止所有后端进程
    Write-Host "正在终止进程..." -ForegroundColor Yellow
    taskkill /F /IM rtt_analyzer_backend.exe 2>&1 | Out-Null
    
    Start-Sleep -Milliseconds 500
    
    # 验证是否清理成功
    $remaining = Get-Process -Name "rtt_analyzer_backend" -ErrorAction SilentlyContinue
    if ($remaining) {
        Write-Host "警告: 仍有 $($remaining.Count) 个进程未能清理" -ForegroundColor Red
        $remaining | ForEach-Object {
            Write-Host "  - PID: $($_.Id)" -ForegroundColor Red
        }
    } else {
        Write-Host "✓ 所有后端进程已清理完毕" -ForegroundColor Green
    }
} else {
    Write-Host "✓ 未发现后端进程" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "清理完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 可选：也检查并清理占用 8000 端口的进程
Write-Host "检查端口 8000 占用情况..." -ForegroundColor Yellow
$portInfo = netstat -ano | findstr ":8000"

if ($portInfo) {
    Write-Host "端口 8000 正在被使用:" -ForegroundColor Yellow
    Write-Host $portInfo -ForegroundColor White
    Write-Host ""
    
    # 提取 PID 并询问是否终止
    $portInfo -split "`n" | ForEach-Object {
        if ($_ -match '\s+(\d+)\s*$') {
            $pid = $matches[1]
            try {
                $proc = Get-Process -Id $pid -ErrorAction Stop
                Write-Host "占用进程: $($proc.ProcessName) (PID: $pid)" -ForegroundColor White
                
                $response = Read-Host "是否终止此进程? (Y/N)"
                if ($response -eq "Y" -or $response -eq "y") {
                    taskkill /F /PID $pid
                    Write-Host "✓ 进程已终止" -ForegroundColor Green
                }
            } catch {
                # 进程可能已经不存在
            }
        }
    }
} else {
    Write-Host "✓ 端口 8000 未被占用" -ForegroundColor Green
}

Write-Host ""
