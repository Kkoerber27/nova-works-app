#!/usr/bin/env bash
#
# Wachhund: merkt, wenn ein Hintergrundjob sich nicht mehr meldet.
#
#   ./scripts/wachhund.sh            # prüfen und bei Bedarf melden
#   ./scripts/wachhund.sh --zeigen   # nur anzeigen, nichts melden
#
# Warum zusätzlich zur Meldung in den Jobs selbst: Der schlimmste Ausfall ist
# der, bei dem das Jobskript gar nicht erst startet. Genau das ist passiert —
# der Ordner stand auf einem Branch ohne scripts/, launchd fand nichts, und die
# Rechnungsablage schwieg zehn Tage. Ein Fehler, den das Skript selbst meldet,
# setzt voraus, dass das Skript läuft. Dieser hier setzt nichts voraus außer
# sich selbst.
#
set -uo pipefail

SELF="${BASH_SOURCE[0]}"
while [ -L "$SELF" ]; do
  LINK="$(readlink "$SELF")"
  case "$LINK" in
    /*) SELF="$LINK" ;;
    *)  SELF="$(dirname "$SELF")/$LINK" ;;
  esac
done
HIER="$(cd "$(dirname "$SELF")" && pwd)"
ENV_FILE="${NOVA_ENV_FILE:-$HOME/.nova-works/env}"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -f "$ENV_FILE" ] && bash -n "$ENV_FILE" 2>/dev/null; then
  # shellcheck source=/dev/null
  . "$ENV_FILE"
fi

# shellcheck source=/dev/null
. "$HIER/lib/meldung.sh"

# Job:Stunden — wie lange ein Job schweigen darf, bevor es auffällig wird.
# Großzügig gewählt: lieber einmal zu spät melden als bei jedem Neustart.
#   rechnungsablage läuft alle 10–15 Minuten  → 2 Stunden
#   nas-backup und protokoll laufen nachts    → 36 Stunden
JOBS="${NOVA_WACHHUND_JOBS:-rechnungsablage:2 nas-backup:36 protokoll:36}"

NUR_ZEIGEN=0
[ "${1:-}" = "--zeigen" ] && NUR_ZEIGEN=1

jetzt="$(date +%s)"
auffaellig=0

for eintrag in $JOBS; do
  job="${eintrag%%:*}"
  stunden="${eintrag##*:}"
  case "$stunden" in (*[!0-9]*|"") stunden=24 ;; esac
  grenze=$(( stunden * 3600 ))
  datei="$NOVA_STATUS_DIR/$job.status"

  # Beim ersten Lauf gibt es noch keinen Stand. Dann wird einer angelegt und
  # nicht gemeldet — sonst schlägt der Wachhund gleich bei der Einrichtung an.
  if [ ! -f "$datei" ]; then
    [ "$NUR_ZEIGEN" = "1" ] || _status_schreiben "$job" "$jetzt" 0 0
    printf '%-18s noch kein Stand — Frist läuft ab jetzt\n' "$job"
    continue
  fi

  letzter="$(_status_lesen "$job" letzter_erfolg)"
  serie="$(_status_lesen "$job" fehler_serie)"
  gemeldet="$(_status_lesen "$job" gemeldet_seit)"
  alter=$(( jetzt - letzter ))
  alter_h=$(( alter / 3600 ))

  if [ "$letzter" = "0" ] || [ "$alter" -gt "$grenze" ]; then
    auffaellig=1
    printf '%-18s STUMM seit %sh (erlaubt: %sh, Fehlerserie: %s)\n' \
      "$job" "$alter_h" "$stunden" "$serie"
    [ "$NUR_ZEIGEN" = "1" ] && continue

    abstand=$(( NOVA_ALERT_WIEDERHOLUNG_H * 3600 ))
    if [ "$gemeldet" = "0" ] || [ $((jetzt - gemeldet)) -ge "$abstand" ]; then
      meldung_senden "Paperwork: $job meldet sich nicht" \
        "Seit ${alter_h} Stunden kein erfolgreicher Lauf (erlaubt sind ${stunden}). Läuft der LaunchAgent noch, und zeigt er auf den richtigen Ordner?"
      _status_schreiben "$job" "$letzter" "$serie" "$jetzt"
    fi
  else
    printf '%-18s ok, letzter Erfolg vor %sh\n' "$job" "$alter_h"
  fi
done

exit "$auffaellig"
