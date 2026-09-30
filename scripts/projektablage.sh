#!/usr/bin/env bash
#
# Projektablage: legt in der Angebots-App hochgeladene Dokumente im
# OneDrive-Projektordner ab (Angebote/<Nummer>_<Name>/<Unterordner>).
#
# Wird vom LaunchAgent de.nova-works.projektablage alle 2 Minuten aufgerufen.
# Zum Testen von Hand:
#   ./scripts/projektablage.sh --probe   nur anzeigen, was abgelegt würde
#   ./scripts/projektablage.sh           wirklich ablegen
#
set -uo pipefail

REPO="${NOVA_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG="${NOVA_LOG:-$HOME/.nova-works/projektablage.log}"
ENV_FILE="${NOVA_ENV_FILE:-$HOME/.nova-works/env}"

mkdir -p "$(dirname "$LOG")"
log() { echo "[$(date "+%Y-%m-%d %H:%M:%S")] $*" >>"$LOG"; }

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -f "$ENV_FILE" ]; then
  if ! bash -n "$ENV_FILE" 2>/dev/null; then
    log "FEHLER $ENV_FILE ist syntaktisch fehlerhaft — meist ein nicht geschlossenes Anführungszeichen."
    log "       Prüfen mit: bash -n $ENV_FILE"
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$ENV_FILE"
fi
export NOVA_ANGEBOTE_EMAIL NOVA_ANGEBOTE_PASSWORD NOVA_ANGEBOTE_SERVICE_KEY \
       PROJEKT_ABLAGE_ROOT PROJEKT_ABLAGE_WEB 2>/dev/null || true

[ -d "$REPO" ] || { log "FEHLER Repository nicht gefunden: $REPO"; exit 1; }
command -v node >/dev/null 2>&1 || { log "FEHLER 'node' nicht im PATH. PATH=$PATH"; exit 1; }

# Beim Aufruf von Hand zusätzlich auf dem Bildschirm zeigen.
if [ -t 1 ]; then
  node "$REPO/scripts/projektablage.mjs" "$@" 2>&1 | tee -a "$LOG"
  STATUS=${PIPESTATUS[0]}
else
  OUTPUT="$(node "$REPO/scripts/projektablage.mjs" "$@" 2>&1)"
  STATUS=$?
  [ -n "$OUTPUT" ] && echo "$OUTPUT" >>"$LOG"
fi

if [ "$(wc -l <"$LOG")" -gt 4000 ]; then
  tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
exit "$STATUS"
