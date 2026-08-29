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
if [ -f "$ENV_FILE" ]; then
  # Eine Datei mit unpaarigem Anführungszeichen bricht beim Einlesen ab und lässt
  # alles darunter ungesetzt — ohne diese Prüfung sähe man nur den Folgefehler.
  if ! bash -n "$ENV_FILE" 2>/dev/null; then
    log "FEHLER $ENV_FILE ist syntaktisch fehlerhaft — meist ein nicht geschlossenes Anführungszeichen."
    log "       Prüfen mit: bash -n $ENV_FILE"
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$ENV_FILE"
fi
_file_dir="${NAS_BACKUP_DIR:-}"
[ -n "$_pre_dir" ] && NAS_BACKUP_DIR="$_pre_dir"
[ -n "$_pre_keep" ] && NAS_BACKUP_KEEP_DAYS="$_pre_keep"
export NAS_BACKUP_DIR NAS_BACKUP_KEEP_DAYS

# Ein aus der Umgebung geerbter Wert schlägt die Datei — praktisch beim Testen,
# aber eine Falle, wenn er aus einer vergessenen Shell-Zuweisung stammt und die
# frisch korrigierte Datei überstimmt. Deshalb wird er benannt.
if [ -n "$_pre_dir" ] && [ "$_pre_dir" != "$_file_dir" ]; then
  log "Hinweis: NAS_BACKUP_DIR kommt aus der Umgebung ($_pre_dir)"
  log "         und überschreibt den Wert aus $ENV_FILE ($_file_dir)."
  log "         Wenn das nicht gewollt ist: unset NAS_BACKUP_DIR"
fi

[ -d "$REPO" ] || { log "FEHLER Repository nicht gefunden: $REPO"; exit 1; }
command -v node >/dev/null 2>&1 || { log "FEHLER 'node' nicht im PATH. PATH=$PATH"; exit 1; }

if [ -z "${NAS_BACKUP_DIR:-}" ]; then
  log "FEHLER NAS_BACKUP_DIR nicht gesetzt. In $ENV_FILE eintragen, z. B.:"
  log "       export NAS_BACKUP_DIR=\"/Volumes/NAS/Backups/nova-works\""
  exit 1
fi

# ── Betriebsart ────────────────────────────────────────────────────────────
#
#   mount (Standard) – Ziel muss auf einem eingehängten Laufwerk liegen (NAS).
#   local            – Ziel ist bewusst ein Ordner auf der internen Platte,
#                      etwa ein synchronisierter OneDrive-Ordner.
#
# Beide Arten haben eigene Prüfungen; "local" ist keine Abschaltung der
# Kontrolle, sondern eine andere Kontrolle.
MODE="${NAS_BACKUP_MODE:-mount}"
if [ -z "${NAS_BACKUP_MODE:-}" ] && [ "${NAS_ALLOW_LOCAL:-0}" = "1" ]; then
  MODE="local"   # frühere Schreibweise, weiterhin gültig
fi
case "$MODE" in
  mount|local) ;;
  *) log "FEHLER NAS_BACKUP_MODE muss 'mount' oder 'local' sein, war: $MODE"; exit 1 ;;
esac

TARGET="${NAS_BACKUP_DIR%/}"
case "$TARGET" in
  /*) ;;
  *) log "FEHLER NAS_BACKUP_DIR muss ein absoluter Pfad sein: $NAS_BACKUP_DIR"; exit 1 ;;
esac

# Nächster Ordner, den es tatsächlich gibt, und wie viele Ebenen darunter fehlen.
PROBE="$TARGET"; LEVELS=0
while [ ! -d "$PROBE" ]; do
  PARENT="$(dirname "$PROBE")"
  [ "$PARENT" = "$PROBE" ] && break
  PROBE="$PARENT"; LEVELS=$((LEVELS + 1))
done

mountpoint_of() {
  df -P "$1" 2>/dev/null | awk 'NR==2 {for (i=6; i<=NF; i++) printf "%s%s", $i, (i<NF ? " " : "")}'
}
MOUNT="$(mountpoint_of "$PROBE")"

if [ "$MODE" = "mount" ]; then
  # Ein eingehängtes Laufwerk erkennt man daran, dass sein Mountpoint das Ziel
  # tatsächlich enthält: /Volumes/NAS umfasst /Volumes/NAS/Backups/...
  #
  # Fehlt das Laufwerk, bleibt als nächster vorhandener Ordner /Volumes übrig —
  # dessen Mountpoint ist auf macOS /System/Volumes/Data und umfasst das Ziel
  # gerade nicht. Ein Vergleich nur gegen "/" ginge hier fehl.
  EXTERN=1
  [ "$MOUNT" = "/" ] && EXTERN=0
  case "$TARGET/" in
    "$MOUNT"/*) ;;
    *) EXTERN=0 ;;
  esac

  if [ "$EXTERN" != "1" ]; then
    if [ -d "$TARGET" ]; then
      log "FEHLER $TARGET liegt nicht auf einem eingehängten Laufwerk (Mountpoint: $MOUNT)."
    else
      log "FEHLER $TARGET existiert nicht. Nächster vorhandener Ordner: $PROBE"
      log "       Dessen Mountpoint ist $MOUNT und umfasst das Ziel nicht — das Laufwerk ist nicht eingehängt."
    fi
    log "       Es wird nichts geschrieben. 'ls /Volumes' zeigt, was gerade eingehängt ist."
    log "       Soll bewusst auf die interne Platte gesichert werden:"
    log "       NAS_BACKUP_MODE=\"local\" in $ENV_FILE setzen."
    exit 1
  fi
else
  # Betriebsart local: kein Mount verlangt, dafür Schutz vor Tippfehlern und
  # vor Zielen, an denen ein Backup nichts verloren hat.
  if [ "$TARGET" = "$HOME" ] || [ "$TARGET" = "" ]; then
    log "FEHLER Als Ziel taugt weder / noch das Benutzerverzeichnis selbst: $NAS_BACKUP_DIR"
    exit 1
  fi
  case "$TARGET/" in
    "$REPO"/*)
      log "FEHLER Ziel liegt im Repository ($REPO). Das Backup landete sonst in der Versionsverwaltung."
      exit 1 ;;
    /tmp/*|/private/tmp/*|/var/folders/*)
      log "FEHLER Ziel liegt in einem temporären Verzeichnis: $TARGET"
      log "       Solche Ordner räumt das System weg — dort ist kein Backup sicher."
      exit 1 ;;
  esac
  if [ "$LEVELS" -gt 2 ]; then
    log "FEHLER Unterhalb von $PROBE müssten $LEVELS Ebenen neu angelegt werden."
    log "       Das deutet auf einen Tippfehler im Pfad. Übergeordneten Ordner erst anlegen"
    log "       oder NAS_BACKUP_DIR korrigieren."
    exit 1
  fi
fi

# Ab hier steht die Betriebsart fest; fehlende Unterordner darf das Skript anlegen.
if [ ! -d "$TARGET" ]; then
  if mkdir -p "$TARGET" 2>/dev/null; then
    log "Zielordner angelegt: $TARGET"
  else
    log "FEHLER Zielordner ließ sich nicht anlegen: $TARGET"
    exit 1
  fi
fi

if [ ! -w "$TARGET" ]; then
  log "FEHLER Zielordner ist nicht beschreibbar: $TARGET"
  exit 1
fi

NAS_BACKUP_DIR="$TARGET"; export NAS_BACKUP_DIR

log "Start [$MODE] → $NAS_BACKUP_DIR (Mountpoint: $MOUNT)"
if OUTPUT="$(node "$REPO/scripts/nas-backup.mjs" 2>&1)"; then
  log "OK $OUTPUT"
else
  log "FEHLER $OUTPUT"
  exit 1
fi

if [ "$(wc -l <"$LOG")" -gt 4000 ]; then
  tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
