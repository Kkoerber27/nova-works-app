#!/usr/bin/env bash
#
# Eine Runde Rechnungsablage, kopflos ausgeführt.
#
# Wird vom LaunchAgent de.nova-works.rechnungsablage aufgerufen. Kann zum Testen
# auch von Hand gestartet werden:  ./scripts/rechnungsablage.sh
#
set -uo pipefail

REPO="${NOVA_REPO:-$HOME/nova-works-app}"
LOG="${NOVA_LOG:-$HOME/.nova-works/rechnungsablage.log}"
ENV_FILE="${NOVA_ENV_FILE:-$HOME/.nova-works/env}"

mkdir -p "$(dirname "$LOG")"
stamp() { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(stamp)] $*" >>"$LOG"; }

# LaunchAgents erben weder ~/.zshrc noch einen brauchbaren PATH.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# Der Lexware-Schlüssel kommt aus einer Datei, damit er nicht im Repository liegt.
# Ein beim Aufruf gesetzter Wert gewinnt aber gegen die Datei, sonst überschreibt
# ein leeres "export LEX_API_KEY=" genau das, was jemand zum Testen gesetzt hat.
_pre_key="${LEX_API_KEY:-}"
# shellcheck source=/dev/null
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
[ -n "$_pre_key" ] && LEX_API_KEY="$_pre_key"
export LEX_API_KEY

if [ ! -d "$REPO" ]; then
  log "FEHLER Repository nicht gefunden: $REPO"
  exit 1
fi
if ! command -v claude >/dev/null 2>&1; then
  log "FEHLER 'claude' nicht im PATH. Installiert? PATH=$PATH"
  exit 1
fi
if [ -z "${LEX_API_KEY:-}" ]; then
  log "FEHLER LEX_API_KEY nicht gesetzt. In $ENV_FILE eintragen: export LEX_API_KEY=\"…\""
  exit 1
fi

cd "$REPO" || { log "FEHLER cd nach $REPO fehlgeschlagen"; exit 1; }

PROMPT='Führe eine Runde Rechnungsablage nach .claude/skills/rechnungsablage/SKILL.md durch.

Prüfe zuerst, ob die SharePoint-Tools verfügbar sind. Sind sie es nicht, brich ab und
schreibe genau diese Zeile: "ABBRUCH: SharePoint-Tools nicht verfügbar" — lade dann
nichts herunter und vermerke nichts als abgelegt.

Melde am Ende in zwei Zeilen: wie viele Rechnungen abgelegt wurden, und welche auf eine
Entscheidung warten (mit Rechnungsnummer, Kunde und Grund). Ist beides null, schreibe
nur "nichts zu tun".'

log "Start"
if claude -p "$PROMPT" >>"$LOG" 2>&1; then
  log "Ende"
else
  log "FEHLER claude endete mit Code $?"
fi

# Damit die Datei nicht unbegrenzt wächst: die letzten 2000 Zeilen behalten.
if [ "$(wc -l <"$LOG")" -gt 4000 ]; then
  tail -n 2000 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
