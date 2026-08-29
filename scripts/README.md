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

- **NAS nicht eingehängt.** Entschieden wird am nächsten Ordner, den es
  tatsächlich gibt: sein Mountpoint muss das Ziel enthalten. Bei einem
  eingehängten Laufwerk ist das `/Volumes/NAS`, was `/Volumes/NAS/Backups/…`
  umfasst. Fehlt das Laufwerk, bleibt `/Volumes` übrig — dessen Mountpoint ist
  auf macOS `/System/Volumes/Data` und umfasst das Ziel gerade nicht. Ein
  Vergleich nur gegen `/` griffe hier nicht: `/Volumes` liegt auf der
  Datenpartition, nicht auf der Systemwurzel. Dann bricht der Lauf ab und legt
  nichts an. Ein blindes `mkdir` würde dort eine Attrappe erzeugen, die
  monatelang unbemerkt „Backups" sammelt, während das NAS leer bleibt.
- **Fehlende Unterordner** unterhalb eines nachweislich eingehängten Laufwerks
  legt das Skript dagegen selbst an und vermerkt das im Protokoll. Der Mount
  entscheidet, nicht der Ordner.
- **Pfad liegt doch lokal.** Auch ein existierender Zielordner auf Mountpoint `/`
  führt zum Abbruch. Bewusst gewollt: `NAS_ALLOW_LOCAL=1`.
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
