# RTT Analyzer Icon Refresh Script
Write-Host "========================================"
Write-Host "RTT Analyzer Icon Refresh Tool"
Write-Host "========================================"
Write-Host ""

# 1. Check icon file
Write-Host "1. Checking icon file..."
$iconPath = "rtt_analyzer\src-tauri\icons\icon.ico"
if (Test-Path $iconPath) {
    Write-Host "   OK: Icon file exists" -ForegroundColor Green
} else {
    Write-Host "   ERROR: Icon file not found!" -ForegroundColor Red
    exit 1
}

# 2. Clear Tauri debug cache
Write-Host ""
Write-Host "2. Clearing Tauri debug cache..."
$debugPath = "rtt_analyzer\src-tauri\target\debug"
if (Test-Path $debugPath) {
    Remove-Item -Path $debugPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   OK: Debug cache cleared" -ForegroundColor Green
}

# 3. Clear Windows icon cache
Write-Host ""
Write-Host "3. Clearing Windows icon cache..."
ie4uinit.exe -ClearIconCache 2>$null
Write-Host "   OK: Icon cache cleared" -ForegroundColor Green

# 4. Delete local icon cache
Write-Host ""
Write-Host "4. Deleting local icon cache..."
$iconCachePath = "$env:LOCALAPPDATA\IconCache.db"
if (Test-Path $iconCachePath) {
    Remove-Item -Path $iconCachePath -Force -ErrorAction SilentlyContinue
    Write-Host "   OK: Cache file deleted" -ForegroundColor Green
}

# 5. Restart Explorer
Write-Host ""
Write-Host "5. Restarting Windows Explorer..."
Write-Host "   (Desktop will disappear for a few seconds)"
taskkill /f /im explorer.exe 2>$null | Out-Null
Start-Sleep -Seconds 2
Start-Process explorer.exe
Start-Sleep -Seconds 2
Write-Host "   OK: Explorer restarted" -ForegroundColor Green

# Done
Write-Host ""
Write-Host "========================================"
Write-Host "Icon cache refreshed successfully!"
Write-Host "========================================"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. cd rtt_analyzer"
Write-Host "2. pnpm tauri dev"
Write-Host ""
