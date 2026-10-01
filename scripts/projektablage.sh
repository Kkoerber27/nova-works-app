#!/usr/bin/env bash
#
# Projektablage: legt in der Angebots-App hochgeladene Dokumente im
# OneDrive-Projektordner ab (Angebote/<Nummer>_<Name>/<Unterordner>).
#
# Wird vom LaunchAgent de.nova-works.projektablage jede Minute aufgerufen.
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
# Der LaunchAgent startet mit einem kurzen PATH. Node aus nvm, Volta, fnm oder
# dem bei der Einrichtung gemerkten Pfad zusätzlich suchen.
if ! command -v node >/dev/null 2>&1; then
  for d in "${NOVA_NODE_DIR:-}" "$HOME/.volta/bin" "$HOME"/.nvm/versions/node/*/bin "$HOME"/.local/share/fnm/aliases/default/bin "$HOME"/Library/Application\ Support/fnm/aliases/default/bin; do
    if [ -n "$d" ] && [ -x "$d/node" ]; then PATH="$d:$PATH"; break; fi
  done
fi

# Im Terminal gesetzte Werte gelten, wenn die Datei für sie leer ist.
_pre_mail="${NOVA_ANGEBOTE_EMAIL:-}"; _pre_pw="${NOVA_ANGEBOTE_PASSWORD:-}"; _pre_root="${PROJEKT_ABLAGE_ROOT:-}"
if [ -f "$ENV_FILE" ]; then
  if ! bash -n "$ENV_FILE" 2>/dev/null; then
    log "FEHLER $ENV_FILE ist syntaktisch fehlerhaft — meist ein nicht geschlossenes Anführungszeichen."
    log "       Prüfen mit: bash -n $ENV_FILE"
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$ENV_FILE"
fi
[ -z "${NOVA_ANGEBOTE_EMAIL:-}" ] && NOVA_ANGEBOTE_EMAIL="$_pre_mail"
[ -z "${NOVA_ANGEBOTE_PASSWORD:-}" ] && NOVA_ANGEBOTE_PASSWORD="$_pre_pw"
[ -z "${PROJEKT_ABLAGE_ROOT:-}" ] && PROJEKT_ABLAGE_ROOT="$_pre_root"
export NOVA_ANGEBOTE_EMAIL NOVA_ANGEBOTE_PASSWORD NOVA_ANGEBOTE_SERVICE_KEY \
       PROJEKT_ABLAGE_ROOT PROJEKT_ABLAGE_WEB 2>/dev/null || true

[ -d "$REPO" ] || { log "FEHLER Repository nicht gefunden: $REPO"; exit 1; }
command -v node >/dev/null 2>&1 || { log "FEHLER 'node' nicht im PATH. PATH=$PATH"; exit 1; }

# Beim Aufruf von Hand zusätzlich auf dem Bildschirm zeigen.
if [ -t 1 ] || [ "${NOVA_SHOW:-}" = "1" ]; then
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
