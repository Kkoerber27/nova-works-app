#!/usr/bin/env bash
#
# Meldewege für die Hintergrundjobs.
#
# Wird von den Job-Skripten eingebunden:
#
#   . "$(dirname "$0")/lib/meldung.sh"
#   meldung_erfolg rechnungsablage
#   meldung_fehler rechnungsablage "claude endete mit Code 1"
#
# Hintergrund: Ein Job, der still scheitert, scheitert unbegrenzt lange. Die
# Rechnungsablage hat zehn Tage lang alle zehn Minuten denselben Fehler ins
# Protokoll geschrieben, ohne dass es jemandem auffiel. Protokolle liest man
# erst, wenn man schon weiß, dass etwas kaputt ist.
#
# Gemeldet wird deshalb nicht jeder einzelne Fehlschlag — das wäre dasselbe
# Rauschen in lauter —, sondern eine Serie: mehrere Fehlschläge hintereinander,
# dann eine Meldung, danach höchstens noch eine pro Tag. Und eine Entwarnung,
# wenn es wieder läuft.

NOVA_STATUS_DIR="${NOVA_STATUS_DIR:-$HOME/.nova-works/status}"
NOVA_ALARM_LOG="${NOVA_ALARM_LOG:-$HOME/.nova-works/alarm.log}"

# Ab wie vielen Fehlschlägen hintereinander gemeldet wird.
NOVA_ALERT_AB="${NOVA_ALERT_AB:-3}"
# Wie viele Stunden Ruhe zwischen zwei Meldungen zum selben anhaltenden Fehler.
NOVA_ALERT_WIEDERHOLUNG_H="${NOVA_ALERT_WIEDERHOLUNG_H:-24}"

_jetzt() { date +%s; }
_zeit() { date "+%Y-%m-%d %H:%M:%S"; }

_status_datei() { echo "$NOVA_STATUS_DIR/$1.status"; }

# Liest einen Wert aus der Statusdatei. Bewusst zeilenweise geparst und nicht
# eingebunden: Die Datei soll Daten sein, nicht ausführbarer Code.
_status_lesen() {
  local datei schluessel zeile
  datei="$(_status_datei "$1")"; schluessel="$2"
  [ -f "$datei" ] || { echo "0"; return; }
  while IFS='=' read -r k v; do
    if [ "$k" = "$schluessel" ]; then
      case "$v" in (*[!0-9]*|"") echo "0" ;; (*) echo "$v" ;; esac
      return
    fi
  done <"$datei"
  echo "0"
}

_status_schreiben() {
  local datei
  datei="$(_status_datei "$1")"
  mkdir -p "$NOVA_STATUS_DIR" || return 0
  printf 'letzter_erfolg=%s\nfehler_serie=%s\ngemeldet_seit=%s\n' \
    "$2" "$3" "$4" >"$datei.tmp" && mv "$datei.tmp" "$datei"
}

# Verschickt eine Meldung. Der Weg hängt davon ab, was eingerichtet ist:
#
#   NOVA_ALERT_CMD   Pfad zu einem Programm, das "<Betreff>" "<Text>" bekommt.
#                    Dort gehört hin, was Sie wirklich sehen — Pushover, ntfy,
#                    eine Mail. Ohne das bleibt es bei der Mitteilung auf dem
#                    Bildschirm, und die sieht an einem Rechner im Schrank
#                    niemand.
#
# Ins Alarmprotokoll geht es in jedem Fall.
meldung_senden() {
  local betreff text
  betreff="$1"; text="$2"

  mkdir -p "$(dirname "$NOVA_ALARM_LOG")" 2>/dev/null || true
  echo "[$(_zeit)] $betreff — $text" >>"$NOVA_ALARM_LOG" 2>/dev/null || true

  if [ -n "${NOVA_ALERT_CMD:-}" ] && [ -x "${NOVA_ALERT_CMD%% *}" ]; then
    "$NOVA_ALERT_CMD" "$betreff" "$text" >>"$NOVA_ALARM_LOG" 2>&1 || \
      echo "[$(_zeit)] HINWEIS NOVA_ALERT_CMD endete mit Fehler" >>"$NOVA_ALARM_LOG"
    return 0
  fi

  if command -v osascript >/dev/null 2>&1; then
    # Anführungszeichen im Text würden das AppleScript zerlegen.
    local b="${betreff//\"/\'}" t="${text//\"/\'}"
    osascript -e "display notification \"$t\" with title \"$b\"" >/dev/null 2>&1 || true
  fi
}

# Ein Lauf ist gut gegangen.
meldung_erfolg() {
  local job gemeldet
  job="$1"
  gemeldet="$(_status_lesen "$job" gemeldet_seit)"
  if [ "$gemeldet" != "0" ]; then
    meldung_senden "Paperwork: $job läuft wieder" \
      "Der Job war gestört und hat gerade wieder erfolgreich durchlaufen."
  fi
  _status_schreiben "$job" "$(_jetzt)" 0 0
}

# Ein Lauf ist schiefgegangen.
meldung_fehler() {
  local job grund serie gemeldet letzter jetzt abstand
  job="$1"; grund="${2:-ohne nähere Angabe}"
  jetzt="$(_jetzt)"
  letzter="$(_status_lesen "$job" letzter_erfolg)"
  serie="$(_status_lesen "$job" fehler_serie)"
  gemeldet="$(_status_lesen "$job" gemeldet_seit)"
  serie=$((serie + 1))

  if [ "$serie" -ge "$NOVA_ALERT_AB" ]; then
    abstand=$(( NOVA_ALERT_WIEDERHOLUNG_H * 3600 ))
    if [ "$gemeldet" = "0" ] || [ $((jetzt - gemeldet)) -ge "$abstand" ]; then
      local wort="Fehlschläge hintereinander"
      [ "$serie" = "1" ] && wort="Fehlschlag"
      meldung_senden "Paperwork: $job scheitert" \
        "$serie $wort. Zuletzt: $grund"
      gemeldet="$jetzt"
    fi
  fi

  _status_schreiben "$job" "$letzter" "$serie" "$gemeldet"
}

# Hängt sich ans Ende des Skripts: Egal über welchen Weg es endet — sauber,
# per exit mitten im Ablauf oder durch einen Abbruch —, der Ausgang wird
# gezählt. Das ist der Grund für den trap statt einzelner Aufrufe: Ein Skript
# mit acht Abbruchstellen verliert sonst früher oder später eine davon.
#
#   meldung_ueberwachen nas-backup
#
meldung_ueberwachen() {
  _meldung_job="$1"
  _meldung_bei_ende() {
    local code=$?
    if [ "$code" -eq 0 ]; then
      meldung_erfolg "$_meldung_job"
    else
      meldung_fehler "$_meldung_job" "Lauf endete mit Code $code"
    fi
  }
  trap _meldung_bei_ende EXIT
}
