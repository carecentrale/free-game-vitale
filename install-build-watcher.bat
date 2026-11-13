@echo off
rem Installs the build watcher: a background helper that runs builds when Claude asks for one (see scripts\build-watcher.ps1).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-build-watcher.ps1"
echo.
pause
