#!/usr/bin/env bash
#
# Richtet die wiederkehrende Rechnungsablage als LaunchAgent ein (macOS).
#
#   ./scripts/install-rechnungsablage.sh            installieren / aktualisieren
#   ./scripts/install-rechnungsablage.sh --remove   wieder entfernen
#
set -euo pipefail

LABEL="de.nova-works.rechnungsablage"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$REPO/scripts/rechnungsablage.sh"
LOG="$HOME/.nova-works/rechnungsablage.log"
ENV_FILE="$HOME/.nova-works/env"
INTERVAL="${NOVA_INTERVAL:-900}"   # Sekunden; 900 = 15 Minuten

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Entfernt: $LABEL"
  exit 0
fi

[ -x "$RUNNER" ] || { echo "FEHLER: $RUNNER fehlt oder ist nicht ausführbar." >&2; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.nova-works"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENVEOF'
# Zugangsdaten für die Rechnungsablage. Diese Datei gehört NICHT ins Repository.
# Schlüssel anlegen in Lexware Office: Einstellungen → Erweiterungen → Öffentliche API
export LEX_API_KEY=""
ENVEOF
  chmod 600 "$ENV_FILE"
  echo "Angelegt: $ENV_FILE — dort jetzt den LEX_API_KEY eintragen."
fi

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
echo "  Schlüssel: $ENV_FILE"
echo
echo "Erst einmal von Hand testen, bevor du dich darauf verlässt:"
echo "  $RUNNER && tail -n 40 $LOG"
