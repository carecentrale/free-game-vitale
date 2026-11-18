@echo off
rem Quick build and upload: same as build-android-upload.bat but skips the tests.
rem Use only when the tests already passed for this version.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-android.ps1" -Upload -SkipTests
echo.
pause
