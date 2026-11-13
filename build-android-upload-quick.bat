@echo off
rem Quick build and upload: same as build-android-upload.bat but skips the tests.
rem Use only when the tests already passed for this version.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-android.ps1" -Upload -SkipTests
echo.
pause
