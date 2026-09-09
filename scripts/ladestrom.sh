#!/usr/bin/env bash
#
# Ladestrom-Abrechnung für einen Monat erzeugen.
#
#   ./scripts/ladestrom.sh --monat "Juni 2026" --sessions @sessions.json
#
# Persönliche Angaben und der Erstattungssatz stehen in ~/.nova-works/env,
# nicht im Repository — das ist öffentlich.
#
set -uo pipefail

REPO="${NOVA_REPO:-$HOME/nova-works-app}"
ENV_FILE="${NOVA_ENV_FILE:-$HOME/.nova-works/env}"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -f "$ENV_FILE" ]; then
  if ! bash -n "$ENV_FILE" 2>/dev/null; then
    echo "FEHLER $ENV_FILE ist syntaktisch fehlerhaft — meist ein nicht geschlossenes Anführungszeichen." >&2
    echo "       Prüfen mit: bash -n $ENV_FILE" >&2
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$ENV_FILE"
fi

command -v python3 >/dev/null 2>&1 || { echo "FEHLER 'python3' nicht im PATH. PATH=$PATH" >&2; exit 1; }
python3 -c "import reportlab, PIL" 2>/dev/null || {
  echo "FEHLER reportlab oder Pillow fehlen. Einmalig nachinstallieren:" >&2
  echo "       python3 -m pip install --user reportlab pillow" >&2
  exit 1
}

exec python3 "$REPO/scripts/ladestrom/erstelle_abrechnung.py" "$@"
