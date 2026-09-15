@echo off
REM Pacifer - run it locally on Windows.
REM
REM You normally do not need this file: the game runs from a double-click on
REM index.html. Use it if your browser refuses local files, or if you want to
REM open the game from a phone on the same network.

cd /d "%~dp0.."
set PORT=8123
echo Pacifer: http://localhost:%PORT%/pacifer/
echo From a phone on the same Wi-Fi use this computer's IP address
echo (run ipconfig to find it), like http://192.168.x.x:%PORT%/pacifer/
echo Stop the server with Ctrl+C.
start "" http://localhost:%PORT%/pacifer/
python -m http.server %PORT%
pause
