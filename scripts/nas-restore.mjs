#!/usr/bin/env node
/**
 * Spielt eine NAS-Sicherung zurück nach Supabase.
 *
 * Standard ist ein Probelauf: Es wird nur gezeigt, was sich ändern würde.
 * Geschrieben wird ausschließlich mit --schreiben, und davor legt das Skript den
 * aktuellen Stand der betroffenen Schlüssel als Sicherheitskopie ab.
 */

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SUPABASE_URL =
  process.env.NOVA_SUPABASE_URL ?? "https://ekfuzciwjsldpkojyzgg.supabase.co";
const SUPABASE_KEY =
  process.env.NOVA_SUPABASE_KEY ?? "sb_publishable_53YU2qO5PwdFwhVuZSSyPg_pcdw2Dhk";
const BACKUP_DIR = process.env.NAS_BACKUP_DIR;
const REST = `${SUPABASE_URL}/rest/v1/app_data`;
const TIMEOUT_MS = 60000;

function die(message) {
  console.error(message);
  process.exit(1);
}

// ── Argumente ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opts = { schreiben: false, liste: false, datum: null, keys: null };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--schreiben") opts.schreiben = true;
  else if (a === "--liste") opts.liste = true;
  else if (a === "--datum") opts.datum = args[++i];
  else if (a === "--key") opts.keys = (opts.keys ?? []).concat(args[++i].split(","));
  else if (a === "--hilfe" || a === "-h") {
    console.log(`Verwendung: nas-restore.sh [Optionen]

  --liste              Verfügbare Sicherungen anzeigen
  --datum JJJJ-MM-TT   Diese Sicherung verwenden (Standard: die neueste)
  --key NAME[,NAME]    Nur diese Schlüssel (Standard: alle der Sicherung)
  --schreiben          Tatsächlich zurückschreiben (ohne: nur Probelauf)

Ohne --schreiben wird nichts verändert.`);
    process.exit(0);
  } else die(`Unbekannte Option: ${a}. --hilfe zeigt die Möglichkeiten.`);
}

if (!BACKUP_DIR) die("NAS_BACKUP_DIR ist nicht gesetzt.");

/** Vergleichbare Darstellung: Schlüsselreihenfolge darf keinen Unterschied machen. */
function kanonisch(value) {
  if (Array.isArray(value)) return `[${value.map(kanonisch).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${kanonisch(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function tage() {
  const entries = await readdir(BACKUP_DIR, { withFileTypes: true }).catch(() =>
    die(`Sicherungsordner nicht lesbar: ${BACKUP_DIR}. Ist das NAS eingehängt?`),
  );
  return entries
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map((e) => e.name)
    .sort();
}

async function supabase(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${REST}${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      die(`Supabase antwortete mit HTTP ${res.status}. ${body.trim().slice(0, 300)}`);
    }
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      die(`Supabase hat innerhalb von ${TIMEOUT_MS / 1000}s nicht geantwortet.`);
    }
    die(`Supabase nicht erreichbar: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}

// ── Übersicht ──────────────────────────────────────────────────────────────
const verfuegbar = await tage();
if (!verfuegbar.length) die(`Keine Sicherungen in ${BACKUP_DIR} gefunden.`);

if (opts.liste) {
  console.log(`Sicherungen in ${BACKUP_DIR}:\n`);
  for (const tag of verfuegbar.slice().reverse()) {
    let info = "";
    try {
      const m = JSON.parse(await readFile(join(BACKUP_DIR, tag, "_manifest.json"), "utf8"));
      info = `${m.schluessel} Schlüssel, ${(m.bytes_gesamt / 1024).toFixed(0)} KB`;
    } catch {
      info = "kein Manifest — unvollständig";
    }
    console.log(`  ${tag}   ${info}`);
  }
  process.exit(0);
}

const tag = opts.datum ?? verfuegbar[verfuegbar.length - 1];
if (!verfuegbar.includes(tag)) {
  die(`Keine Sicherung vom ${tag}. Vorhanden: ${verfuegbar.join(", ")}`);
}
const tagDir = join(BACKUP_DIR, tag);

let manifest;
try {
  manifest = JSON.parse(await readFile(join(tagDir, "_manifest.json"), "utf8"));
} catch {
  die(`${tagDir} hat kein lesbares _manifest.json — die Sicherung ist unvollständig und wird nicht verwendet.`);
}

// ── Sicherung einlesen ─────────────────────────────────────────────────────
let dateien = manifest.dateien ?? [];
if (opts.keys) {
  const gewuenscht = new Set(opts.keys);
  const unbekannt = [...gewuenscht].filter((k) => !dateien.some((d) => d.key === k));
  if (unbekannt.length) {
    die(`Nicht in der Sicherung vom ${tag}: ${unbekannt.join(", ")}`);
  }
  dateien = dateien.filter((d) => gewuenscht.has(d.key));
}

const gesichert = new Map();
for (const d of dateien) {
  if (!d.key.startsWith("nw_")) {
    die(`Schlüssel "${d.key}" beginnt nicht mit "nw_" — Supabase ließe das ohnehin nicht zu.`);
  }
  let value;
  try {
    value = JSON.parse(await readFile(join(tagDir, d.datei), "utf8"));
  } catch (err) {
    die(`${d.datei} ist nicht lesbar oder kein gültiges JSON: ${err instanceof Error ? err.message : err}`);
  }
  gesichert.set(d.key, value);
}

// ── Aktuellen Stand holen und vergleichen ──────────────────────────────────
const res = await supabase(`?select=key,value&key=like.${encodeURIComponent("nw_*")}`);
const aktuell = new Map(((await res.json()) ?? []).map((r) => [r.key, r.value]));

const gleich = [], anders = [], neu = [];
for (const [key, value] of gesichert) {
  if (!aktuell.has(key)) neu.push(key);
  else if (kanonisch(aktuell.get(key)) === kanonisch(value)) gleich.push(key);
  else anders.push(key);
}
const zuSchreiben = [...anders, ...neu];

console.log(`Sicherung vom ${tag} — ${gesichert.size} Schlüssel geprüft\n`);
console.log(`  unverändert: ${gleich.length}`);
console.log(`  abweichend:  ${anders.length}${anders.length ? "  → " + anders.join(", ") : ""}`);
console.log(`  fehlt in Supabase: ${neu.length}${neu.length ? "  → " + neu.join(", ") : ""}`);

if (!zuSchreiben.length) {
  console.log("\nNichts zurückzuschreiben — Supabase entspricht der Sicherung.");
  process.exit(0);
}

if (!opts.schreiben) {
  console.log(`\nProbelauf: es wurde nichts verändert.`);
  console.log(`Zum tatsächlichen Zurückschreiben denselben Aufruf mit --schreiben wiederholen.`);
  process.exit(0);
}

// ── Sicherheitskopie des aktuellen Stands ──────────────────────────────────
const stempel = new Date().toISOString().replace(/[:.]/g, "-");
const rettung = join(BACKUP_DIR, "_vor-wiederherstellung", stempel);
await mkdir(rettung, { recursive: true });
for (const key of zuSchreiben) {
  if (!aktuell.has(key)) continue;
  const name = `${key.replace(/[^A-Za-z0-9_.-]/g, "_")}.json`;
  await writeFile(join(rettung, name), JSON.stringify(aktuell.get(key), null, 2), "utf8");
}
await writeFile(
  join(rettung, "_manifest.json"),
  JSON.stringify({ erstellt_am: new Date().toISOString(), grund: `vor Wiederherstellung von ${tag}`, schluessel: zuSchreiben }, null, 2),
  "utf8",
);
console.log(`\nStand vor der Wiederherstellung gesichert: ${rettung}`);

// ── Zurückschreiben ────────────────────────────────────────────────────────
let geschrieben = 0;
for (const key of zuSchreiben) {
  await supabase("?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value: gesichert.get(key), updated_at: new Date().toISOString() }),
  });
  geschrieben += 1;
  console.log(`  ✓ ${key}`);
}
console.log(`\n${geschrieben} Schlüssel aus der Sicherung vom ${tag} zurückgeschrieben.`);
