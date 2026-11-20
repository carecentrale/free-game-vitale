@echo off
rem Starts the local test server: the game as it is in the game folder, on this PC and on the home network.
rem Nothing is pushed or built. Close the window to stop it.
title Drenerics local test server
set "GAME=%~dp0..\..\adventurers-of-drenerics-game\www"
node "%~dp0serve-local.mjs" "%GAME%" 8080
pause
