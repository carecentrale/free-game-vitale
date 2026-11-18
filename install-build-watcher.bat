@echo off
rem Installs the build watcher: a background helper that runs builds when Claude asks for one (see build-watcher.ps1 in this folder).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-build-watcher.ps1"
echo.
pause
