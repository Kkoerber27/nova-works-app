# CLAUDE.md

Guidance for AI assistants working in this repository.

## Project overview

**NOVA WORKS App** is a suite of browser-based planning tools for event / live-production
crew management (German AV & event technical services). It covers the full chain from crew
booking to hotel, shift, construction-schedule and radio-equipment planning, with PDF/Excel
export for on-site paperwork.

The whole product is a set of **standalone, self-contained HTML files**. There is:

- **no build step** — no `package.json`, bundler, transpiler, or task runner
- **no test suite** and **no CI**
- **no framework** — plain vanilla JS, inline `<style>` and `<script>` in each file
- **no server code** — the only backend is a hosted Supabase table

Deployment is Netlify static hosting straight from the repo root (`netlify.toml`
disables HTML caching and allows Supabase CORS). `index.html` is a meta-refresh
redirect to `Crewplanung.html`, which is the entry point / hub of the suite.

**The UI, code comments, and commit messages are in German.** Keep it that way when
editing existing files.

## File inventory

### Main tools (user-facing)

| File | Lines | Purpose |
|---|---|---|
| `Crewplanung.html` | ~3.4k | **Hub.** Project (Planung) list, crew booking per Gewerk, freelancer database, CSV/vCard import, and the launcher for every other tool. |
| `crew_sheet_form.html` | ~2.6k | Crew Sheet: per-event personnel sheet with positions, hotel blocks, guests, deployment days, file attachments, PDF/Excel/email export. |
| `hotel_planung.html` | ~880 | Hotel room planning per event: guests, check-in/out, nights calculation, PDF/Excel export. |
| `schichtplan.html` | ~800 | Shift plan: one block per day, rows grouped and sorted by Gewerk/start time, PDF/Excel export. |
| `bauzeitenplan.html` | ~910 | Construction/build schedule: rows per day across event phases, generates a standalone shareable HTML export. |
| `funkgeraete.html` | ~155 | Radio-equipment handover list, grouped by Gewerk, print/PDF. |
| `index.html` | 11 | Redirect to `Crewplanung.html`. |

### Maintenance / rescue pages

These are one-off operator tools, not part of the normal flow. They talk to Supabase
directly with `db.from('app_data')` rather than through the `SupaDB` wrapper.

| File | Purpose |
|---|---|
| `backup.html` | Browse rolling + daily snapshots, download them, restore one into `nw_crew_planungen`. |
| `recover.html` | Merge projects that exist only in `localStorage` back into Supabase. |
| `diagnose.html` | Inspect / export every `nw_*` key in `localStorage`. |
| `upload_rescue.html` | Push a pasted/known dataset into Supabase, merging with what is there. |
| `migrate_to_supabase.html` | One-time bulk migration `localStorage` → Supabase. |
| `supabase_import.html` | Import a downloaded backup JSON back into `app_data` (uses raw `fetch` against the REST API). |

### Data / schema files

| File | Purpose |
|---|---|
| `supabase_setup.sql` | Creates the `app_data` table, enables RLS, adds the prefix index. Run once in the Supabase SQL editor. |
| `supabase_rls_setup.sql` | Tightens RLS so the `anon` key can only touch keys matching `nw_%`. |
| `crew_sheet_vorlage_novaworks_v3.xlsx`, `crew_sheet_novaworks_v4.xlsm`, `freelancer-2.xlsx` | Legacy Excel originals the HTML tools replaced; kept for reference/import. |
| `Header1.jpeg` | 6.5 MB uploaded header artwork. **Not referenced by any HTML** — the logo is embedded as a base64 data URI inside each tool instead. Do not add a `<img src="Header1.jpeg">` reference without discussing it; it would blow up page weight. |

## Architecture

### One file = one app

Every tool is fully self-contained: its CSS, its markup, its JavaScript, its logo (base64
data URI), and its own copy of the Supabase access layer all live in the same `.html` file.
There is no shared JS/CSS file and no module system. Third-party libraries come from CDNs:

- `@supabase/supabase-js@2` (jsDelivr) — everywhere data is persisted
- `xlsx@0.18.5` (SheetJS) — `Crewplanung`, `crew_sheet_form`, `bauzeitenplan`
- `exceljs@4.4.0` — `hotel_planung`, `schichtplan` (styled Excel output)
- `jspdf@2.5.1` + `html2canvas@1.4.1` — PDF export in the tools that need it

**Consequence: the `SupaDB` wrapper, the `esc`/`escHtml` helper, the date helpers, and the
Gewerk colour palette are duplicated across files.** When you fix a bug in one of them, grep
for the same code in the other tools and decide deliberately whether the fix applies there
too. Do not introduce a shared `.js` file without being asked — it would change the
deployment model.

### Persistence: the `app_data` key-value store

Everything is stored in one Supabase table:

```sql
app_data (key text primary key, value jsonb, updated_at timestamptz)
```

Access goes through the `SupaDB` object present in each main tool:

- `SupaDB.init([keys])` / `SupaDB.initPrefix('nw_foo_')` — load into `SupaDB.cache`
- `SupaDB.get(key, fallback)` — read from cache (synchronous)
- `SupaDB.set(key, value)` — write-through cache + **queued** upsert with **3 retries**
  (1.5 s × attempt backoff); collapses repeated writes to the same key
- `SupaDB.del(key)`
- `SupaDB._updateStatus()` — drives the `#supaStatus` indicator (`⏳ Speichert…` /
  `✓ HH:MM` / `⚠ Speicherfehler`)

`localStorage` is still used for three distinct things — do not conflate them:

1. **Legacy source** for the one-time migration into Supabase (guarded by
   `nw_supa_migrated`, `nw_hotel_migrated`, `nw_bauzeit_migrated` flags).
2. **Fallback** when Supabase is unreachable or the value is newer locally
   (several loaders compare timestamps between the two).
3. **One-shot handoff channel** between tools in the same browser session
   (`nw_crewsheet_import`, `nw_hotel_import`, `nw_bauzeit_import`, `nw_funk_import`,
   `nw_crew_db_export`) — the receiving page reads the key and then removes it.

### Key registry

All keys are prefixed `nw_` — RLS enforces this, so **a new key that does not start with
`nw_` will be silently rejected by the anon key**.

| Key | Written by | Read by | Shape |
|---|---|---|---|
| `nw_crew_planungen` | Crewplanung | Crewplanung, schichtplan, bauzeitenplan, rescue pages | `Planung[]` — the master dataset |
| `nw_crew_techniker` | Crewplanung | Crewplanung, crew_sheet_form | custom freelancers added on top of the built-in `DB` |
| `nw_crew_gewerke` | Crewplanung | Crewplanung | custom Gewerke appended to `GEWERKE_BASE` |
| `nw_backup_rolling` | Crewplanung (`makeBackupSnapshot`) | backup.html | last 10 snapshots, newest first |
| `nw_backup_daily_YYYY-MM-DD` | Crewplanung | backup.html | one snapshot per day, pruned after 30 days |
| `nw_crewsheet_autosave` | crew_sheet_form | crew_sheet_form | current sheet state |
| `nw_crewsheet_import` | Crewplanung (`generateCrewSheet`) | crew_sheet_form | localStorage only, consumed once |
| `nw_hotel_sync_<Event>` | Crewplanung (`syncHotelData`, on every save) | hotel_planung, crew_sheet_form | live crew status for the event |
| `nw_hotel_save_<Event>` | hotel_planung | hotel_planung, crew_sheet_form | the hotel plan itself |
| `nw_hotel_import` | Crewplanung (`generateHotelPlanung`) | hotel_planung | localStorage only, consumed once |
| `nw_bauzeit_save_<Event>` | bauzeitenplan | bauzeitenplan | build schedule |
| `nw_bauzeit_import` | Crewplanung | bauzeitenplan | localStorage only, consumed once |
| `nw_schichtplan_<Event>` | schichtplan | schichtplan | shift plan |
| `nw_funk_import` | Crewplanung (`generateFunkgeraete`) | funkgeraete | localStorage only, consumed once |
| `nw_crew_db_export` | Crewplanung (`initApp`) | crew_sheet_form | freelancer DB for same-session autocomplete |
| `nw_supa_migrated`, `nw_hotel_migrated`, `nw_bauzeit_migrated` | each tool | each tool | localStorage-only migration flags |

**Important invariant:** `generateHotelPlanung` must never overwrite an existing
`nw_hotel_save_*`. Crew status flows into hotel planning through `nw_hotel_sync_*`, which
`hotel_planung.html` merges additively (`mergeSyncFromCrewplanung`). Several past commits
were fixes for exactly this; preserve the separation.

### Cross-tool handoff pattern

`Crewplanung.html` is the source of truth. Each `generate*()` function:

1. collects the relevant crew from the active Planung (usually only members with
   `status === 'bestaetigt'`),
2. writes a payload to Supabase and/or a one-shot `localStorage` import key,
3. builds a share URL (`?e=<Eventname>` plus phase params) for the target tool,
4. opens a modal with an "open" button and a copyable link.

The target tool resolves its data with a **fallback chain**, e.g. `crew_sheet_form.html`:
event-specific `nw_hotel_save_<Event>` → any `nw_hotel_save_*` → `nw_hotel_sync_<Event>` →
any `nw_hotel_sync_*` → `nw_hotel_import`. Keep those chains intact when touching loaders.

## Domain model

### Planung (project)

```js
{
  id: 'p_' + Date.now(),
  name, kunde, ort,
  aufbau, proben, show, abbau,   // phase date ranges, see encoding below
  datum, pl, notizen,
  crew: { <gewerkId>: CrewMember[] },
  collapsed: { <gewerkId>: bool }
}
```

### CrewMember

```js
{ name, funktion, tel, email, notiz,
  status: 'angefragt' | 'bestaetigt' | 'abgesagt',
  phasen: { aufbau: bool, proben: bool, show: bool, abbau: bool } }
```

Status cycles `angefragt → bestaetigt → abgesagt` via `cycleStatus()`; setting it back to
`angefragt` opens a `mailto:` request email.

### Gewerke (trades)

`GEWERKE_BASE` in `Crewplanung.html` — `tl` (Technische Leitung), `licht`, `ton`,
`rigging`, `av` (AV/Video), `logistik`. Each has `id`, `name`, `color`, and `cats`
(job titles used for the freelancer autocomplete). Custom Gewerke from
`nw_crew_gewerke` are appended by `rebuildGewerke()` and tagged `_custom: true`.
The same colours are repeated as CSS variables (`--licht`, `--ton`, …) and hardcoded in the
other tools — update all of them together when the palette changes.

### Date encoding

- Internal / stored: ISO `YYYY-MM-DD`.
- **Phases are a single string** `"YYYY-MM-DD/YYYY-MM-DD"` (start/end), or just
  `"YYYY-MM-DD"` when there is no end. Helpers: `phS()`, `phE()`, `combinePhase()`,
  `fmtPhase()`; several files re-declare local `isoStart`/`isoEnd`.
- Displayed to the user: German `DD.MM.YYYY`, ranges as `DD.MM.YYYY – DD.MM.YYYY`.
- Dates are parsed as `new Date(iso + 'T00:00:00')` to avoid UTC off-by-one; keep that.

### Freelancer database

`const DB = [...]` in `Crewplanung.html` (around line 909) is a **single ~40 KB line** of
JSON with entries `{n: surname, v: given name, t: phone, e: email, k: category}`. Editing it
by hand is painful — prefer the in-app CSV/vCard import, and never reformat that line
(the diff would be unreadable). Custom entries live in `nw_crew_techniker` and are merged
by `saveTechDB()`.

## Conventions

- **Vanilla, global-scope JS.** Functions are global and wired up via inline
  `onclick="doThing('id', 2)"` handlers in template strings. This is intentional; follow it
  rather than introducing `addEventListener` refactors or modules.
- **Escaping is mandatory.** All user-supplied text interpolated into HTML strings must go
  through `esc()` (Crewplanung, hotel_planung, schichtplan, bauzeitenplan, funkgeraete) or
  `escHtml()` (crew_sheet_form). `esc2()` escapes strings destined for inline JS string
  literals; `pEsc()` in `bauzeitenplan.html` escapes text for the standalone HTML document
  it generates. XSS fixes were a dedicated past commit — do not regress them.
- **Rendering** is string-concatenation of HTML into `innerHTML`, usually with a
  `renderAll()` / `render<Thing>()` / `rerender<Thing>()` trio so a single edit only
  repaints its own section. Prefer the narrow re-render over a full repaint (it preserves
  input focus).
- **Every mutation calls `save()`.** In `Crewplanung.html` `save()` writes
  `nw_crew_planungen`, runs `syncHotelData()`, and takes a backup snapshot (rate-limited to
  once per 3 minutes). Other tools use `scheduleAutoSave()` (debounced) plus a manual save.
- **Styling**: dark chrome / light content sheet, CSS custom properties defined on `:root`
  (`--black`, `--dark`, `--accent: #c8a96e`, per-Gewerk colours…). Font stack and spacing
  are already established — match the neighbouring file.
- **Print/PDF**: each tool has an `@media print` block, and the PDF path often swaps
  `<input>` elements for plain text divs before rasterising (`_preparePrint()` /
  `_restorePrint()` in `crew_sheet_form.html`) to avoid clipping. If you change a form
  layout, check the print output as well — most historical bugs were print regressions.
- **Commit messages**: German, `<datei/bereich>: <was geändert wurde>`, e.g.
  `Schichtplan: Zeilen innerhalb Gewerk nach Startzeit sortieren`.

## Security

- The Supabase URL and the **publishable anon key** (`sb_publishable_…`) are hardcoded in
  every file. That is by design for this deployment.
- **Never put the Supabase service-role key in any file here** — it bypasses RLS.
- RLS (`supabase_rls_setup.sql`) restricts the anon role to keys matching `nw_%`. New keys
  must use that prefix.
- There is no authentication: anyone with the Netlify URL can read and write the `nw_*`
  data. Keep that in mind before adding anything more sensitive than crew contact details.

## Development workflow

There is nothing to install or build.

```bash
# serve the folder and open the hub
python3 -m http.server 8080   # then http://localhost:8080/Crewplanung.html
```

Opening the files directly via `file://` mostly works, but the cross-tool share links
(built from `window.location.origin + pathname`) and some export paths assume an HTTP
origin — use the local server when testing handoffs.

Verification is manual: exercise the changed flow in the browser, check the console for
`Supabase … fehler` warnings, and check the print preview if you touched layout. Since
writes go to the **production** Supabase project, avoid creating throwaway Planungen with
real-looking names, and clean up test keys you create.

Deployment: Netlify publishes the repo root; a push to `main` goes live. `netlify.toml`
sets `Cache-Control: no-cache` for everything, so changes appear on reload without a
cache-busting step.

### Branch policy for this session

Develop and push on `claude/claude-md-docs-6kds8u`. Do not push to `main`. Do not open a
pull request unless explicitly asked.

## Gotchas

- **Duplicated code across files** — `SupaDB`, `esc`, date helpers, Gewerk colours. Grep
  before assuming a fix is complete.
- **Giant single lines** — `Crewplanung.html:909` (freelancer DB) and the base64 logo data
  URIs. `sed`/`head` on those files can dump tens of KB; use `cut -c1-200` when scanning.
- **`bauzeitenplan.html` emits a full HTML document as a string**, including
  `<\/script>`-escaped CDN tags. Watch the escaping when editing that generator.
- **Timestamp comparison** between `localStorage` and Supabase decides which copy wins in
  several loaders. Several past bugs were data loss from getting that backwards — read the
  surrounding comments before changing a loader.
- **Rescue pages bypass `SupaDB`** and write `app_data` directly. They are destructive by
  nature; never run them as part of routine work.
