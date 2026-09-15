@echo off
REM Pacifer - pornire locala pe Windows.
REM
REM De obicei nu ai nevoie de acest fisier: jocul merge deschis direct, prin
REM dublu-clic pe index.html. Foloseste-l daca browserul refuza fisierele
REM locale sau daca vrei sa deschizi jocul si de pe telefon, din aceeasi retea.

cd /d "%~dp0.."
set PORT=8123
echo Pacifer: http://localhost:%PORT%/pacifer/
echo De pe telefon, in aceeasi retea Wi-Fi, foloseste adresa IP a acestui calculator
echo (o vezi cu comanda ipconfig), de forma http://192.168.x.x:%PORT%/pacifer/
echo Opreste serverul cu Ctrl+C.
start "" http://localhost:%PORT%/pacifer/
python -m http.server %PORT%
pause
