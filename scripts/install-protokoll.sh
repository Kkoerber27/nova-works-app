#!/usr/bin/env bash
#
# Richtet das nächtliche Scheinwerfer-Protokoll als LaunchAgent ein (macOS).
#
#   ./scripts/install-protokoll.sh            installieren / aktualisieren
#   ./scripts/install-protokoll.sh --remove   wieder entfernen
#
# Uhrzeit über NOVA_HOUR / NOVA_MINUTE, Standard 01:00.
#
set -euo pipefail

LABEL="de.nova-works.protokoll"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$REPO/scripts/protokoll-nacht.sh"
LOG="$HOME/.nova-works/protokoll.log"
ENV_FILE="$HOME/.nova-works/env"
HOUR="${NOVA_HOUR:-1}"
MINUTE="${NOVA_MINUTE:-0}"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Entfernt: $LABEL"
  exit 0
fi

[ -x "$RUNNER" ] || { echo "FEHLER: $RUNNER fehlt oder ist nicht ausführbar." >&2; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.nova-works"
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"

if ! grep -q "PROTOKOLL_PROJEKT" "$ENV_FILE" 2>/dev/null; then
  cat >> "$ENV_FILE" <<'ENVEOF'

# Laufender Job für das nächtliche Scheinwerfer-Protokoll. Leer lassen, wenn
# gerade keiner läuft — dann wird nichts erzeugt und nichts abgelegt.
export PROTOKOLL_PROJEKT=""
export PROTOKOLL_OBJEKT=""
# Meldepostfach. Vorgabe ist info@; auf technik@ zurückstellen, sobald das
# Postfach wieder zustellt.
# export PROTOKOLL_POSTFACH="technik@nova-works.de"
# Nur nötig, wenn der Microsoft-365-Server auf diesem Rechner anders heisst als
# im Skript vorgegeben. Der Lauf nennt beim Abbruch die verfügbaren Namen.
# export PROTOKOLL_MCP_SERVER="claude_ai_Microsoft_365"
ENVEOF
  echo "In $ENV_FILE ergänzt: PROTOKOLL_PROJEKT — dort jetzt die Projektnummer eintragen."
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

printf 'Eingerichtet: %s\n  Skript:    %s\n  Uhrzeit:   %02d:%02d\n  Protokoll: %s\n  Job:       aus %s (PROTOKOLL_PROJEKT)\n\n' \
  "$LABEL" "$RUNNER" "$HOUR" "$MINUTE" "$LOG" "$ENV_FILE"
echo "Erst von Hand testen:"
echo "  $RUNNER && tail -n 20 $LOG"
