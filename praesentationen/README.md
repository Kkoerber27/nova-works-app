# Präsentationen

Folien im Nova-Works-Design (Farben und Schrift aus `angebote.html`, Logo aus `scripts/assets/nova-works-logo.png`).

| Datei | Anlass |
|---|---|
| `Gesellschafterversammlung_2026-09-23.pptx` | Gesellschafterversammlung NOVA WORKS GmbH, Denkendorf, 23.09.2026 |

## Gesellschafterversammlung 23.09.2026

Sechs TOPs: Zusammenfassung/IST-Zustand, Überblick der letzten 4 Monate (mit Vorstellung der Nova Works App),
80er im Detail und Zukunft Kunde MK (Deal-Auswertung 26-0007 + 26-0008), Messeauftritt, Forecast und Ausblick, Sonstiges.

Datenquellen im Skript (`gesellschafterversammlung_2026-09-23.js`, Block „Daten“):

- `DEAL` – Zahlen aus der Deal-Auswertung ProEvent 2026 der App (Auswertung → Deal-Auswertung), Stand 07.08.2026.
- `FORECAST` – noch `null`; Werte aus der App (Forecast → PowerPoint-Export) eintragen, dann rendert das Skript Kacheln und Monatsdiagramm.

Neu erzeugen:

```bash
npm install pptxgenjs   # einmalig
node praesentationen/gesellschafterversammlung_2026-09-23.js
```
