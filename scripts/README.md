# Geplante Aufgaben auf dem Mac

Zwei LaunchAgents. Beide lesen ihre Zugangsdaten aus `~/.nova-works/env`
(Rechte 600, liegt bewusst außerhalb des Repositories) und schreiben ein
Protokoll nach `~/.nova-works/`.

| Aufgabe | Wann | Skript | Protokoll |
|---|---|---|---|
| Rechnungsablage | alle 15 Min | `rechnungsablage.sh` | `~/.nova-works/rechnungsablage.log` |
| NAS-Sicherung | nachts 03:15 | `nas-backup.sh` | `~/.nova-works/nas-backup.log` |

## NAS-Sicherung

Liest alle `nw_*`-Schlüssel aus Supabase und legt sie als JSON in einem
Tagesordner auf dem NAS ab — eine Datei je Schlüssel plus `_manifest.json`.

```bash
./scripts/install-nas-backup.sh
```

Danach in `~/.nova-works/env` das Ziel eintragen:

```bash
export NAS_BACKUP_DIR="/Volumes/NAS/Backups/nova-works"
export NAS_BACKUP_KEEP_DAYS="30"
```

Andere Uhrzeit: `NOVA_HOUR=2 NOVA_MINUTE=0 ./scripts/install-nas-backup.sh`.
Entfernen: `./scripts/install-nas-backup.sh --remove`.

Vor dem Verlassen einmal von Hand prüfen:

```bash
./scripts/nas-backup.sh && tail -n 20 ~/.nova-works/nas-backup.log
```

### Wogegen die Sicherung absichert

- **NAS nicht eingehängt.** Existiert `NAS_BACKUP_DIR` nicht, bricht der Lauf ab,
  statt den Pfad anzulegen. Ein blindes `mkdir` würde eine Attrappe auf der
  internen Platte erzeugen, die monatelang unbemerkt „Backups" sammelt.
- **Pfad liegt doch lokal.** Zusätzlich wird der Mountpoint geprüft. Ist er `/`,
  bricht der Lauf ab — auch wenn der Ordner existiert. Bewusst gewollt:
  `NAS_ALLOW_LOCAL=1`.
- **Leere Antwort von Supabase.** Dann wird nichts geschrieben, damit ein leeres
  Backup kein gutes überschreibt.
- **Fremde Ordner.** Beim Aufräumen werden ausschließlich Verzeichnisse gelöscht,
  deren Name exakt einem Datum entspricht. Alles andere im Zielordner bleibt
  unberührt.

### Grenzen

- Ein LaunchAgent feuert nur, solange der Benutzer angemeldet ist. Schläft der Mac
  um 03:15, holt macOS den Lauf beim Aufwachen nach.
- Gesichert wird der Inhalt von `app_data`, also die Daten der HTML-Werkzeuge.
  Nicht gesichert sind SharePoint-Dateien und Lexware selbst.
- Die Sicherung ist eine Kopie, keine Versionierung: Wird ein Fehler erst nach
  `NAS_BACKUP_KEEP_DAYS` Tagen bemerkt, ist der letzte gute Stand fort.
