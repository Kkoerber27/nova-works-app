#!/usr/bin/env bash
#
# Erzeugt einmal nachts das Scheinwerfer-Protokoll des vergangenen Tages und
# legt es im Projektordner ab.
#
# Wird vom LaunchAgent de.nova-works.protokoll aufgerufen. Zum Testen auch von
# Hand, wahlweise mit einem anderen Tag:
#   ./scripts/protokoll-nacht.sh
#   ./scripts/protokoll-nacht.sh 2026-08-31
#
# Bewusst einmal am Tag statt bei jeder eingehenden Mail: Ein Protokoll ist eine
# Zusammenfassung. Bei jeder Meldung eines zu erzeugen hiesse, dreissig PDFs in
# den Projektordner zu legen, von denen neunundzwanzig überholt sind.
#
set -uo pipefail

REPO="${NOVA_REPO:-$HOME/nova-works-app}"
LOG="${NOVA_LOG:-$HOME/.nova-works/protokoll.log}"
ENV_FILE="${NOVA_ENV_FILE:-$HOME/.nova-works/env}"

mkdir -p "$(dirname "$LOG")"
stamp() { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(stamp)] $*" >>"$LOG"; }

# LaunchAgents erben weder ~/.zshrc noch einen brauchbaren PATH.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if [ -f "$ENV_FILE" ]; then
  if ! bash -n "$ENV_FILE" 2>/dev/null; then
    log "FEHLER $ENV_FILE ist syntaktisch fehlerhaft — meist ein nicht geschlossenes Anführungszeichen."
    log "       Prüfen mit: bash -n $ENV_FILE"
    exit 1
  fi
  # shellcheck source=/dev/null
  . "$ENV_FILE"
fi

if [ ! -d "$REPO" ]; then
  log "FEHLER Repository nicht gefunden: $REPO"
  exit 1
fi
if ! command -v claude >/dev/null 2>&1; then
  log "FEHLER 'claude' nicht im PATH. Installiert? PATH=$PATH"
  exit 1
fi

# Ohne gesetztes Projekt wird nichts erzeugt. Nach dem letzten Job bleibt der
# Eintrag sonst stehen und die Automatik legt Nacht für Nacht leere Protokolle
# in einen Ordner, in dem längst niemand mehr nachsieht.
PROJEKT="${PROTOKOLL_PROJEKT:-}"
OBJEKT="${PROTOKOLL_OBJEKT:-}"
if [ -z "$PROJEKT" ]; then
  log "Kein PROTOKOLL_PROJEKT gesetzt — nichts zu tun. Für einen laufenden Job in $ENV_FILE eintragen."
  exit 0
fi

# Der Lauf um 01:00 fasst den Tag zusammen, der gerade zu Ende ist. Zum Prüfen
# lässt sich ein anderer Tag mitgeben:  ./scripts/protokoll-nacht.sh 2026-08-31
TAG="${1:-}"
if [ -n "$TAG" ]; then
  case "$TAG" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
    *) log "FEHLER Datum muss JJJJ-MM-TT lauten, war: $TAG"; exit 1 ;;
  esac
else
  # BSD-date auf macOS, GNU-date überall sonst.
  TAG="$(date -v-1d "+%Y-%m-%d" 2>/dev/null || date -d "yesterday" "+%Y-%m-%d")"
fi
if [ -z "$TAG" ]; then
  log "FEHLER Datum des Vortags liess sich nicht bestimmen."
  exit 1
fi

cd "$REPO" || { log "FEHLER cd nach $REPO fehlgeschlagen"; exit 1; }

PROMPT="Erstelle das Scheinwerfer-Protokoll nach .claude/skills/scheinwerfer-protokoll/SKILL.md.

Zeitraum: ausschliesslich der $TAG, von 00:00 bis 23:59 Ortszeit.
Projektnummer: $PROJEKT
Objekt: ${OBJEKT:-aus den Meldungen ableiten}

Prüfe zuerst, ob die Outlook-Tools verfügbar sind. Sind sie es nicht, brich ab und
schreibe genau diese Zeile: \"ABBRUCH: Outlook-Tools nicht verfügbar\" — erzeuge dann
kein Protokoll und lege nichts ab. Nenne dabei, welche Werkzeugnamen du tatsächlich
zur Verfügung hast, damit der Server-Präfix in PROTOKOLL_MCP_SERVER berichtigt
werden kann.

Liegen für diesen Tag keine Meldungen im Postfach, schreibe nur \"keine Meldungen\"
und erzeuge kein Protokoll. Ein leeres Protokoll im Projektordner sieht aus wie ein
Tag ohne Schäden und ist keiner.

Schreibe bei jeder Meldung das Feld 'empfangen' mit dem unveränderten Wert von
receivedDateTime mit. Ist \$PROTOKOLL_FOTOS gesetzt, gib den Ordner beim Rendern
mit --fotos mit; die Bilder legt der Power-Automate-Flow dort ab und werden über
den Empfangszeitpunkt zugeordnet.

Melde am Ende in zwei Zeilen: wie viele Scheinwerfer vollständig erfasst sind und
wohin das Protokoll abgelegt wurde, und welche Meldungen nachgearbeitet werden
müssen. Ist beides nichts, schreibe nur \"nichts zu tun\"."

# Ein unbeaufsichtigter Lauf bekommt keine Rückfrage beantwortet und darf ohne
# ausdrückliche Freigabe keine MCP-Werkzeuge aufrufen. Freigegeben wird hier
# genau das Nötige — Postfach lesen und die Anhänge dazu — statt global in der
# Konfiguration. So steht im Skript, was es darf. SharePoint-Werkzeuge braucht es
# nicht: die Ablage macht protokoll.mjs --ablegen über den synchronisierten
# Ordner.
#
# Der Server-Präfix unterscheidet sich je nach Einrichtung. Der Standardwert ist
# der auf dem Arbeitsrechner tatsächlich vergebene Name. Stimmt er auf einem
# anderen Rechner nicht, bricht der Lauf mit "Outlook-Tools nicht verfügbar" ab
# und nennt die verfügbaren Werkzeugnamen; dann PROTOKOLL_MCP_SERVER in der
# env-Datei setzen.
MCP_SERVER="${PROTOKOLL_MCP_SERVER:-claude_ai_Microsoft_365}"
export PROTOKOLL_FOTOS="${PROTOKOLL_FOTOS:-}"
WERKZEUGE="Bash,Read,Write,Glob,Grep"
for t in outlook_email_search read_resource; do
  WERKZEUGE="$WERKZEUGE,mcp__${MCP_SERVER}__${t}"
done

# Prompt über die Standardeingabe, nicht als Argument: --allowedTools nimmt
# mehrere Werte entgegen und verschluckt einen nachfolgenden Text als weiteren
# Werkzeugnamen. Der Aufruf endete dann mit "Input must be provided".
log "Start — Tag $TAG, Projekt $PROJEKT, MCP-Server $MCP_SERVER"
if printf '%s' "$PROMPT" | claude -p --allowedTools "$WERKZEUGE" >>"$LOG" 2>&1; then
  log "Ende"
else
  log "FEHLER claude endete mit Code $?"
fi

# Damit die Datei nicht unbegrenzt wächst: die letzten 2000 Zeilen behalten.
if [ "$(wc -l <"$LOG")" -gt 4000 ]; then
  tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
