@echo off
rem Stops and removes the build watcher scheduled task. Builds can still be run by hand with the build-android files.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Stop-ScheduledTask -TaskName 'Drenerics build watcher' -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName 'Drenerics build watcher' -Confirm:$false; Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*build-watcher.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Host 'Build watcher removed.'"
echo.
pause
