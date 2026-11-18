@echo off
rem Builds the signed Android app for Google Play on this PC (see build-android.ps1 in this folder).
rem Double-click to run with tests. To skip the tests: build-android.bat -SkipTests
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-android.ps1" %*
echo.
pause
