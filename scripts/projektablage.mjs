#!/usr/bin/env node
/**
 * Projektablage: legt Dokumente, die in der Angebots-App hochgeladen wurden, im
 * OneDrive-Projektordner ab.
 *
 *   node scripts/projektablage.mjs            eine Runde ablegen
 *   node scripts/projektablage.mjs --probe    nur anzeigen, was passieren würde
 *
 * Die App legt je Datei eine Job-Zeile „docjob-<id>“ und eine oder mehrere
 * Datenzeilen „docchunk-<id>-<n>“ in der Tabelle app_state ab. Dieses Skript
 * sucht den Projektordner „<Nummer>_<Name>“ unter PROJEKT_ABLAGE_ROOT, schreibt
 * die Datei in den gewünschten Unterordner, meldet Status und Pfad an die
 * Job-Zeile zurück und löscht danach die Datenzeilen. OneDrive lädt die Datei
 * von dort selbst hoch.
 *
 * Aufgerufen wird es von scripts/projektablage.sh (LaunchAgent, alle 2 Minuten).
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PROBE = process.argv.includes("--probe");
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT_MS = 60000;
const KEEP_DONE_DAYS = 30;

/* Unterordner, in die abgelegt werden darf – entspricht der bestehenden Projektstruktur. */
const ZIELE = new Set([
  "Auftragsabwicklung/Ausschreibung Briefing Kunde",
  "Auftragsabwicklung/Angebote an Kunden",
  "Auftragsabwicklung/Auftragsbestätigungen",
  "Auftragsabwicklung/Rechnungen an Kunde",
  "Externe Lieferanten",
  "Rechnungen/In",
  "Rechnungen/Out",
  "Technik/Beleuchtungstechnik",
  "Technik/Beschallungstechnik",
  "Technik/AV Medientechnik",
  "Technik/Rigging",
  "Technik/Deko Messebau",
  "Technik/Kommunikationsmittel",
  "CAD",
  "Visualisierungen",
  "Zeitpläne",
  "Locationinfos",
  "Disposition",
  "Crew",
  "Kommunikation",
  "Bilder Vorbesichtigung",
  "Bilder VA",
  "Schäden",
  "Dokumente",
  "Vorlagen",
]);

/* Grundstruktur für einen neuen Projektordner, falls es noch keinen gibt. */
const STRUKTUR = [
  "Auftragsabwicklung/Angebote an Kunden",
  "Auftragsabwicklung/Auftragsbestätigungen",
  "Auftragsabwicklung/Ausschreibung Briefing Kunde",
  "Auftragsabwicklung/Rechnungen an Kunde",
  "Bilder VA",
  "Bilder Vorbesichtigung",
  "CAD",
  "Crew",
  "Disposition",
  "Dokumente/OSM Dokumente",
  "Externe Lieferanten",
  "Kommunikation",
  "Locationinfos",
  "Rechnungen/In",
  "Rechnungen/Out",
  "Schäden",
  "Technik/AV Medientechnik",
  "Technik/Beleuchtungstechnik",
  "Technik/Beschallungstechnik",
  "Technik/Deko Messebau",
  "Technik/Kommunikationsmittel",
  "Technik/Rigging",
  "Visualisierungen",
  "Vorlagen",
  "Zeitpläne",
];

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}
function die(msg) {
  console.error(`FEHLER ${msg}`);
  process.exit(1);
}

/* ── Supabase-Zugang ─────────────────────────────────────────────────────── */

/** URL und öffentlicher Schlüssel stehen in angebote.html; die Umgebung kann sie überschreiben. */
function appConfig() {
  let url = process.env.NOVA_ANGEBOTE_URL || "";
  let key = process.env.NOVA_ANGEBOTE_KEY || "";
  if (!url || !key) {
    try {
      const html = readFileSync(join(REPO, "angebote.html"), "utf8");
      url = url || (html.match(/var SB_URL="([^"]+)"/) || [])[1] || "";
      key = key || (html.match(/var SB_KEY="([^"]+)"/) || [])[1] || "";
    } catch {
      /* fällt unten auf */
    }
  }
  if (!url || !key) die("Supabase-URL/-Schlüssel der Angebots-App nicht gefunden (angebote.html im Repo?).");
  return { url: url.replace(/\/$/, ""), key };
}

async function withTimeout(fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error(`Zeitüberschreitung nach ${TIMEOUT_MS / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Anmeldung: Service-Schlüssel, sonst E-Mail und Passwort eines App-Benutzers. */
async function login(cfg) {
  const service = process.env.NOVA_ANGEBOTE_SERVICE_KEY;
  if (service) return service;
  let email = (process.env.NOVA_ANGEBOTE_EMAIL || "").trim();
  // Wie im Login der App: Benutzername ohne „@“ → <name>@team.nova-works.de
  if (email && !email.includes("@")) email = `${email.toLowerCase()}@team.nova-works.de`;
  const password = process.env.NOVA_ANGEBOTE_PASSWORD;
  if (!email || !password) {
    throw new Error("Keine Anmeldung konfiguriert. In ~/.nova-works/env NOVA_ANGEBOTE_EMAIL und NOVA_ANGEBOTE_PASSWORD eintragen.");
  }
  const res = await withTimeout((signal) =>
    fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: cfg.key, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal,
    }),
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const why = body.error_description || body.msg || body.error || "";
    const hint = /invalid login/i.test(why)
      ? ` – E-Mail „${email}“ oder Passwort stimmt nicht. Neu eingeben mit: ./scripts/install-projektablage.sh --login`
      : "";
    throw new Error(`Anmeldung bei der Angebots-App fehlgeschlagen (HTTP ${res.status}): ${why}${hint}`);
  }
  return body.access_token;
}

function api(cfg, token) {
  const headers = { apikey: cfg.key, Authorization: `Bearer ${token}`, "content-type": "application/json" };
  const base = `${cfg.url}/rest/v1/app_state`;
  const call = async (method, query, body, extra) => {
    const res = await withTimeout((signal) =>
      fetch(`${base}?${query}`, { method, headers: { ...headers, ...(extra || {}) }, body: body ? JSON.stringify(body) : undefined, signal }),
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Supabase ${method} HTTP ${res.status}: ${t.trim().slice(0, 200)}`);
    }
    return method === "GET" ? res.json() : null;
  };
  return {
    jobs: () => call("GET", `select=id,data,updated_at&id=like.${encodeURIComponent("docjob-*")}&order=id`),
    chunks: (docId) => call("GET", `select=id,data&id=like.${encodeURIComponent(`docchunk-${docId}-*`)}`),
    update: (id, data) =>
      call("PATCH", `id=eq.${encodeURIComponent(id)}`, { data, updated_at: new Date().toISOString() }, { Prefer: "return=minimal" }),
    remove: (pattern) => call("DELETE", `id=like.${encodeURIComponent(pattern)}`, null, { Prefer: "return=minimal" }),
    removeOne: (id) => call("DELETE", `id=eq.${encodeURIComponent(id)}`, null, { Prefer: "return=minimal" }),
  };
}

/* ── Ablageort ───────────────────────────────────────────────────────────── */

/** Stammordner „Angebote“ im synchronisierten OneDrive finden. */
function findRoot() {
  const fromEnv = process.env.PROJEKT_ABLAGE_ROOT;
  if (fromEnv) {
    if (!existsSync(fromEnv) || !statSync(fromEnv).isDirectory()) die(`PROJEKT_ABLAGE_ROOT existiert nicht: ${fromEnv}`);
    return resolve(fromEnv);
  }
  const home = homedir();
  const cands = [];
  const cloud = join(home, "Library", "CloudStorage");
  try {
    for (const e of readdirSync(cloud)) if (/^OneDrive/i.test(e)) cands.push(join(cloud, e, "Angebote"));
  } catch {
    /* kein CloudStorage-Ordner */
  }
  try {
    for (const e of readdirSync(home)) if (/^OneDrive/i.test(e)) cands.push(join(home, e, "Angebote"));
  } catch {
    /* ignorieren */
  }
  const found = [...new Set(cands)].filter((c) => existsSync(c) && statSync(c).isDirectory());
  if (found.length === 1) return found[0];
  if (!found.length) die("OneDrive-Ordner „Angebote“ nicht gefunden. In ~/.nova-works/env PROJEKT_ABLAGE_ROOT setzen.");
  die(`Mehrere OneDrive-Ordner „Angebote“ gefunden, bitte PROJEKT_ABLAGE_ROOT setzen:\n  ${found.join("\n  ")}`);
}

function safeSegment(s) {
  return String(s || "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 150);
}

/** Pfad muss innerhalb von base liegen (kein „..“). */
function inside(base, target) {
  const rel = relative(base, target);
  return Boolean(rel) && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/** Projektordner zu einer Nummer: genau einer → nehmen; keiner → anlegen; mehrere → Name oder Wahl nötig. */
function projectFolder(root, job) {
  const nummer = String(job.nummer || "").trim();
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && (e.name === nummer || e.name.startsWith(`${nummer}_`) || e.name.startsWith(`${nummer} `)))
    .map((e) => e.name);
  // In der App gewählter oder zuletzt benutzter Ordner; wurde er inzwischen
  // umbenannt, wird wie ohne Wahl gesucht.
  if (job.ordner && dirs.includes(job.ordner)) return { name: job.ordner };
  if (dirs.length === 1) return { name: dirs[0] };
  const wanted = safeSegment(`${nummer}_${job.projekt || ""}`);
  if (dirs.length > 1) {
    const exact = dirs.find((d) => d.toLowerCase() === wanted.toLowerCase());
    return exact ? { name: exact } : { ambiguous: dirs };
  }
  return { create: job.projekt ? wanted : nummer };
}

async function uniqueTarget(dir, name, bytes) {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 1; i < 100; i++) {
    const candidate = join(dir, i === 1 ? name : `${stem} (${i})${ext}`);
    if (!existsSync(candidate)) return { path: candidate, existed: false };
    // Gleicher Inhalt liegt schon dort (etwa nach abgebrochenem Lauf) → nicht doppelt ablegen.
    try {
      const cur = await readFile(candidate);
      if (cur.length === bytes.length && cur.equals(bytes)) return { path: candidate, existed: true };
    } catch {
      /* weiter mit nächstem Namen */
    }
  }
  throw new Error("kein freier Dateiname gefunden");
}

function webUrlFor(folder, sub, file) {
  const base = process.env.PROJEKT_ABLAGE_WEB;
  if (!base) return "";
  const segs = [folder, ...sub.split("/"), file].map((s) => encodeURIComponent(s).replace(/%2F/g, "/"));
  return `${base.replace(/\/$/, "")}/${segs.join("/")}`;
}

/* ── Eine Runde ──────────────────────────────────────────────────────────── */

async function lock() {
  const file = join(homedir(), ".nova-works", "projektablage.lock");
  await mkdir(dirname(file), { recursive: true });
  try {
    const st = statSync(file);
    if (Date.now() - st.mtimeMs < 15 * 60 * 1000) die("Eine andere Runde läuft noch (Sperrdatei jünger als 15 Min).");
  } catch {
    /* keine Sperre */
  }
  const fh = await open(file, "w");
  await fh.writeFile(String(process.pid));
  await fh.close();
  return () => rm(file, { force: true });
}

async function main() {
  const cfg = appConfig();
  const root = findRoot();
  const unlock = PROBE ? async () => {} : await lock();
  try {
    const token = await login(cfg);
    const db = api(cfg, token);
    const rows = await db.jobs();
    if (PROBE) {
      const n = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
      log(`OneDrive-Ordner: ${root} (${n} Projektordner)`);
      log(`Anmeldung an der Angebots-App: OK · ${rows.filter((r) => (r.data || {}).status !== "abgelegt").length} Datei(en) offen`);
    }
    let done = 0;
    let waiting = 0;
    let failed = 0;
    for (const row of rows) {
      const job = row.data || {};
      const id = row.id;
      if (job.status === "abgelegt") {
        // Alte, erledigte Jobs aufräumen – die App hat ihren eigenen Eintrag.
        const age = Date.now() - Date.parse(job.abgelegtAm || row.updated_at || 0);
        if (!PROBE && age > KEEP_DONE_DAYS * 86400000) await db.removeOne(id);
        continue;
      }
      // Fehler bleiben stehen, bis in der App „Erneut versuchen“ gedrückt wird.
      if (job.status === "fehler") {
        failed++;
        continue;
      }
      if (job.status === "mehrdeutig" && !job.ordner) {
        waiting++;
        continue;
      }
      if (!job.nummer) {
        // Nie einem Projekt zugeordnet: nach 30 Tagen samt Daten verwerfen.
        const since = Date.now() - Date.parse(job.ts || row.updated_at || 0);
        if (!PROBE && since > KEEP_DONE_DAYS * 86400000) {
          await db.remove(`docchunk-${job.docId}-*`);
          await db.removeOne(id);
          log(`${id}: „${job.name}“ ohne Projekt seit ${KEEP_DONE_DAYS} Tagen – verworfen`);
          continue;
        }
        waiting++;
        if (job.status !== "projekt-fehlt" && !PROBE) await db.update(id, { ...job, status: "projekt-fehlt" });
        continue;
      }
      const sub = String(job.ziel || "Dokumente");
      if (!ZIELE.has(sub)) {
        failed++;
        log(`${id}: unbekannter Zielordner „${sub}“`);
        if (!PROBE) await db.update(id, { ...job, status: "fehler", fehler: `unbekannter Zielordner „${sub}“` });
        continue;
      }
      const pf = projectFolder(root, job);
      if (pf.error) {
        failed++;
        log(`${id}: ${pf.error}`);
        if (!PROBE) await db.update(id, { ...job, status: "fehler", fehler: pf.error });
        continue;
      }
      if (pf.ambiguous) {
        waiting++;
        log(`${id}: ${job.nummer} – mehrere Projektordner: ${pf.ambiguous.join(" | ")}`);
        if (!PROBE) await db.update(id, { ...job, status: "mehrdeutig", kandidaten: pf.ambiguous });
        continue;
      }
      const folderName = pf.name || pf.create;
      const projectDir = join(root, folderName);
      const targetDir = join(projectDir, ...sub.split("/"));
      if (!inside(root, targetDir)) {
        failed++;
        log(`${id}: Zielpfad liegt außerhalb der Ablage – übersprungen`);
        continue;
      }
      const fileName = safeSegment(job.name) || "Datei";
      if (PROBE) {
        log(`PROBE ${job.nummer}: „${fileName}“ → ${folderName}/${sub}${pf.create ? " (Projektordner würde angelegt)" : ""}`);
        continue;
      }
      try {
        const parts = await db.chunks(job.docId);
        if (parts.length !== Number(job.chunks)) throw new Error(`Datenteile unvollständig (${parts.length} von ${job.chunks})`);
        parts.sort((a, b) => Number(a.id.split("-").pop()) - Number(b.id.split("-").pop()));
        const bytes = Buffer.concat(parts.map((p) => Buffer.from((p.data && p.data.b64) || "", "base64")));
        if (job.size && bytes.length !== Number(job.size)) throw new Error(`Größe stimmt nicht (${bytes.length} statt ${job.size} Bytes)`);
        if (pf.create) {
          for (const s of STRUKTUR) await mkdir(join(projectDir, ...s.split("/")), { recursive: true });
          log(`${job.nummer}: Projektordner angelegt: ${folderName}`);
        }
        await mkdir(targetDir, { recursive: true });
        const target = await uniqueTarget(targetDir, fileName, bytes);
        if (!target.existed) {
          const tmp = `${target.path}.ablage-tmp`;
          await writeFile(tmp, bytes);
          await rename(tmp, target.path);
        }
        const rel = relative(root, target.path).split(sep).join("/");
        const fileOnly = rel.split("/").pop();
        await db.update(id, {
          ...job,
          status: "abgelegt",
          pfad: rel,
          ordnerName: folderName,
          webUrl: webUrlFor(folderName, sub, fileOnly),
          abgelegtAm: new Date().toISOString(),
          fehler: undefined,
          kandidaten: undefined,
        });
        await db.remove(`docchunk-${job.docId}-*`);
        done++;
        log(`${job.nummer}: „${fileOnly}“ → ${folderName}/${sub}${target.existed ? " (lag schon dort)" : ""}`);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        log(`${id}: ${msg}`);
        await db.update(id, { ...job, status: "fehler", fehler: msg }).catch(() => {});
      }
    }
    if (done || PROBE) log(`Runde fertig: ${done} abgelegt, ${waiting} warten, ${failed} Fehler.`);
  } finally {
    await unlock();
  }
}

main().catch((err) => die(err instanceof Error ? err.message : String(err)));
