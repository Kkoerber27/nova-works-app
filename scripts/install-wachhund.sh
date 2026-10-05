#!/usr/bin/env bash
#
# Richtet den Wachhund als LaunchAgent ein (macOS).
#
#   ./scripts/install-wachhund.sh            installieren / aktualisieren
#   ./scripts/install-wachhund.sh --remove   wieder entfernen
#
# Der Wachhund prüft stündlich, ob sich die Hintergrundjobs noch melden, und
# schlägt an, wenn einer zu lange schweigt. Er gehört in denselben Klon wie die
# Jobs — und zwar in den, in dem niemand arbeitet und keine Branches gewechselt
# werden. Genau dieser Wechsel hat die Jobs im September zehn Tage lahmgelegt.
#
set -euo pipefail

LABEL="de.nova-works.wachhund"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$REPO/scripts/wachhund.sh"
LOG="$HOME/.nova-works/wachhund.log"
INTERVAL="${NOVA_INTERVAL:-3600}"   # Sekunden; 3600 = stündlich

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Entfernt: $LABEL"
  exit 0
fi

[ -x "$RUNNER" ] || { echo "FEHLER: $RUNNER fehlt oder ist nicht ausführbar." >&2; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.nova-works"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$RUNNER</string>
  </array>
  <key>StartInterval</key>
  <integer>$INTERVAL</integer>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$LOG</string>
  <key>StandardErrorPath</key>
  <string>$LOG</string>
  <key>WorkingDirectory</key>
  <string>$REPO</string>
</dict>
</plist>
PLISTEOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST"

echo "Eingerichtet: $LABEL"
echo "  Skript:    $RUNNER"
echo "  Intervall: $INTERVAL s"
echo "  Protokoll: $LOG"
echo
echo "Stand jederzeit ansehen, ohne etwas zu melden:"
echo "  $RUNNER --zeigen"
echo
echo "WICHTIG: Ohne NOVA_ALERT_CMD bleibt es bei einer Mitteilung auf dem"
echo "Bildschirm — die sieht an einem Rechner im Schrank niemand. Siehe"
echo "scripts/README.md, Abschnitt 'Wenn ein Job scheitert'."
