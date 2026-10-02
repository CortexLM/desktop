#!/usr/bin/env bash
# Runs ON the remote Mac. Launches the installed Cortex.app, then captures every gallery route in light and dark
# with the native window chrome (traffic lights, title bar) using `screencapture -l <windowID>`, plus the app menus.
# Usage: capture.sh <routes-file> <out-dir>      routes-file: one "<id>[~variant]" per line
set -euo pipefail
ROUTES="$1"; OUT="$2"; APP="/Applications/Cortex.app"
mkdir -p "$OUT"
cat > /tmp/winid.swift <<'SW'
import CoreGraphics
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for w in list where (w["kCGWindowOwnerName"] as? String) == "Cortex" && (w["kCGWindowLayer"] as? Int) == 0 {
  print(w["kCGWindowNumber"] as! Int); break
}
SW
winid() { swift /tmp/winid.swift 2>/dev/null | head -1; }
for theme in light dark; do
  if [ "$theme" = dark ]; then osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true'; else osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to false'; fi
  while read -r line; do
    [ -z "$line" ] && continue
    id="${line%%~*}"; v=""; [[ "$line" == *"~"* ]] && v="${line#*~}"
    hash="#/${id}?theme=${theme}&preview${v:+&v=$v}"
    pkill -x Cortex 2>/dev/null || true; sleep 0.5
    CORTEX_START_HASH="$hash" CORTEX_LOCALE=en open -n -W "$APP" --env CORTEX_START_HASH="$hash" --env CORTEX_LOCALE=en & sleep 4
    wid=$(winid); if [ -z "$wid" ]; then echo "no window for $line"; continue; fi
    screencapture -o -x -l "$wid" "$OUT/${line}-${theme}.png"
    echo "captured $line $theme"
  done < "$ROUTES"
done
pkill -x Cortex 2>/dev/null || true
