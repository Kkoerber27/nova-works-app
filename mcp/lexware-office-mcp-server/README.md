# lexware-office-mcp-server

MCP-Server für die Rechnungsablage. Findet die offenen Rechnungen in Lexware Office,
liest die Projektnummer heraus und lädt das PDF herunter — damit es im passenden
Projektordner unter `Rechnungen/Out` landen kann.

Die Ablage in SharePoint macht dieser Server **nicht** selbst. Das übernimmt der
Microsoft-365-Connector, den du ohnehin schon hast; so braucht es keine zweiten
Zugangsdaten und keine Azure-App-Registrierung.

## API-Key anlegen

In Lexware Office: **Einstellungen → Erweiterungen → Öffentliche API** (je nach
Version auch „Schnittstellen"). Dort einen persönlichen Zugangsschlüssel erzeugen.
Der Schlüssel läuft nicht ab und gilt für genau eine Firma.

Den Schlüssel **nicht** ins Repository schreiben. Stattdessen in die Shell-Konfiguration
auf dem Rechner, der den Server startet — bei zsh in `~/.zshrc`:

```bash
export LEX_API_KEY="dein-schluessel"
```

Die `.mcp.json` im Projekt liest ihn von dort.

## Einrichten

```bash
cd mcp/lexware-office-mcp-server
npm install
npm run build
```

## Konfiguration

| Variable | Default | Zweck |
|---|---|---|
| `LEX_API_KEY` | — | Zugangsschlüssel, ohne ihn antwortet jedes Tool mit einem Hinweis |
| `LEX_API_BASE` | `https://api.lexware.io` | Nur ändern, wenn Lexware das Gateway verschiebt |
| `LEX_DOWNLOAD_DIR` | `~/.nova-works/rechnungen` | Wohin die PDFs vor dem Hochladen geschrieben werden |
| `LEX_LEDGER_PATH` | `~/.nova-works/lexware-filed.json` | Protokoll der bereits abgelegten Rechnungen |

## Netzwerk

Der Server spricht `api.lexware.io` über HTTPS an. Läuft er in einer Umgebung mit
Egress-Allowlist — etwa einem Cloud-Container —, muss dieser Host freigegeben sein.
Die Fehlermeldung unterscheidet die Fälle: „Blocked on the way to Lexware" heißt
Netzwerk, „Lexware rejected the API key" heißt Schlüssel, „No API key configured"
heißt fehlende Umgebungsvariable.

## Tools

| Tool | Zweck |
|---|---|
| `lex_list_open_invoices` | Offene, noch nicht abgelegte Rechnungen samt Projektnummer und offener Forderung |
| `lex_download_invoice_pdf` | PDF rendern lassen, herunterladen, lokal speichern |
| `lex_match_project_folder` | Zwischen mehreren Ordnern derselben Projektnummer entscheiden |
| `lex_mark_filed` | Vermerken, dass eine Rechnung abgelegt wurde |
| `lex_filing_log` | Was wurde wann wohin abgelegt |

Der Ablauf selbst steht in `.claude/skills/rechnungsablage/SKILL.md` im Projekt-Root.

## Wiederkehrender Ablauf

Der Server tut von sich aus nichts — er antwortet, wenn er gefragt wird. Für die
Ablage alle 15 Minuten sorgt ein LaunchAgent auf dem Mac:

```bash
./scripts/install-rechnungsablage.sh
```

Der Installer legt `~/.nova-works/env` an (dort den `LEX_API_KEY` eintragen, Rechte 600),
schreibt den LaunchAgent nach `~/Library/LaunchAgents/de.nova-works.rechnungsablage.plist`
und lädt ihn. Entfernen mit `--remove`, anderes Intervall über `NOVA_INTERVAL=600`.

Vor dem Verlassen einmal von Hand prüfen:

```bash
./scripts/rechnungsablage.sh && tail -n 40 ~/.nova-works/rechnungsablage.log
```

Der Lauf bricht mit einer Zeile im Protokoll ab, wenn das Repository fehlt, `claude`
nicht im PATH ist oder kein Schlüssel gesetzt wurde — und meldet „ABBRUCH: SharePoint-Tools
nicht verfügbar", wenn der Microsoft-365-Connector im kopflosen Lauf fehlt. Dann wird
nichts heruntergeladen und nichts als abgelegt vermerkt.

## Offene Forderung, nicht Gesamtwert

Eine Schlussrechnung führt zuerst die bereits gestellten Anzahlungen und Teilrechnungen
auf und zieht sie unten wieder ab. `totalAmount` ist deshalb der Auftragswert, nicht
das, was noch hereinkommt — bei einer Rechnung über 124.950 € mit halber Anzahlung
stehen tatsächlich 62.475 € aus.

Der Server weist beides getrennt aus:

| Feld | Bedeutung |
|---|---|
| `offen` | Was noch aussteht (`openAmount` aus der Belegliste) |
| `betrag_brutto` | Auftragswert inklusive bereits fakturierter Anzahlungen |

Summiert und berichtet wird `offen`. `betrag_brutto` erscheint in der Lesefassung nur,
wenn es abweicht — dann mit dem Zusatz, dass der Rest schon fakturiert ist.

Zwei Eigenheiten der Schnittstelle, die dabei auffielen: `openAmount` liefert nur die
Belegliste, nicht die Einzelrechnung. Und der Filter `voucherStatus=open` gibt auch
Belege zurück, deren eigener Status `overdue` lautet — überfällig ist ein Unterfall von
offen und wird als `ueberfaellig` gesondert ausgewiesen.

## Warum nie geraten wird

`projektnummer` ist bewusst `null`, sobald eine Rechnung **keine** oder **mehrere**
Projektnummern trägt. Dazu kommt, dass die Nummer allein nicht eindeutig ist: unter
`26-0007` liegen vier Projektordner (80er Live, … Frankfurt, … Hamburg, … Schalke),
unter `26-0021` zwei.

Eine im falschen Projekt abgelegte Rechnung fällt erst bei der Steuerprüfung auf.
Deshalb meldet der Server solche Fälle, statt sich für eine Variante zu entscheiden.

Bei mehrdeutiger Nummer hilft `lex_match_project_folder`: Es vergleicht die übrigen
Wörter des Rechnungstextes mit den Ordnernamen — „Schlussrechnung 26-0007 Schalke"
findet damit den Schalke-Ordner. Füllwörter wie „Rechnung" oder „GmbH" zählen nicht,
Umlaute und Großschreibung stören nicht. Gewinnt keiner oder mehrere gleich gut,
bleibt es bei `null`.

Das ersetzt nicht den sprechenden Rechnungstitel: Steht dort nur „Schlussrechnung
26-0007", gibt es nichts zu vergleichen. Der Ort im Titel löst das Problem an der
Wurzel.

## Grenzen

- **Gegen die echte Lexware-API ungetestet.** Entwickelt und geprüft wurde gegen einen
  Nachbau der Schnittstelle; die Endpunkte stammen aus der Dokumentation. Der erste
  Lauf mit echtem Schlüssel ist der eigentliche Test.
- **Zwei Anfragen pro Sekunde.** Das Limit gibt Lexware vor. Der Server hält sich
  daran, weshalb eine Liste mit 25 Rechnungen rund fünfzehn Sekunden braucht.
- **Das Protokoll liegt lokal.** Wird der Server auf einem zweiten Rechner gestartet,
  kennt er die dort noch nicht vermerkten Ablagen nicht und würde sie erneut anbieten.
- **Rechnungen im Entwurf haben kein PDF.** Erst mit dem Festschreiben („offen") gibt
  es ein Dokument zum Herunterladen.
