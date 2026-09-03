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

SUCHORT="${PROTOKOLL_DOWNLOADS:-$HOME/Downloads}"

if [ -z "$QUELLE" ]; then
  # Erst nach Namen: das ist der Regelfall und kostet nichts.
  QUELLE="$(ls -t "$SUCHORT/"*[Ww]hats[Aa]pp*.zip 2>/dev/null | head -1 || true)"

  # Sonst hineinsehen. WhatsApp benennt den Export je nach Weg verschieden —
  # über "Teilen" heisst er oft nur nach der Gruppe, und beim Herunterladen
  # hängt der Browser eine Zählung an. Entscheidend ist nicht der Name, sondern
  # ob eine _chat.txt drin liegt. Geprüft werden die zehn neuesten Archive;
  # gelesen wird dabei nur das Inhaltsverzeichnis, nichts wird entpackt.
  if [ -z "$QUELLE" ]; then
    while IFS= read -r kandidat; do
      [ -n "$kandidat" ] || continue
      if unzip -l "$kandidat" 2>/dev/null | grep -q "_chat\.txt"; then
        QUELLE="$kandidat"
        echo "Gefunden:  Archiv ohne WhatsApp im Namen, enthält aber eine _chat.txt"
        break
      fi
    done <<EOF
$(ls -t "$SUCHORT/"*.zip 2>/dev/null | head -10)
EOF
  fi

  if [ -z "$QUELLE" ]; then
    echo "FEHLER Kein Chatexport in $SUCHORT gefunden." >&2
    echo "       Geprüft wurden Archive mit WhatsApp im Namen und die zehn" >&2
    echo "       neuesten ZIP-Dateien auf eine enthaltene _chat.txt." >&2
    echo "       Pfad mitgeben:  $0 ~/Downloads/\"WhatsApp Chat - Technik.zip\"" >&2
    exit 1
  fi
  echo "Export:    $QUELLE"
  echo "           $(date -r "$QUELLE" "+%d.%m.%Y %H:%M" 2>/dev/null || true), $(du -h "$QUELLE" 2>/dev/null | cut -f1)"
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

# Ging etwas schief, bleibt der entpackte Ordner liegen. Dort steht das, was
# gerettet werden kann: bei Rückgabewert 4 das fertige PDF, das nur nicht
# abgelegt wurde, bei 3 das HTML, das sich von Hand drucken lässt. Aufräumen
# hiesse hier, das Ergebnis wegzuwerfen.
if [ "$CODE" -ne 0 ]; then
  BEHALTEN=1
  echo
  case "$CODE" in
    4) echo "Das PDF ist erzeugt, aber nicht abgelegt — der Grund steht darüber." ;;
    3) echo "Kein PDF, aber das HTML ist fertig — der Grund steht darüber." ;;
    *) echo "Der Lauf endete mit Rückgabewert $CODE." ;;
  esac
  echo "Der entpackte Ordner bleibt deshalb liegen."
fi
exit "$CODE"
