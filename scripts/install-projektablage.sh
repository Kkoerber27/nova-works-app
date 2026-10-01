#!/usr/bin/env bash
#
# Richtet die Projektablage als LaunchAgent ein (macOS): jede Minute werden
# Dokumente, die in der Angebots-App hochgeladen wurden, im OneDrive-Projektordner
# abgelegt.
#
#   ./scripts/install-projektablage.sh            installieren / aktualisieren
#   ./scripts/install-projektablage.sh --login    Anmeldung neu eingeben
#   ./scripts/install-projektablage.sh --remove   wieder entfernen
#
# Takt über NOVA_INTERVAL (Sekunden), Standard 60.
#
set -euo pipefail

LABEL="de.nova-works.projektablage"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$REPO/scripts/projektablage.sh"
LOG="$HOME/.nova-works/projektablage.log"
ENV_FILE="$HOME/.nova-works/env"
INTERVAL="${NOVA_INTERVAL:-60}"

if [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Entfernt: $LABEL"
  exit 0
fi

[ -x "$RUNNER" ] || { echo "FEHLER: $RUNNER fehlt oder ist nicht ausführbar." >&2; exit 1; }
# Node so finden, wie es im Terminal gefunden wird – der LaunchAgent bekommt
# diesen Pfad mit, sonst sieht er nur /usr/bin:/bin.
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "FEHLER: 'node' nicht gefunden. Node.js installieren (https://nodejs.org) und erneut starten." >&2
  exit 1
fi
NODE_DIR="$(cd "$(dirname "$NODE_BIN")" && pwd -P)"
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
  [ -t 0 ] || echo "In $ENV_FILE ergänzt: NOVA_ANGEBOTE_EMAIL / NOVA_ANGEBOTE_PASSWORD — dort eintragen."
fi

# Wert in der env-Datei setzen (ersetzt eine vorhandene Zeile, Rechte bleiben 600).
set_env_var() {
  local name="$1" val="$2" esc tmp
  esc=$(printf '%s' "$val" | sed -e 's/[\\"$`]/\\&/g')
  tmp="$(mktemp)"
  grep -v "^export $name=" "$ENV_FILE" >"$tmp" || true
  printf 'export %s="%s"\n' "$name" "$esc" >>"$tmp"
  cat "$tmp" >"$ENV_FILE"; rm -f "$tmp"
}
env_value() { bash -c '. "$1" >/dev/null 2>&1; eval "printf %s \"\${$2:-}\""' _ "$ENV_FILE" "$1"; }

# Anmeldung abfragen, solange sie fehlt – das Passwort wird dabei nicht angezeigt
# und landet nicht im Terminal-Verlauf.
if [ -t 0 ]; then
  CUR_MAIL="$(env_value NOVA_ANGEBOTE_EMAIL)"
  CUR_PW="$(env_value NOVA_ANGEBOTE_PASSWORD)"
  if [ -z "$CUR_MAIL" ] || [ -z "$CUR_PW" ] || [ "$CUR_PW" = "…" ] || [ "${1:-}" = "--login" ]; then
    echo "Anmeldung für die Angebots-App (wie beim Login auf angebote.nova-works.de):"
    read -r -p "  E-Mail oder Benutzername${CUR_MAIL:+ [$CUR_MAIL]}: " NEW_MAIL
    NEW_MAIL="${NEW_MAIL:-$CUR_MAIL}"
    read -r -s -p "  Passwort (wird nicht angezeigt): " NEW_PW; echo
    if [ -z "$NEW_MAIL" ] || [ -z "$NEW_PW" ]; then
      echo "FEHLER: E-Mail und Passwort werden gebraucht. Einfach das Skript nochmal starten." >&2
      exit 1
    fi
    set_env_var NOVA_ANGEBOTE_EMAIL "$NEW_MAIL"
    set_env_var NOVA_ANGEBOTE_PASSWORD "$NEW_PW"
    echo "  Gespeichert in $ENV_FILE"
    echo
  fi
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
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$NODE_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>NOVA_NODE_DIR</key>
    <string>$NODE_DIR</string>
  </dict>
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

printf 'Eingerichtet: %s\n  Skript:    %s\n  Node:      %s\n  Takt:      alle %s Sekunden\n  Protokoll: %s\n  Zugang:    aus %s\n\n' \
  "$LABEL" "$RUNNER" "$NODE_DIR/node" "$INTERVAL" "$LOG" "$ENV_FILE"
if [ -t 0 ]; then
  echo "Probelauf (schreibt nichts, zeigt nur, was abgelegt würde):"
  "$RUNNER" --probe || true
  echo
  echo "Hintergrunddienst wird gestartet und geprüft …"
  # RunAtLoad hat schon eine Runde gestartet – nur abwarten, nicht neu starten
  # (ein Neustart bricht die laufende Runde ab).
  sleep 10
  if tail -n 15 "$LOG" 2>/dev/null | grep -q "FEHLER"; then
    echo "Der Hintergrunddienst meldet einen Fehler – letzte Zeilen aus $LOG:"
    tail -n 6 "$LOG"
  else
    echo "Hintergrunddienst läuft. Status siehst du auch in der App in der Karte „Projektablage“."
  fi
  echo
  echo "Anmeldung ändern: $0 --login"
else
  echo "Erst von Hand testen:"
  echo "  $RUNNER --probe"
fi
