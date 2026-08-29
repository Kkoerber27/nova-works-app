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

# Der wichtigste Test: Hängt unter dem Ziel wirklich ein Laufwerk?
#
# Entschieden wird am nächsten Ordner, den es tatsächlich gibt. Ist das NAS nicht
# verbunden, existiert unterhalb von /Volumes nichts — und /Volumes selbst liegt
# auf der internen Platte. Ein blindes mkdir würde dort eine Attrappe anlegen,
# die monatelang unbemerkt "Backups" sammelt.
mountpoint_of() {
  df -P "$1" 2>/dev/null | awk 'NR==2 {for (i=6; i<=NF; i++) printf "%s%s", $i, (i<NF ? " " : "")}'
}

PROBE="$NAS_BACKUP_DIR"
while [ ! -d "$PROBE" ]; do
  PARENT="$(dirname "$PROBE")"
  [ "$PARENT" = "$PROBE" ] && break
  PROBE="$PARENT"
done
MOUNT="$(mountpoint_of "$PROBE")"

# Ein eingehängtes Laufwerk erkennt man daran, dass sein Mountpoint das Ziel
# tatsächlich enthält: /Volumes/NAS umfasst /Volumes/NAS/Backups/...
#
# Fehlt das Laufwerk, bleibt als nächster vorhandener Ordner /Volumes übrig —
# und dessen Mountpoint ist auf macOS /System/Volumes/Data, also gerade NICHT im
# Ziel enthalten. Ein Vergleich nur gegen "/" ginge hier fehl: /Volumes liegt auf
# der Datenpartition, nicht auf der Systemwurzel.
EXTERN=1
[ "$MOUNT" = "/" ] && EXTERN=0
case "$NAS_BACKUP_DIR/" in
  "$MOUNT"/*) ;;
  *) EXTERN=0 ;;
esac

if [ "$EXTERN" != "1" ] && [ "${NAS_ALLOW_LOCAL:-0}" != "1" ]; then
  if [ -d "$NAS_BACKUP_DIR" ]; then
    log "FEHLER $NAS_BACKUP_DIR liegt nicht auf einem eingehängten Laufwerk (Mountpoint: $MOUNT)."
  else
    log "FEHLER $NAS_BACKUP_DIR existiert nicht. Nächster vorhandener Ordner: $PROBE"
    log "       Dessen Mountpoint ist $MOUNT und umfasst das Ziel nicht — das Laufwerk ist nicht eingehängt."
  fi
  log "       Es wird nichts geschrieben. 'ls /Volumes' zeigt, was gerade eingehängt ist."
  log "       Ist es doch gewollt: NAS_ALLOW_LOCAL=1 in $ENV_FILE setzen."
  exit 1
fi

# Ab hier steht fest, dass unter dem Ziel ein eingehängtes Laufwerk liegt.
# Fehlende Unterordner darf das Skript dann selbst anlegen.
if [ ! -d "$NAS_BACKUP_DIR" ]; then
  if mkdir -p "$NAS_BACKUP_DIR" 2>/dev/null; then
    log "Zielordner angelegt: $NAS_BACKUP_DIR (unterhalb von $MOUNT)"
  else
    log "FEHLER Zielordner ließ sich nicht anlegen: $NAS_BACKUP_DIR"
    exit 1
  fi
fi

if [ ! -w "$NAS_BACKUP_DIR" ]; then
  log "FEHLER Zielordner ist nicht beschreibbar: $NAS_BACKUP_DIR"
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
