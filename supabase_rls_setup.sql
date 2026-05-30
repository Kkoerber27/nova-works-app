-- ═══════════════════════════════════════════════════════════════
--  Nova Works – Supabase Row Level Security (RLS) Setup
--  Ausführen in: Supabase Dashboard → SQL Editor
--  Zweck: Schränkt den anon-Key auf nova-works-eigene Keys ein.
--         Verhindert, dass Fremde beliebige Daten lesen/schreiben.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. RLS aktivieren ──────────────────────────────────────────
ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;

-- ── 2. Alte Policies entfernen (falls vorhanden) ───────────────
DROP POLICY IF EXISTS "nova_works_keys_only"   ON app_data;
DROP POLICY IF EXISTS "nova_works_select"      ON app_data;
DROP POLICY IF EXISTS "nova_works_insert"      ON app_data;
DROP POLICY IF EXISTS "nova_works_update"      ON app_data;
DROP POLICY IF EXISTS "nova_works_delete"      ON app_data;

-- ── 3. Neue Policies: nur Keys mit Präfix "nw_" erlaubt ────────
--
--  Erlaubte Key-Präfixe (alle starten mit "nw_"):
--    nw_crew_techniker       – Techniker-Datenbank
--    nw_crewsheet_autosave   – Auto-Save des Crewsheets
--    nw_crewsheet_import     – Einmaliger Import-Kanal
--    nw_hotel_save_*         – Hotelplanung-Saves
--    nw_hotel_sync_*         – Hotel-Sync-Daten
--    nw_crewplanung_*        – Crewplanung-Saves
--
--  Jeder mit dem anon-Key kann nur auf diese Keys zugreifen.
--  Beliebige andere Keys sind vollständig gesperrt.

CREATE POLICY "nova_works_select" ON app_data
  FOR SELECT
  TO anon
  USING (key LIKE 'nw_%');

CREATE POLICY "nova_works_insert" ON app_data
  FOR INSERT
  TO anon
  WITH CHECK (key LIKE 'nw_%');

CREATE POLICY "nova_works_update" ON app_data
  FOR UPDATE
  TO anon
  USING  (key LIKE 'nw_%')
  WITH CHECK (key LIKE 'nw_%');

CREATE POLICY "nova_works_delete" ON app_data
  FOR DELETE
  TO anon
  USING (key LIKE 'nw_%');

-- ── 4. Verify ──────────────────────────────────────────────────
-- Nach dem Ausführen testen:
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'app_data';
-- → rowsecurity sollte "true" sein

SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'app_data';
-- → 4 Policies sollten erscheinen

-- ═══════════════════════════════════════════════════════════════
--  WICHTIG: Service Role Key
--  Der Service Role Key (in den Supabase Project Settings) umgeht
--  RLS immer. Dieser Key darf NIEMALS in den Frontend-Code.
--  Nur der anon Key (sb_publishable_*) darf im HTML stehen.
-- ═══════════════════════════════════════════════════════════════
