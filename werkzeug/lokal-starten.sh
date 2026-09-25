#!/usr/bin/env bash
# =========================================================================
#  NOVA WORKS - Seite und Backend lokal starten
#
#      ./werkzeug/lokal-starten.sh
#
#  Egal, in welchem Verzeichnis man gerade steht: Das Skript sucht sich
#  seinen eigenen Ort und geht von dort aus. Genau daran ist es beim
#  ersten Versuch gescheitert - ein cd zu viel, und der Server lief im
#  Home-Verzeichnis und lieferte nur 404er.
#
#  Die -d-Angaben sind nötig, weil der eingebaute Server von PHP die
#  Datei site/.user.ini nicht liest. Auf dem Webspace gelten die Werte
#  von dort, hier müssen sie mitgegeben werden.
# =========================================================================

set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SEITE="$HIER/../site"
PORT="${1:-4174}"

if ! command -v php >/dev/null 2>&1; then
  cat <<'ENDE'

  PHP ist nicht installiert.

  macOS liefert seit Monterey keines mehr mit. Nachinstallieren:

      brew install php

  Falls auch Homebrew fehlt, steht der Einzeiler dafür auf brew.sh.

ENDE
  exit 1
fi

if [ ! -f "$SEITE/index.php" ]; then
  echo "  site/index.php nicht gefunden - liegt dieses Skript noch in werkzeug/?" >&2
  exit 1
fi

# --- Ist der Port schon belegt? ------------------------------------------
# Ein vergessener Server aus einem frueheren Versuch haelt den Port fest.
# PHP meldet dann nur "Address already in use" und beendet sich - wer das
# uebersieht, klickt weiter auf die alte, falsch gestartete Fassung und
# bekommt 404er, ohne dass irgendetwas auf die Ursache hinweist. Genau so
# ist es hier passiert.
belegt_von() {
  command -v lsof >/dev/null 2>&1 || return 1
  lsof -nP -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $2" "$1}'
}

ALT="$(belegt_von "$PORT" || true)"
if [ -n "${ALT:-}" ]; then
  ALT_PID="${ALT%% *}"
  ALT_NAME="${ALT#* }"

  # Einen freien Port suchen, statt nur zu meckern.
  NEU="$PORT"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    NEU=$((NEU + 1))
    [ -z "$(belegt_von "$NEU" || true)" ] && break
  done

  cat <<ENDE

  Port $PORT ist belegt - von $ALT_NAME, Prozessnummer $ALT_PID.
  Wahrscheinlich ein Server aus einem frueheren Versuch.

  Diese Fassung laeuft deshalb auf Port $NEU.

  Den alten loswerden:   kill $ALT_PID
ENDE
  PORT="$NEU"
fi

cat <<ENDE

  Nova Works läuft gleich auf:

      Website   http://127.0.0.1:$PORT
      Backend   http://127.0.0.1:$PORT/admin/

  Verzeichnis  $(cd "$SEITE" && pwd)

  Beim ersten Aufruf des Backends wird ein Passwort vergeben. Das gilt
  nur hier auf diesem Rechner - der Server bekommt später ein eigenes.

  Beenden mit Strg+C.

ENDE

exec php \
  -d upload_max_filesize=32M \
  -d post_max_size=160M \
  -d memory_limit=512M \
  -d max_execution_time=180 \
  -S "127.0.0.1:$PORT" -t "$SEITE"
