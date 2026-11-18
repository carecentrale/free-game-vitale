@echo off
rem Gets the latest game code from GitHub into the game folder (fast-forward only: it never overwrites local work).
cd /d "%USERPROFILE%\Desktop\adventurers-of-drenerics-game"
git pull --ff-only
echo.
pause
