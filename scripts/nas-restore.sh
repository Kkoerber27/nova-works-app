#!/usr/bin/env bash
#
# Spielt eine NAS-Sicherung zurück nach Supabase.
#
#   ./scripts/nas-restore.sh --liste                Sicherungen anzeigen
#   ./scripts/nas-restore.sh                        Probelauf mit der neuesten
#   ./scripts/nas-restore.sh --datum 2026-08-29     Probelauf mit dieser
#   ./scripts/nas-restore.sh --key nw_crew_planungen --schreiben
#
# Ohne --schreiben wird nichts verändert.
#
set -uo pipefail

REPO="${NOVA_REPO:-$HOME/nova-works-app}"
ENV_FILE="${NOVA_ENV_FILE:-$HOME/.nova-works/env}"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

_pre_dir="${NAS_BACKUP_DIR:-}"
if [ -f "$ENV_FILE" ]; then
  if ! bash -n "$ENV_FILE" 2>/dev/null; then
    echo "FEHLER $ENV_FILE ist syntaktisch fehlerhaft — meist ein nicht geschlossenes Anführungszeichen." >&2
    echo "       Prüfen mit: bash -n $ENV_FILE" >&2
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$ENV_FILE"
fi
_file_dir="${NAS_BACKUP_DIR:-}"
[ -n "$_pre_dir" ] && NAS_BACKUP_DIR="$_pre_dir"
export NAS_BACKUP_DIR

if [ -n "$_pre_dir" ] && [ "$_pre_dir" != "$_file_dir" ]; then
  echo "Hinweis: NAS_BACKUP_DIR kommt aus der Umgebung ($_pre_dir)" >&2
  echo "         und überschreibt den Wert aus $ENV_FILE ($_file_dir)." >&2
fi

command -v node >/dev/null 2>&1 || { echo "FEHLER 'node' nicht im PATH. PATH=$PATH" >&2; exit 1; }
[ -n "${NAS_BACKUP_DIR:-}" ] || { echo "FEHLER NAS_BACKUP_DIR nicht gesetzt. In $ENV_FILE eintragen." >&2; exit 1; }
[ -d "$NAS_BACKUP_DIR" ] || { echo "FEHLER Sicherungsordner nicht vorhanden: $NAS_BACKUP_DIR — NAS eingehängt?" >&2; exit 1; }

exec node "$REPO/scripts/nas-restore.mjs" "$@"
