@echo off
rem Gets the latest game code from GitHub into this folder (fast-forward only: it never overwrites local work).
cd /d "%~dp0"
git pull --ff-only
echo.
pause
