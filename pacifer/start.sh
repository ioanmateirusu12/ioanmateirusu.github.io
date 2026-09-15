#!/bin/sh
# Pacifer - pornire locala pe Linux / macOS.
#
# De obicei nu ai nevoie de acest script: jocul merge deschis direct, prin
# dublu-clic pe index.html. Foloseste-l daca browserul tau refuza fisierele
# locale sau daca vrei sa deschizi jocul si de pe telefon, din aceeasi retea.

cd "$(dirname "$0")/.." || exit 1
PORT=8123
echo "Pacifer: http://localhost:$PORT/pacifer/"
echo "De pe telefon, in aceeasi retea Wi-Fi, incearca una dintre adresele:"
(hostname -I 2>/dev/null || ipconfig getifaddr en0 2>/dev/null) | tr ' ' '\n' | grep -v '^$' | sed "s|^|  http://|;s|$|:$PORT/pacifer/|"
echo "Opreste serverul cu Ctrl+C."

(sleep 1 && (xdg-open "http://localhost:$PORT/pacifer/" >/dev/null 2>&1 || open "http://localhost:$PORT/pacifer/" >/dev/null 2>&1)) &
exec python3 -m http.server "$PORT"
