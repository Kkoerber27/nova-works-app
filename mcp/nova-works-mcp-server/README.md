# nova-works-mcp-server

MCP-Server für die NOVA WORKS App. Macht die Planungsdaten, die die HTML-Tools in
Supabase ablegen, für Claude abfragbar — Crewplanungen, Freelancer-Datenbank,
Hotelplanung, Schichtplan und Bauzeitenplan.

Die App selbst bleibt unverändert. Der Server ist ein zweiter Zugang zu denselben
Daten: die HTML-Tools für den Browser, dieser Server für Claude.

## Einrichten

```bash
cd mcp/nova-works-mcp-server
npm install
npm run build
```

Danach ist der Server über die `.mcp.json` im Projekt-Root eingebunden. In Claude
Code einmal `/mcp` aufrufen, um zu prüfen, dass `nova-works` verbunden ist.

Für Claude Desktop stattdessen in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "nova-works": {
      "command": "node",
      "args": ["/absoluter/pfad/zu/nova-works-app/mcp/nova-works-mcp-server/dist/index.js"]
    }
  }
}
```

Startet der Server nicht, liegt es meist am relativen Pfad in `.mcp.json` — dann
dort ebenfalls auf einen absoluten Pfad wechseln.

## Konfiguration

Alle Variablen sind optional; ohne sie nutzt der Server dieselbe Verbindung wie
die HTML-Tools.

| Variable | Default | Zweck |
|---|---|---|
| `NOVA_SUPABASE_URL` | Projekt-URL aus `Crewplanung.html` | Anderes Supabase-Projekt ansprechen |
| `NOVA_SUPABASE_KEY` | Publishable Key aus `Crewplanung.html` | Nach einer Key-Rotation setzen |
| `NOVA_ALLOW_WRITE` | `0` | Auf `1` setzen, um die schreibenden Tools freizuschalten |
| `NOVA_CREWPLANUNG_HTML` | `../../../../Crewplanung.html` | Pfad zur Datei mit der eingebauten Freelancer-Liste |

Der verwendete Key ist der öffentliche Anon-Key, der ohnehin im Frontend steht.
Er kommt nur an Keys mit Präfix `nw_` (siehe `supabase_rls_setup.sql`).
**Niemals den Service-Role-Key hier eintragen** — der umgeht RLS vollständig.

## Tools

### Lesen

| Tool | Beantwortet |
|---|---|
| `nova_list_projects` | Welche Projekte gibt es, wann laufen sie, wie voll ist die Crew? |
| `nova_get_project` | Wer ist auf Projekt X gebucht, nach Gewerk sortiert? |
| `nova_search_crew` | Wo ist Person X gebucht? Alle Buchungen projektübergreifend. |
| `nova_staffing_gaps` | Was ist noch offen — angefragt, abgesagt, unbesetzt? |
| `nova_find_conflicts` | Wer ist auf zwei Projekten gleichzeitig verplant? |
| `nova_search_technicians` | Freelancer-Adressbuch: Kontakt und Qualifikation. |
| `nova_list_events` | Für welche Events gibt es Hotel-, Schicht- oder Bauzeitenplan? |
| `nova_get_hotel_plan` | Wer übernachtet wann und in welchem Zimmertyp? |
| `nova_get_schichtplan` | Schichtplan eines Events. |
| `nova_get_bauzeitenplan` | Bauzeitenplan eines Events. |
| `nova_list_keys` | Welche Keys liegen im Store? |
| `nova_get_raw` | Rohes JSON-Dokument eines Keys (Notausgang). |

### Schreiben (nur mit `NOVA_ALLOW_WRITE=1`)

| Tool | Wirkung |
|---|---|
| `nova_set_crew_status` | Setzt den Buchungsstatus einer Person. |
| `nova_add_crew_member` | Fügt eine Person zu einem Gewerk hinzu. |

Beide Tools legen vor jeder Änderung den vorherigen Stand unter `nw_backup_mcp`
ab. Das ist ein Netz für die *letzte* Änderung, keine Historie — die täglichen
Backups der App (`nw_backup_daily_*`) laufen davon unabhängig weiter.

## Datenmodell

Die App speichert alles als JSON-Dokumente in der Tabelle `app_data`
(Key → jsonb). Der Server kennt diese Familien:

| Key | Inhalt |
|---|---|
| `nw_crew_planungen` | Array aller Crewplanungen samt Crew pro Gewerk |
| `nw_crew_techniker` | In der App angelegte Techniker |
| `nw_crew_gewerke` | Eigene Gewerke zusätzlich zu den sechs eingebauten |
| `nw_hotel_save_<Event>` | Hotelplanung |
| `nw_schichtplan_<Event>` | Schichtplan |
| `nw_bauzeit_save_<Event>` | Bauzeitenplan |

Zwei Eigenheiten, die der Server abbildet:

- **Phasen** stehen als `"2026-03-01/2026-03-03"` in den Feldern `aufbau`,
  `proben`, `show`, `abbau`. Ein einzelnes Datum ohne `/` ist ein Ein-Tages-Zeitraum.
- **Phasen-Punkte pro Person** sind optional. Sind keine gesetzt, gilt die Person
  für den gesamten Projektzeitraum — genau so liest es auch die Oberfläche.

Die eingebaute Freelancer-Liste liegt nicht in Supabase, sondern als
`const DB = [...]` in `Crewplanung.html`. Der Server liest sie von dort und
mischt die Supabase-Techniker darüber.

## Grenzen

- **Kein Sperrmechanismus.** Ein Schreibvorgang liest `nw_crew_planungen`, ändert
  es und schreibt es zurück. Wird gleichzeitig im Browser an derselben Planung
  gearbeitet, gewinnt der spätere Schreibvorgang. Schreibende Tools also nicht
  parallel zur offenen Crewplanung nutzen.
- **Doppelbuchungen werden über den Namen erkannt.** Zwei verschiedene Personen
  mit identischem Namen erscheinen als Konflikt.
- **`nova_get_schichtplan` und `nova_get_bauzeitenplan`** geben die Tagesdaten
  unverändert durch. Für die einzelnen Zeilen `response_format: "json"` nutzen.
