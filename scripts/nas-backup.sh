#!/usr/bin/env bash
#
# Nächtliche Sicherung der NOVA-WORKS-Daten aus Supabase auf das NAS.
#
# Wird vom LaunchAgent de.nova-works.nas-backup aufgerufen. Zum Testen von Hand:
#   ./scripts/nas-backup.sh
#
set -uo pipefail

REPO="${NOVA_REPO:-$HOME/nova-works-app}"
LOG="${NOVA_LOG:-$HOME/.nova-works/nas-backup.log}"
ENV_FILE="${NOVA_ENV_FILE:-$HOME/.nova-works/env}"

mkdir -p "$(dirname "$LOG")"
log() { echo "[$(date "+%Y-%m-%d %H:%M:%S")] $*" >>"$LOG"; }

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Werte, die beim Aufruf schon gesetzt waren, gewinnen gegen die Datei. Sonst
# überschreibt ein leeres "export NAS_BACKUP_DIR=" aus der Vorlage genau das,
# was jemand gerade zum Testen in der Shell gesetzt hat.
_pre_dir="${NAS_BACKUP_DIR:-}"; _pre_keep="${NAS_BACKUP_KEEP_DAYS:-}"
# shellcheck source=/dev/null
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
[ -n "$_pre_dir" ] && NAS_BACKUP_DIR="$_pre_dir"
[ -n "$_pre_keep" ] && NAS_BACKUP_KEEP_DAYS="$_pre_keep"
export NAS_BACKUP_DIR NAS_BACKUP_KEEP_DAYS

[ -d "$REPO" ] || { log "FEHLER Repository nicht gefunden: $REPO"; exit 1; }
command -v node >/dev/null 2>&1 || { log "FEHLER 'node' nicht im PATH. PATH=$PATH"; exit 1; }

if [ -z "${NAS_BACKUP_DIR:-}" ]; then
  log "FEHLER NAS_BACKUP_DIR nicht gesetzt. In $ENV_FILE eintragen, z. B.:"
  log "       export NAS_BACKUP_DIR=\"/Volumes/NAS/Backups/nova-works\""
  exit 1
fi

# Der wichtigste Test: Liegt das Ziel wirklich auf einem eingehängten Laufwerk?
# Ist das NAS nicht verbunden, existiert der Pfad meist gar nicht — und ein
# blindes mkdir würde eine Attrappe auf der internen Platte anlegen, die
# monatelang unbemerkt "Backups" sammelt.
if [ ! -d "$NAS_BACKUP_DIR" ]; then
  log "FEHLER Zielordner existiert nicht: $NAS_BACKUP_DIR"
  log "       NAS vermutlich nicht eingehängt. Es wird nichts geschrieben."
  exit 1
fi
if [ ! -w "$NAS_BACKUP_DIR" ]; then
  log "FEHLER Zielordner ist nicht beschreibbar: $NAS_BACKUP_DIR"
  exit 1
fi

MOUNT="$(df -P "$NAS_BACKUP_DIR" 2>/dev/null | awk 'NR==2 {for (i=6; i<=NF; i++) printf "%s%s", $i, (i<NF ? " " : "")}')"
if [ "$MOUNT" = "/" ] && [ "${NAS_ALLOW_LOCAL:-0}" != "1" ]; then
  log "FEHLER $NAS_BACKUP_DIR liegt auf der internen Platte (Mountpoint /), nicht auf dem NAS."
  log "       Das ist fast immer ein nicht eingehängtes Netzlaufwerk. Es wird nichts geschrieben."
  log "       Ist es doch gewollt: NAS_ALLOW_LOCAL=1 in $ENV_FILE setzen."
  exit 1
fi

log "Start → $NAS_BACKUP_DIR (Mountpoint: $MOUNT)"
if OUTPUT="$(node "$REPO/scripts/nas-backup.mjs" 2>&1)"; then
  log "OK $OUTPUT"
else
  log "FEHLER $OUTPUT"
  exit 1
fi

if [ "$(wc -l <"$LOG")" -gt 4000 ]; then
  tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
