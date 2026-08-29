#!/usr/bin/env bash
#
# Richtet die nächtliche NAS-Sicherung als LaunchAgent ein (macOS).
#
#   ./scripts/install-nas-backup.sh            installieren / aktualisieren
#   ./scripts/install-nas-backup.sh --remove   wieder entfernen
#
# Uhrzeit über NOVA_HOUR / NOVA_MINUTE, Standard 03:15.
#
set -euo pipefail

LABEL="de.nova-works.nas-backup"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$REPO/scripts/nas-backup.sh"
LOG="$HOME/.nova-works/nas-backup.log"
ENV_FILE="$HOME/.nova-works/env"
HOUR="${NOVA_HOUR:-3}"
MINUTE="${NOVA_MINUTE:-15}"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Entfernt: $LABEL"
  exit 0
fi

[ -x "$RUNNER" ] || { echo "FEHLER: $RUNNER fehlt oder ist nicht ausführbar." >&2; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.nova-works"
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"

if ! grep -q "NAS_BACKUP_DIR" "$ENV_FILE" 2>/dev/null; then
  cat >> "$ENV_FILE" <<'ENVEOF'

# Ziel der nächtlichen Sicherung. Muss auf dem eingehängten NAS liegen —
# das Skript verweigert den Dienst, wenn der Pfad auf der internen Platte landet.
export NAS_BACKUP_DIR=""
# Wie viele Tagesordner aufgehoben werden (Standard 30).
export NAS_BACKUP_KEEP_DAYS="30"
ENVEOF
  echo "In $ENV_FILE ergänzt: NAS_BACKUP_DIR — jetzt dort den Pfad eintragen."
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
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>$HOUR</integer>
    <key>Minute</key><integer>$MINUTE</integer>
  </dict>
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

printf 'Eingerichtet: %s\n  Skript:    %s\n  Uhrzeit:   %02d:%02d\n  Protokoll: %s\n  Ziel:      aus %s (NAS_BACKUP_DIR)\n\n' \
  "$LABEL" "$RUNNER" "$HOUR" "$MINUTE" "$LOG" "$ENV_FILE"
echo "Erst von Hand testen:"
echo "  $RUNNER && tail -n 20 $LOG"
