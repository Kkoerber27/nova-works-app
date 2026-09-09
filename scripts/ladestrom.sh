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

# Das Repository liegt dort, wo dieses Skript liegt — nicht an einem geratenen
# Pfad. So läuft es auf jedem Rechner, egal wohin geklont wurde.
SELF="${BASH_SOURCE[0]}"
while [ -L "$SELF" ]; do
  LINK="$(readlink "$SELF")"
  case "$LINK" in
    /*) SELF="$LINK" ;;
    *)  SELF="$(dirname "$SELF")/$LINK" ;;
  esac
done
REPO="${NOVA_REPO:-$(cd "$(dirname "$SELF")/.." && pwd)}"
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

# Homebrew-Python verweigert seit PEP 668 Installationen ins System. Deshalb
# eine eigene Umgebung im Projekt, die nichts anderes berührt. Ist keine da,
# wird die des Systems genommen — dort kann reportlab ja schon liegen.
VENV="$REPO/scripts/ladestrom/.venv"
if [ -x "$VENV/bin/python3" ]; then
  PY="$VENV/bin/python3"
else
  PY="python3"
fi

if ! "$PY" -c "import reportlab, PIL" 2>/dev/null; then
  echo "FEHLER reportlab oder Pillow fehlen. Einmalig einrichten:" >&2
  echo >&2
  echo "       python3 -m venv \"$VENV\"" >&2
  echo "       \"$VENV/bin/pip\" install reportlab pillow" >&2
  echo >&2
  echo "       Danach findet dieses Skript sie von selbst." >&2
  exit 1
fi

exec "$PY" "$REPO/scripts/ladestrom/erstelle_abrechnung.py" "$@"
