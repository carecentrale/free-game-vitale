@echo off
rem Quick Android build: same as build-android.bat but skips the tests.
rem Use only when the tests already passed for this version.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-android.ps1" -SkipTests
echo.
pause
