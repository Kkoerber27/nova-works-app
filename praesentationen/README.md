# Präsentationen

Folien im Nova-Works-Design (Farben und Schrift aus `angebote.html`, Logo aus `scripts/assets/nova-works-logo.png`).

| Datei | Anlass |
|---|---|
| `Gesellschafterversammlung_2026-09-23.pptx` | Gesellschafterversammlung NOVA WORKS GmbH, Denkendorf, 23.09.2026 |

## Gesellschafterversammlung 23.09.2026

Sechs TOPs: Zusammenfassung/IST-Zustand, Überblick der letzten 4 Monate (mit Vorstellung der Nova Works App),
80er im Detail und Zukunft Kunde MK (Deal-Auswertung 26-0007 + 26-0008), Messeauftritt, Forecast und Ausblick, Sonstiges.

### Zahlen aktualisieren

Die Kennzahlen kommen aus `daten.json`. Die Datei wird aus einer Datensicherung des Angebots-Tools erzeugt
(Angebots-Tool → Datensicherung → Export). Das Skript lädt `angebote.html` headless und rechnet mit derselben Logik wie die App:

- `gesamt` – Zeile „Summe Bestätigt“ aus Auswertung → Bestätigte Projekte (TOP 1)
- `deal` – Deal-Auswertung ProEvent 2026 inkl. Kostensplit und Rechnungsstand (TOP 3)
- `forecast` – Forecast für die nächsten 12 Monate sowie Kalenderjahr 2026 und 2027 (TOP 5)

```bash
npm install pptxgenjs playwright   # einmalig; Playwright braucht ein Chromium (npx playwright install chromium)
node praesentationen/daten-aus-backup.js ~/Downloads/Nova-Works-Sicherung.json   # schreibt daten.json
node praesentationen/gesellschafterversammlung_2026-09-23.js                      # schreibt die PPTX
```

Liegt Chromium an einem festen Pfad, `CHROMIUM_PATH=/pfad/zu/chrome` setzen. Ohne `daten.json` baut das Skript die Folien
mit Platzhaltern („–“) und dem Deal-Stand vom 07.08.2026.
