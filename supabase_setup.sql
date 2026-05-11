-- ================================================================
-- NOVA WORKS – Supabase Setup
-- Dieses SQL im Supabase SQL-Editor ausführen:
-- https://supabase.com/dashboard/project/ekfuzciwjsldpkojyzgg/sql
-- ================================================================

-- Haupt-Tabelle: generischer Key-Value-Store für alle App-Daten
create table if not exists app_data (
  key         text        primary key,
  value       jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Row-Level-Security aktivieren
alter table app_data enable row level security;

-- Policy: öffentlicher Lese- und Schreibzugriff (Anon-Key reicht)
drop policy if exists "nw_public_all" on app_data;
create policy "nw_public_all" on app_data
  for all
  using (true)
  with check (true);

-- Index für Prefix-Suchen (Hotel- und Bauzeitenplan-Daten)
create index if not exists app_data_key_prefix on app_data (key text_pattern_ops);

-- ================================================================
-- Fertig! Die App kann jetzt verwendet werden.
-- ================================================================
