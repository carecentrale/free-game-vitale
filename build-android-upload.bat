@echo off
rem Builds the signed Android app on this PC and uploads it to Google Play (internal testing). No GitHub needed.
rem Double-click to run with tests. To skip the tests: build-android-upload.bat -SkipTests
rem Needs the Play service account key: see docs\RELEASE.md, "Uploading from this PC".
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-android.ps1" -Upload %*
echo.
pause
