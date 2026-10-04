#!/usr/bin/env bash
# =========================================================================
#  NOVA WORKS - Upload-Paket bauen
#
#      ./werkzeug/paket-bauen.sh            ohne die Originalfotos
#      ./werkzeug/paket-bauen.sh --alles    mit den Originalfotos (+74 MB)
#
#  Legt eine ZIP-Datei an, deren Inhalt eins zu eins in das
#  Wurzelverzeichnis des Webspace gehoert. Nicht den Ordner hochladen,
#  sondern das, was darin liegt.
#
#  Drei Dinge gehen bewusst NICHT mit:
#    inhalt/zugang.php      die Pruefsumme des lokalen Passworts. Auf dem
#                           Server wird ein eigenes vergeben.
#    inhalt/sicherungen/    lokale Sicherungen, auf dem Server entstehen
#                           eigene.
#    inhalt/originale/      74 MB Kamerafotos, die nie ausgeliefert
#                           werden. Nur noetig, um Bildfassungen neu zu
#                           erzeugen - nachreichbar.
# =========================================================================

set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WURZEL="$HIER/.."
SEITE="$WURZEL/site"
ALLES=0
[ "${1:-}" = "--alles" ] && ALLES=1

if ! command -v zip >/dev/null 2>&1; then
  echo "  zip ist nicht installiert. Auf dem Mac: brew install zip" >&2
  exit 1
fi

# Erst die Abnahme. Was dort fehlt, gehoert nicht in ein Paket.
echo
if ! php "$HIER/vor-dem-livegang.php"; then
  echo "  Paket NICHT gebaut - erst die fehlenden Punkte erledigen."
  echo "  Trotzdem bauen (etwa fuer einen Testordner):  PRUEFUNG_EGAL=1 $0 ${1:-}"
  echo
  [ "${PRUEFUNG_EGAL:-0}" = "1" ] || exit 1
  echo "  PRUEFUNG_EGAL=1 gesetzt - es wird trotzdem gebaut."
  echo
fi

STAND="$(cd "$WURZEL" && git log --oneline -1 2>/dev/null | cut -c1-7 || echo ohnegit)"
ZIEL="$WURZEL/nova-works-$(date +%Y%m%d-%H%M)-$STAND.zip"
rm -f "$ZIEL"

AUS=(
  -x "inhalt/zugang.php"
  -x "inhalt/sicherungen/*"
  -x "inhalt/inhalt.json.vorher"
  -x "*/.DS_Store"
  -x ".DS_Store"
)
[ "$ALLES" -eq 0 ] && AUS+=( -x "inhalt/originale/*" )

# Aus site/ heraus packen, damit im Archiv keine Ebene "site/" steckt.
# Das ist der haeufigste Upload-Fehler: Der Ordner landet im Webspace
# und die Seite liegt eine Ebene zu tief.
( cd "$SEITE" && zip -q -r -9 "$ZIEL" . "${AUS[@]}" )

GROESSE="$(du -h "$ZIEL" | cut -f1)"
ANZAHL="$(unzip -l "$ZIEL" | tail -1 | awk '{print $2}')"

cat <<ENDE

  Paket gebaut
  ------------------------------------------------------------------
  Datei     $(basename "$ZIEL")
  Groesse   $GROESSE
  Dateien   $ANZAHL
  Originale $([ "$ALLES" -eq 1 ] && echo "enthalten" || echo "nicht enthalten (--alles nimmt sie mit)")

  Der INHALT des Archivs gehoert in das Wurzelverzeichnis des
  Webspace - nicht das Archiv selbst, und keinen Ordner darum.

ENDE

# Zur Sicherheit: Liegen .htaccess und .user.ini wirklich drin? Viele
# Packprogramme lassen Punkt-Dateien weg, und ohne sie fehlen auf dem
# Server alle Weiterleitungen und der Schutz der Ordner.
echo "  Punkt-Dateien im Archiv:"
unzip -l "$ZIEL" | grep -E '/\.|^\s+[0-9]+.*\s\.' | awk '{print "    " $4}' | sort || true
echo
