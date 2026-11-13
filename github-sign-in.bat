@echo off
rem One-time GitHub sign-in for Git on this PC, so the build watcher can push to GitHub ("push" request).
rem A GitHub sign-in window opens: sign in as carecentrale. Nothing is changed on GitHub (this is a dry run).
cd /d "%~dp0"
git push --dry-run origin main
echo.
if errorlevel 1 (echo Sign-in or push check failed. Send this window's text to Claude.) else (echo Signed in. The build watcher can now push to GitHub.)
pause
