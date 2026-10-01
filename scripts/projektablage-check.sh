#!/usr/bin/env bash
#
# Projektablage prüfen: Zustand des Hintergrunddienstes, letzte Protokollzeilen
# und eine Runde im Vordergrund mit ausführlicher Ausgabe (legt wirklich ab).
#
#   ./scripts/projektablage-check.sh
#
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="de.nova-works.projektablage"
LOG="$HOME/.nova-works/projektablage.log"

echo "== Hintergrunddienst"
if launchctl print "gui/$(id -u)/$LABEL" >/tmp/projektablage-check.$$ 2>&1; then
  grep -E "^\s*(state|last exit code|runs|path) =" /tmp/projektablage-check.$$ | sed 's/^\s*/  /'
  grep -A3 "environment = {" /tmp/projektablage-check.$$ | grep PATH | sed 's/^\s*/  /'
else
  echo "  nicht eingerichtet – ./scripts/install-projektablage.sh ausführen"
fi
rm -f /tmp/projektablage-check.$$

echo
echo "== Letzte Zeilen aus $LOG"
if [ -f "$LOG" ]; then grep -v "andere Runde läuft noch" "$LOG" | tail -n 15 | sed 's/^/  /'; else echo "  (noch kein Protokoll – der Dienst ist nie gelaufen)"; fi

echo
echo "== Sperrdatei"
LOCK="$HOME/.nova-works/projektablage.lock"
if [ -f "$LOCK" ]; then
  ls -l "$LOCK" | sed 's/^/  /'
  LPID="$(cat "$LOCK" 2>/dev/null)"
  if [ -n "$LPID" ] && ps -p "$LPID" >/dev/null 2>&1; then
    echo "  Prozess $LPID läuft: $(ps -p "$LPID" -o etime=,command= | cut -c1-120)"
  else
    echo "  verwaist (kein Prozess $LPID) – wird bei der nächsten Runde übernommen"
  fi
else echo "  keine"; fi

echo
echo "== Eine Runde jetzt im Vordergrund"
NOVA_SHOW=1 "$REPO/scripts/projektablage.sh" --verbose
echo
echo "Fertig. Diese ganze Ausgabe bitte kopieren und schicken, falls noch etwas hängt."
