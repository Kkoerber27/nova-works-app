#!/usr/bin/env bash
#
# Richtet die Projektablage als LaunchAgent ein (macOS): alle 2 Minuten werden
# Dokumente, die in der Angebots-App hochgeladen wurden, im OneDrive-Projektordner
# abgelegt.
#
#   ./scripts/install-projektablage.sh            installieren / aktualisieren
#   ./scripts/install-projektablage.sh --remove   wieder entfernen
#
# Takt über NOVA_INTERVAL (Sekunden), Standard 120.
#
set -euo pipefail

LABEL="de.nova-works.projektablage"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$REPO/scripts/projektablage.sh"
LOG="$HOME/.nova-works/projektablage.log"
ENV_FILE="$HOME/.nova-works/env"
INTERVAL="${NOVA_INTERVAL:-120}"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Entfernt: $LABEL"
  exit 0
fi

[ -x "$RUNNER" ] || { echo "FEHLER: $RUNNER fehlt oder ist nicht ausführbar." >&2; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.nova-works"
touch "$ENV_FILE"; chmod 600 "$ENV_FILE"

if ! grep -q "PROJEKT_ABLAGE_ROOT" "$ENV_FILE" 2>/dev/null; then
  cat >> "$ENV_FILE" <<'ENVEOF'

# ── Projektablage ──
# Anmeldung an der Angebots-App (ein normaler App-Benutzer genügt).
export NOVA_ANGEBOTE_EMAIL=""
export NOVA_ANGEBOTE_PASSWORD=""
# Ordner "Angebote" im synchronisierten OneDrive. Leer lassen = automatisch suchen
# (~/Library/CloudStorage/OneDrive-…/Angebote).
export PROJEKT_ABLAGE_ROOT=""
# Web-Adresse desselben Ordners – damit die App direkt auf die Datei verlinkt.
export PROJEKT_ABLAGE_WEB="https://novaworksgmbh-my.sharepoint.com/personal/kk_nova-works_de/Documents/Angebote"
ENVEOF
  echo "In $ENV_FILE ergänzt: NOVA_ANGEBOTE_EMAIL / NOVA_ANGEBOTE_PASSWORD — jetzt dort eintragen."
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
  <true/>
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

printf 'Eingerichtet: %s\n  Skript:    %s\n  Takt:      alle %s Sekunden\n  Protokoll: %s\n  Zugang:    aus %s\n\n' \
  "$LABEL" "$RUNNER" "$INTERVAL" "$LOG" "$ENV_FILE"
echo "Erst von Hand testen:"
echo "  $RUNNER --probe"
