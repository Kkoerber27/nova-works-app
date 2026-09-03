#!/usr/bin/env bash
#
# Macht aus einem WhatsApp-Chatexport in einem Zug das Scheinwerfer-Protokoll
# und legt es im Projektordner ab.
#
#   ./scripts/protokoll-whatsapp.sh
#   ./scripts/protokoll-whatsapp.sh ~/Downloads/"WhatsApp Chat - Technik.zip"
#   ./scripts/protokoll-whatsapp.sh --tag 2026-09-01
#   ./scripts/protokoll-whatsapp.sh --projekt 26-0032 --objekt "Glücksgefühle Festival"
#
# Ohne Pfad wird der neueste WhatsApp-Export in ~/Downloads genommen.
# Projektnummer und Objekt kommen aus ~/.nova-works/env, falls dort gesetzt.
#
# Warum als Skript und nicht im Chat: Ein Export mit Medien ist schnell fünfzig
# Megabyte. Er muss diesen Rechner nie verlassen — hier liegen die Bilder, hier
# liegt der synchronisierte Projektordner. Hochgeladen wird nichts.
#
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${NOVA_ENV_FILE:-$HOME/.nova-works/env}"

# ------------------------------------------------------------------- Eingabe

QUELLE=""
TAG=""
PROJEKT="${PROTOKOLL_PROJEKT:-}"
OBJEKT="${PROTOKOLL_OBJEKT:-}"
BEHALTEN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --tag)     TAG="${2:-}"; shift 2 ;;
    --projekt) PROJEKT="${2:-}"; shift 2 ;;
    --objekt)  OBJEKT="${2:-}"; shift 2 ;;
    --behalten) BEHALTEN=1; shift ;;   # entpackten Ordner nicht löschen
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "FEHLER Unbekannte Angabe: $1" >&2; exit 2 ;;
    *)  QUELLE="$1"; shift ;;
  esac
done

# env-Datei nur lesen, wenn sie brauchbar ist — ein offenes Anführungszeichen
# läse sonst die Hälfte ein und der Lauf liefe mit leerer Projektnummer weiter.
if [ -f "$ENV_FILE" ] && [ -z "$PROJEKT$OBJEKT" ]; then
  if bash -n "$ENV_FILE" 2>/dev/null; then
    # shellcheck source=/dev/null
    . "$ENV_FILE"
    PROJEKT="${PROJEKT:-${PROTOKOLL_PROJEKT:-}}"
    OBJEKT="${OBJEKT:-${PROTOKOLL_OBJEKT:-}}"
  else
    echo "WARNUNG $ENV_FILE ist syntaktisch fehlerhaft und wird übergangen." >&2
    echo "        Prüfen mit: bash -n $ENV_FILE" >&2
  fi
fi

command -v node >/dev/null 2>&1 || { echo "FEHLER 'node' nicht im PATH." >&2; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "FEHLER 'unzip' nicht im PATH." >&2; exit 1; }

# ------------------------------------------------------------- Export finden

if [ -z "$QUELLE" ]; then
  # Neuester WhatsApp-Export in ~/Downloads. Bewusst nur dort und bewusst nur
  # nach Namensmuster: Irgendein beliebiges ZIP zu entpacken wäre geraten.
  QUELLE="$(ls -t "$HOME/Downloads/"*[Ww]hats[Aa]pp*.zip 2>/dev/null | head -1 || true)"
  if [ -z "$QUELLE" ]; then
    echo "FEHLER Kein WhatsApp-Export in ~/Downloads gefunden." >&2
    echo "       Pfad mitgeben:  $0 ~/Downloads/\"WhatsApp Chat - Technik.zip\"" >&2
    exit 1
  fi
  echo "Export:    $QUELLE"
fi

if [ ! -e "$QUELLE" ]; then
  echo "FEHLER Nicht gefunden: $QUELLE" >&2
  exit 1
fi

# ------------------------------------------------------------------ Entpacken

AUFRAEUMEN=""
if [ -d "$QUELLE" ]; then
  ORDNER="$QUELLE"
else
  ORDNER="$(mktemp -d "${TMPDIR:-/tmp}/protokoll-wa.XXXXXX")"
  AUFRAEUMEN="$ORDNER"
  if ! unzip -q -o "$QUELLE" -d "$ORDNER"; then
    echo "FEHLER Export liess sich nicht entpacken: $QUELLE" >&2
    rm -rf "$ORDNER"
    exit 1
  fi
  # Manche Exporte stecken alles in einen Unterordner.
  if [ ! -f "$ORDNER/_chat.txt" ]; then
    TIEFER="$(find "$ORDNER" -maxdepth 2 -name "_chat.txt" -print -quit 2>/dev/null)"
    [ -n "$TIEFER" ] && ORDNER="$(dirname "$TIEFER")"
  fi
  echo "Entpackt:  $(du -sh "$ORDNER" 2>/dev/null | cut -f1) in $ORDNER"
fi

schluss() {
  if [ -n "$AUFRAEUMEN" ] && [ "$BEHALTEN" -eq 0 ]; then
    rm -rf "$AUFRAEUMEN"
  elif [ -n "$AUFRAEUMEN" ]; then
    echo "Entpackter Ordner bleibt liegen: $AUFRAEUMEN"
  fi
}
trap schluss EXIT

# --------------------------------------------------------------------- Lauf

DATEN="$ORDNER/daten.json"

EIN=("$ORDNER")
[ -n "$OBJEKT" ]  && EIN+=(--objekt "$OBJEKT")
[ -n "$PROJEKT" ] && EIN+=(--projekt "$PROJEKT")
[ -n "$TAG" ]     && EIN+=(--tag "$TAG")
EIN+=(--out "$DATEN")

if [ -z "$TAG" ]; then
  echo "Zeitraum:  der ganze Export — für einen Tag:  --tag JJJJ-MM-TT"
fi

echo
PROTOKOLL_KETTE=1 node "$REPO/scripts/whatsapp-import.mjs" "${EIN[@]}" || exit $?

AUS=("$DATEN" --pdf)
# Ohne Projektnummer gibt es keinen Ordner, in den abgelegt werden könnte. Dann
# entsteht das PDF neben der Datendatei und der Pfad steht unten.
if [ -n "$PROJEKT" ]; then
  AUS+=(--ablegen)
else
  echo
  echo "HINWEIS Keine Projektnummer — es wird nicht abgelegt."
  echo "        Mit --projekt 26-0032 oder PROTOKOLL_PROJEKT in $ENV_FILE."
  # Das PDF entsteht neben der Datendatei und muss den Export überleben, der
  # sonst gleich gelöscht würde. Bewusst nicht auf den Schreibtisch: ungefragt
  # etwas dorthin zu legen ist eine Anmassung, und der Pfad steht unten.
  BEHALTEN=1
fi

echo
node "$REPO/scripts/protokoll.mjs" "${AUS[@]}"
CODE=$?

if [ "$CODE" -eq 4 ]; then
  echo
  echo "Das PDF ist erzeugt, aber nicht abgelegt — der Grund steht darüber."
  echo "Der entpackte Ordner bleibt deshalb liegen."
  BEHALTEN=1
fi
exit "$CODE"
