#!/bin/bash
# Stickman Tower — double-click this in Finder to play on a Mac.
#
# Serving the folder (rather than opening the file directly) is what gives you
# the installable app, offline play and reliable saves. If no local web server
# is available this falls back to opening the single-file build, which still
# plays perfectly — it just cannot install to the Dock.

cd "$(cd "$(dirname "$0")" && pwd)" || exit 1

PORT=8080
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
  [ "$PORT" -gt 8120 ] && break
done

URL="http://localhost:$PORT/"

open_when_ready() {
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null "$URL"; then break; fi
    sleep 0.25
  done
  open "$URL"
}

start_server() {
  echo ""
  echo "  STICKMAN TOWER"
  echo "  ---------------------------------------------"
  echo "  Playing at $URL"
  echo ""
  echo "  Install it to your Dock:"
  echo "    Chrome / Edge  ->  the Install icon in the address bar"
  echo "    Safari         ->  File -> Add to Dock"
  echo ""
  echo "  Keyboard:  arrows or WASD to move,  J / K / L to punch, punch, kick"
  echo "             Shift to block,  Q for a tonic,  Esc to pause"
  echo ""
  echo "  Leave this Terminal window open while you play."
  echo "  Press Ctrl-C here when you are done."
  echo "  ---------------------------------------------"
  echo ""
  open_when_ready &
  "$@"
}

if command -v python3 >/dev/null 2>&1; then
  start_server python3 -m http.server "$PORT" --bind 127.0.0.1
elif command -v python >/dev/null 2>&1; then
  start_server python -m SimpleHTTPServer "$PORT"
elif command -v npx >/dev/null 2>&1; then
  start_server npx --yes http-server -p "$PORT" -a 127.0.0.1 -c-1
elif command -v php >/dev/null 2>&1; then
  start_server php -S "127.0.0.1:$PORT"
else
  echo ""
  echo "  No local web server found (no python3, node or php)."
  echo "  Opening the single-file build instead — the game plays fine,"
  echo "  it just will not install to the Dock or run offline."
  echo ""
  open "dist/stickman-tower.html"
fi
