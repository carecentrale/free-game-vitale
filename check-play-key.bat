@echo off
rem Checks that the Play service account key can reach the app on Google Play. Uploads nothing.
cd /d "%USERPROFILE%\Desktop\adventurers-of-drenerics-game"
node "%~dp0upload-play.mjs" --check
echo.
pause
