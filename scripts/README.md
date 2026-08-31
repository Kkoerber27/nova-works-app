# Geplante Aufgaben auf dem Mac

Drei LaunchAgents. Alle lesen ihre Zugangsdaten aus `~/.nova-works/env`
(Rechte 600, liegt bewusst außerhalb des Repositories) und schreiben ein
Protokoll nach `~/.nova-works/`.

| Aufgabe | Wann | Skript | Protokoll |
|---|---|---|---|
| Rechnungsablage | alle 15 Min | `rechnungsablage.sh` | `~/.nova-works/rechnungsablage.log` |
| NAS-Sicherung | nachts 03:15 | `nas-backup.sh` | `~/.nova-works/nas-backup.log` |
| Scheinwerfer-Protokoll | nachts 01:00 | `protokoll-nacht.sh` | `~/.nova-works/protokoll.log` |

Dazu `nas-restore.sh` für das Zurückspielen — von Hand, nicht geplant.

## NAS-Sicherung

Liest alle `nw_*`-Schlüssel aus Supabase und legt sie als JSON in einem
Tagesordner auf dem NAS ab — eine Datei je Schlüssel plus `_manifest.json`.

```bash
./scripts/install-nas-backup.sh
```

Danach in `~/.nova-works/env` das Ziel eintragen:

```bash
export NAS_BACKUP_MODE="mount"
export NAS_BACKUP_DIR="/Volumes/NAS/Backups/nova-works"
export NAS_BACKUP_KEEP_DAYS="30"
```

### Betriebsarten

| `NAS_BACKUP_MODE` | Ziel | Prüfung |
|---|---|---|
| `mount` (Standard) | Eingehängtes Laufwerk, etwa das NAS | Mountpoint muss das Ziel umfassen |
| `local` | Ordner auf der internen Platte, etwa in OneDrive | Kein Mount nötig, dafür Schutz vor untauglichen Zielen |

`local` ist keine Abschaltung der Kontrolle, sondern eine andere. Abgelehnt werden
dort: das Benutzerverzeichnis selbst, Pfade im Repository (das Backup landete
sonst in der Versionsverwaltung), temporäre Verzeichnisse wie `/tmp` oder
`/var/folders`, und Pfade, unter denen mehr als zwei Ebenen neu angelegt werden
müssten — das ist fast immer ein Tippfehler.

Für ein OneDrive-Ziel also:

```bash
export NAS_BACKUP_MODE="local"
export NAS_BACKUP_DIR="$HOME/OneDrive - NOVA WORKS GmbH/Backups/nova-works"
```

Die frühere Schreibweise `NAS_ALLOW_LOCAL=1` gilt weiterhin und bedeutet
`NAS_BACKUP_MODE="local"`.

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

## Zurückspielen

```bash
./scripts/nas-restore.sh --liste                 # welche Sicherungen gibt es
./scripts/nas-restore.sh                         # Probelauf mit der neuesten
./scripts/nas-restore.sh --datum 2026-08-20      # Probelauf mit einer älteren
./scripts/nas-restore.sh --key nw_crew_planungen --schreiben
```

**Ohne `--schreiben` wird nichts verändert.** Der Probelauf vergleicht Sicherung und
Supabase und zeigt, was abweicht, was fehlt und was identisch ist. Erst der zweite
Aufruf mit `--schreiben` schreibt zurück.

Vor jedem Schreiben legt das Skript den aktuellen Stand der betroffenen Schlüssel
unter `_vor-wiederherstellung/<Zeitstempel>/` ab. Eine misslungene Wiederherstellung
lässt sich damit rückgängig machen. Diese Ordner werden nie automatisch gelöscht —
die Aufräumung der Sicherung fasst nur Verzeichnisse an, deren Name exakt ein Datum
ist.

`--key` beschränkt auf einzelne Schlüssel. Im Ernstfall ist das meist der richtige
Weg: nur das zurückholen, was tatsächlich beschädigt ist, statt den ganzen Bestand
auf einen alten Stand zu setzen.

Abgewiesen werden: ein Datum ohne Sicherung, ein Schlüssel, den die Sicherung nicht
enthält, ein Tagesordner ohne `_manifest.json` (unvollständige Sicherung) und
Schlüssel ohne `nw_`-Präfix.

## Scheinwerfer-Protokoll

### Nächtlicher Lauf

```bash
./scripts/install-protokoll.sh
```

Fasst um 01:00 den vergangenen Tag zusammen und legt das PDF im Projektordner ab.
Danach in `~/.nova-works/env` den laufenden Job eintragen:

```bash
export PROTOKOLL_PROJEKT="26-0032"
export PROTOKOLL_OBJEKT="Glücksgefühle"
```

Andere Uhrzeit: `NOVA_HOUR=6 NOVA_MINUTE=30 ./scripts/install-protokoll.sh`.
Entfernen: `./scripts/install-protokoll.sh --remove`.

Bewusst einmal am Tag statt bei jeder eingehenden Mail: Ein Protokoll ist eine
Zusammenfassung. Bei jeder Meldung eines zu erzeugen hiesse, dreissig PDFs in den
Projektordner zu legen, von denen neunundzwanzig überholt sind.

**Ohne gesetztes `PROTOKOLL_PROJEKT` wird nichts erzeugt.** Nach dem letzten Job
den Eintrag leeren — sonst legt die Automatik Nacht für Nacht leere Protokolle in
einen Ordner, in dem längst niemand mehr nachsieht. Ebenso wird nichts erzeugt,
wenn der Tag keine Meldungen hatte: Ein leeres Protokoll sieht aus wie ein Tag
ohne Schäden und ist keiner.

Fotos bettet der nächtliche Lauf nicht ein. Dafür müssten Dateien von Hand
abgelegt werden, und der Lauf findet ohne Aufsicht statt.

### Von Hand rendern

Rendert die Meldungen aus `technik@nova-works.de` zu einem Protokoll — HTML
immer, PDF auf Wunsch.

```bash
node scripts/protokoll.mjs daten.json          # nur HTML
node scripts/protokoll.mjs daten.json --pdf    # HTML und PDF daneben
node scripts/protokoll.mjs daten.json --out ~/Desktop/protokoll.html --pdf
```

Die `daten.json` schreibt der Skill `.claude/skills/scheinwerfer-protokoll/`;
das Format steht dort, ein ausgefülltes Beispiel liegt daneben in `beispiel.json`.

Trägt ein Foto das Feld `datei` (Pfad relativ zur Datendatei), wird es als
Miniatur unter der Zeile eingebettet. Verkleinert wird mit `sips` (gehört zu
macOS), ersatzweise mit ImageMagick, auf 900 px längste Kante — aus 5 MB werden
rund 200 KB. Ohne beides landet das Original im Dokument, was das Skript meldet.
Eine unter `datei` genannte, aber fehlende Datei wird ebenfalls gemeldet und
weggelassen: ein Protokoll, das vollständig aussieht und es nicht ist, wäre
schlimmer als eines mit sichtbarer Lücke.

Das erzeugte HTML trägt oben rechts einen Knopf **Als PDF**, der den Druckdialog
des Browsers öffnet — „Als PDF sichern" führt dort zum selben Ergebnis wie
`--pdf`. Nützlich, wenn jemand nur das weitergeleitete HTML hat. Im Druck ist der
Knopf ausgeblendet; auf einem Nachweis hat er nichts verloren.

Für das PDF wird ein installierter Chromium-Browser kopflos benutzt — gesucht
werden Chrome, Edge, Brave und Chromium in dieser Reihenfolge. Bewusst keine
zusätzliche Abhängigkeit: Edge ist auf einem Mac mit Microsoft 365 ohnehin da,
und ein Paket, das nur zum Drucken installiert wird, veraltet zwischen zwei
Protokollen. Wird kein Browser gefunden, sagt das Skript das und das fertige HTML
lässt sich mit Cmd+P als PDF sichern.

Farben, Schrift und Logo stammen aus `Crewplanung.html`, damit das Protokoll wie
die übrigen Werkzeuge aussieht: warmes Off-White, schwarzes Kopfband mit dem
Logo, Gold als Akzent, Helvetica. Das Logo liegt als `scripts/assets/` und wird
beim Rendern als Data-URI eingebettet — so bleibt das HTML eine einzelne Datei,
die sich weiterleiten lässt. Fehlt es, trägt eine Wortmarke den Kopf.

Bewusst keine Google-Schrift: Die Werkzeuge nutzen Helvetica, und ein PDF, das
erst eine Schrift nachladen muss, sieht ohne Netz anders aus als mit.

Drei Eigenheiten, die im Skript festgehalten sind, weil sie sonst stillschweigend
falsche Protokolle oder ein falsches Druckbild erzeugen:

- **Uhrzeiten werden nicht umgerechnet.** Ausgegeben wird, was in der Meldung
  steht. Liefe das Skript auf einem Server in UTC, stünden sonst zwei Stunden zu
  wenig im Dokument.
- **Der Druck benutzt die Tabellenansicht.** Eine A4-Seite ist rund 690 px breit
  und fiele sonst in den Handy-Umbruch — das Protokoll bräuchte das Dreifache an
  Seiten.
- **Das Kopf-Raster ist eine Flexzeile.** Bei ungerader Feldzahl streckt sich die
  letzte Zeile über die volle Breite; ein Raster ließe dort eine Lücke stehen.
