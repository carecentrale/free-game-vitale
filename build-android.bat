@echo off
rem Builds the signed Android app for Google Play on this PC (see scripts\build-android.ps1).
rem Double-click to run with tests. To skip the tests: build-android.bat -SkipTests
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-android.ps1" %*
echo.
pause
