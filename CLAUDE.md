# NOVA WORKS – Repo-Überblick

Zwei eigenständige Web-Apps, jeweils eine einzelne HTML-Datei ohne Build-Schritt (Vanilla JS, deutschsprachige Oberfläche, Supabase als Backend):

- `Crewplanung.html` – Crewplanung (Startseite dieser Netlify-Site `nova-works-data`; `index.html` leitet dorthin weiter).
- `angebote.html` – Angebots-Tool mit Projekten, Material, CRM, Auswertung, Forecast, Rechnungen, Overhead. Läuft auf angebote.nova-works.de (Netlify-Site `nova-works-angebote`, Build: `mkdir -p dist && cp angebote.html dist/index.html`, Publish `dist`).

Weitere Dateien: `scripts/` (Mac-/NAS-Skripte, Scheinwerfer-Protokoll, Rechnungsablage), `mcp/` (MCP-Server für Lexware und Nova Works), `supabase_*.sql` (Schema).

## Arbeiten am Angebots-Tool

- Alles steht in `angebote.html`; Module sind als Kommentarblöcke (`/* ===== NAME ===== */`) gegliedert. Der Forecast beginnt bei `/* ===== FORECAST`.
- Zustand liegt im globalen Objekt `DB` (localStorage + Supabase `app_state`), Änderungen immer über `save()`.
- Neue Ansicht = Nav-Button (`data-view`), `<section class="view" id="view-…">`, Hook in `showView()`, Render-Funktion.
- Prüfen: Inline-Skripte mit `node --check`, dann Headless-Test mit Playwright (Login-Overlay per `hideLogin()` ausblenden, Testdaten in `DB` setzen, `showView("…")`).
