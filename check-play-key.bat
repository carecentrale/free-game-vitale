@echo off
rem Checks that the Play service account key can reach the app on Google Play. Uploads nothing.
cd /d "%~dp0"
node scripts\upload-play.mjs --check
echo.
pause
