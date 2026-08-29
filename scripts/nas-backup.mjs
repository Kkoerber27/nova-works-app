#!/usr/bin/env node
/**
 * Sichert alle NOVA-WORKS-Daten aus Supabase in einen datierten Ordner.
 *
 * Ein Verzeichnis je Tag, darin eine JSON-Datei je Schlüssel plus ein Manifest.
 * Aufgerufen wird das Skript von scripts/nas-backup.sh, das vorher prüft, ob das
 * Ziel überhaupt ein eingehängtes Laufwerk ist.
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SUPABASE_URL =
  process.env.NOVA_SUPABASE_URL ?? "https://ekfuzciwjsldpkojyzgg.supabase.co";
const SUPABASE_KEY =
  process.env.NOVA_SUPABASE_KEY ?? "sb_publishable_53YU2qO5PwdFwhVuZSSyPg_pcdw2Dhk";
const TARGET = process.env.NAS_BACKUP_DIR;
const KEEP_DAYS = Number(process.env.NAS_BACKUP_KEEP_DAYS ?? 30);
const TIMEOUT_MS = 60000;

function die(message) {
  console.error(message);
  process.exit(1);
}

if (!TARGET) die("NAS_BACKUP_DIR ist nicht gesetzt.");
if (!Number.isFinite(KEEP_DAYS) || KEEP_DAYS < 1) {
  die(`NAS_BACKUP_KEEP_DAYS muss eine Zahl ab 1 sein, war: ${process.env.NAS_BACKUP_KEEP_DAYS}`);
}

/** Ein Dateiname aus einem Schlüssel — Schlüssel dürfen Leerzeichen enthalten. */
function safeName(key) {
  return key.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 200);
}

async function fetchAll() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${SUPABASE_URL}/rest/v1/app_data?select=key,value,updated_at&key=like.${encodeURIComponent("nw_*")}&order=key`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      die(`Supabase antwortete mit HTTP ${res.status}. ${body.trim().slice(0, 300)}`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      die(`Supabase hat innerhalb von ${TIMEOUT_MS / 1000}s nicht geantwortet.`);
    }
    die(`Supabase nicht erreichbar: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    // Ohne das hält der offene Timer die Ereignisschleife bis zum Ablauf am
    // Leben: der Lauf wäre fertig, der Prozess bliebe eine Minute stehen.
    clearTimeout(timer);
  }
}

/** Alte Tagesordner entfernen — nur solche, die exakt wie ein Datum heißen. */
async function prune(root, today) {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - KEEP_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let removed = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) continue;
    if (entry.name >= cutoffStr) continue;
    await rm(join(root, entry.name), { recursive: true, force: true });
    removed += 1;
  }
  return { removed, cutoffStr };
}

const rows = await fetchAll();
if (!Array.isArray(rows) || !rows.length) {
  die("Supabase lieferte keine Datensätze. Das wäre ungewöhnlich — es wird nichts geschrieben, damit ein leeres Backup kein gutes überschreibt.");
}

const today = new Date().toISOString().slice(0, 10);
const dayDir = join(TARGET, today);
await mkdir(dayDir, { recursive: true });

let bytes = 0;
const files = [];
for (const row of rows) {
  const name = `${safeName(row.key)}.json`;
  const text = JSON.stringify(row.value, null, 2);
  await writeFile(join(dayDir, name), text, "utf8");
  bytes += Buffer.byteLength(text);
  files.push({ key: row.key, datei: name, bytes: Buffer.byteLength(text), updated_at: row.updated_at });
}

const manifest = {
  erstellt_am: new Date().toISOString(),
  quelle: SUPABASE_URL,
  schluessel: files.length,
  bytes_gesamt: bytes,
  aufbewahrung_tage: KEEP_DAYS,
  dateien: files,
};
await writeFile(join(dayDir, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

const { removed, cutoffStr } = await prune(TARGET, today);
console.log(
  `${files.length} Schlüssel, ${(bytes / 1024).toFixed(0)} KB nach ${dayDir} — ` +
    `${removed} Ordner älter als ${cutoffStr} entfernt`,
);
