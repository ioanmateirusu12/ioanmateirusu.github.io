#!/bin/sh
# Pacifer - run it locally on Linux / macOS.
#
# You normally do not need this script: the game runs from a double-click on
# index.html. Use it if your browser refuses local files, or if you want to open
# the game from a phone on the same network.

cd "$(dirname "$0")/.." || exit 1
PORT=8123
echo "Pacifer: http://localhost:$PORT/pacifer/"
echo "From a phone on the same Wi-Fi, try one of these:"
(hostname -I 2>/dev/null || ipconfig getifaddr en0 2>/dev/null) | tr ' ' '\n' | grep -v '^$' | sed "s|^|  http://|;s|$|:$PORT/pacifer/|"
echo "Stop the server with Ctrl+C."

(sleep 1 && (xdg-open "http://localhost:$PORT/pacifer/" >/dev/null 2>&1 || open "http://localhost:$PORT/pacifer/" >/dev/null 2>&1)) &
exec python3 -m http.server "$PORT"
