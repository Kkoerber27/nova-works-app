#!/usr/bin/env node
/**
 * Erzeugt aus den gesammelten Meldungen ein Scheinwerfer-Protokoll als HTML
 * und auf Wunsch als PDF.
 *
 *   node scripts/protokoll.mjs daten.json
 *   node scripts/protokoll.mjs daten.json --pdf
 *   node scripts/protokoll.mjs daten.json --out ~/Desktop/protokoll.html --pdf
 *   node scripts/protokoll.mjs daten.json --pdf --ablegen
 *   node scripts/protokoll.mjs daten.json --pdf --fotos ~/Fotos/technik
 *   node scripts/protokoll.mjs daten.json --pdf --ablegen --ordner "Schäden"
 *
 * Die Daten schreibt der Skill .claude/skills/scheinwerfer-protokoll/SKILL.md.
 * Das Format steht dort beschrieben; ein Beispiel liegt in
 * .claude/skills/scheinwerfer-protokoll/beispiel.json.
 *
 * Für das PDF wird ein bereits installierter Chromium-Browser im Kopflos-Modus
 * benutzt (Chrome, Edge, Brave). Absichtlich keine zusätzliche Abhängigkeit:
 * auf einem Mac mit Microsoft 365 ist Edge ohnehin da, und ein Paket, das nur
 * zum Drucken installiert werden muss, veraltet zwischen zwei Protokollen.
 */

import { execFileSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

/* ------------------------------------------------------------------ Eingabe */

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const outIndex = args.indexOf("--out");
const outArg = outIndex >= 0 ? args[outIndex + 1] : null;
if (outArg && positional.includes(outArg)) positional.splice(positional.indexOf(outArg), 1);

/* Zielordner im Projekt. Vorgabe "Lampen Protokolle", nicht "Schäden": Das
   Protokoll ist in erster Linie eine Bestandsaufnahme — was wo hängt und wie
   viele —, und nur im Einzelfall ein Schadensnachweis. Unter "Schäden" sucht es
   niemand, der bloss wissen will, was im Hauptzelt stand. */
const ordnerIndex = args.indexOf("--ordner");
const ordnerArg = ordnerIndex >= 0 ? args[ordnerIndex + 1] : null;
if (ordnerArg && positional.includes(ordnerArg)) positional.splice(positional.indexOf(ordnerArg), 1);
const ABLAGE_ORDNER = ordnerArg || process.env.PROTOKOLL_ABLAGE_ORDNER || "Lampen Protokolle";

const quelle = positional[0];
if (!quelle) {
  console.error("Aufruf: node scripts/protokoll.mjs <daten.json> [--out <datei.html>] [--pdf]");
  process.exit(2);
}
if (!existsSync(quelle)) {
  console.error(`FEHLER Datei nicht gefunden: ${quelle}`);
  process.exit(1);
}

let daten;
try {
  daten = JSON.parse(readFileSync(quelle, "utf8"));
} catch (err) {
  console.error(`FEHLER ${quelle} ist kein gültiges JSON: ${err.message}`);
  process.exit(1);
}

const positionen = Array.isArray(daten.positionen) ? daten.positionen : [];
if (positionen.length === 0) {
  console.error("FEHLER Keine Positionen in den Daten — es gibt nichts zu protokollieren.");
  process.exit(1);
}

/* ------------------------------------------------------------------ Helfer */

const escapeHtml = (wert) =>
  String(wert ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** 5149962 → "4,9 MB". Dateigrößen im Protokoll sind ein Qualitätsmerkmal:
 *  ein Foto unter 500 KB wurde vom Mailprogramm neu berechnet. */
function dateigroesse(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Uhrzeit so ausgeben, wie sie in der Meldung steht — nicht in die Zeitzone
 * des ausführenden Rechners umgerechnet. Ein Protokoll hält fest, wann die
 * Crew vor Ort gemeldet hat; liefe das Skript einmal auf einem Server in UTC,
 * stünden sonst zwei Stunden zu wenig im Dokument.
 */
function uhrzeit(iso) {
  if (!iso) return "";
  const treffer = /T(\d{2}):(\d{2})/.exec(String(iso));
  if (treffer) return `${treffer[1]}:${treffer[2]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function datumLang(wert) {
  if (!wert) return "";
  const treffer = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(wert));
  if (treffer) return `${treffer[3]}.${treffer[2]}.${treffer[1]}`;
  const d = new Date(wert);
  if (Number.isNaN(d.getTime())) return String(wert);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** "31.08." — ohne Jahr, weil das Jahr rechts daneben schon steht. */
function datumKurz(iso) {
  const teile = String(iso).split("-");
  return teile.length === 3 ? `${teile[2]}.${teile[1]}.` : String(iso);
}

/** Anzahl Kalendertage einschliesslich Anfang und Ende. */
function tageZwischen(von, bis) {
  const tag = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / tag) + 1;
}

/* ------------------------------------------------------------- Miniaturen */

/** Längste Kante der eingebetteten Miniatur. Ein Originalfoto ist rund 5 MB;
 *  eingebettet als Data-URI wären zehn davon ein PDF jenseits von 50 MB. Als
 *  Beleg dient ohnehin die Datei im Postfach, im Protokoll genügt das Bild zum
 *  Wiedererkennen. */
const MINI_KANTE = 900;
const MINI_QUALITAET = 72;

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Verkleinert mit dem, was da ist: sips gehört zu macOS, ImageMagick ist auf
 *  Servern üblich. Ist keins von beidem da, wird das Original eingebettet —
 *  lieber ein großes Protokoll als eines ohne Bilder. */
function verkleinern(von, nach) {
  const versuche = [
    ["sips", ["-s", "format", "jpeg", "-s", "formatOptions", String(MINI_QUALITAET),
              "-Z", String(MINI_KANTE), von, "--out", nach]],
    ["magick", [von, "-resize", `${MINI_KANTE}x${MINI_KANTE}>`, "-quality", String(MINI_QUALITAET), nach]],
    ["convert", [von, "-resize", `${MINI_KANTE}x${MINI_KANTE}>`, "-quality", String(MINI_QUALITAET), nach]],
  ];
  for (const [werkzeug, argumente] of versuche) {
    try {
      execFileSync(werkzeug, argumente, { stdio: "ignore", timeout: 30_000 });
      if (existsSync(nach)) return true;
    } catch {
      // Werkzeug fehlt oder kam nicht zurecht — das nächste probieren.
    }
  }
  return false;
}

/* --------------------------------------------------- Fotos aus dem Flow ---
   Ein Power-Automate-Flow legt die Anhänge aus technik@ in einem Ordner ab und
   benennt sie nach dem Empfangszeitpunkt: 20260831-134756-image0.jpeg. Genau
   dieselbe Angabe steht als `empfangen` bei der Meldung, beides stammt aus dem
   Feld receivedDateTime. Deshalb ist die Zuordnung eine exakte Übereinstimmung
   und kein Zeitfenster, in dem zwei Meldungen kurz nacheinander kollidieren. */

const fotoOrdner = (() => {
  const i = args.indexOf("--fotos");
  const pfad = i >= 0 ? args[i + 1] : daten.fotoordner;
  if (!pfad) return null;
  const voll = resolve(dirname(resolve(quelle)), pfad);
  if (!existsSync(voll)) {
    console.error(`WARNUNG Fotoordner nicht gefunden: ${voll}`);
    return null;
  }
  return voll;
})();
if (fotoOrdner && positional.includes(args[args.indexOf("--fotos") + 1])) {
  positional.splice(positional.indexOf(args[args.indexOf("--fotos") + 1]), 1);
}

/** "2026-08-31T13:47:56.000Z" → "20260831-134756" */
function fotoSchluessel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[1]}${m[2]}${m[3]}-${m[4]}${m[5]}${m[6]}` : null;
}

const fotoIndex = new Map();
if (fotoOrdner) {
  for (const name of readdirSync(fotoOrdner).sort()) {
    const m = /^(\d{8}-\d{6})/.exec(name);
    if (!m) continue;
    if (!fotoIndex.has(m[1])) fotoIndex.set(m[1], []);
    fotoIndex.get(m[1]).push(join(fotoOrdner, name));
  }
}

let zugeordnet = 0;
const ohneZuordnung = [];
if (fotoOrdner) {
  for (const position of positionen) {
    const schluessel = fotoSchluessel(position.empfangen);
    const treffer = schluessel ? fotoIndex.get(schluessel) : null;
    if (!treffer) {
      if (Array.isArray(position.fotos) && position.fotos.length && !position.fotos.some((f) => f.datei)) {
        ohneZuordnung.push(`${position.geraet || position.standort} (${uhrzeit(position.zeit)})`);
      }
      continue;
    }
    if (!Array.isArray(position.fotos) || position.fotos.length === 0) {
      position.fotos = treffer.map((pfad) => ({ name: basename(pfad), datei: pfad }));
    } else {
      // Ausdrücklich eingetragene Pfade haben Vorrang.
      position.fotos.forEach((f, i) => {
        if (!f.datei && treffer[i]) f.datei = treffer[i];
      });
    }
    zugeordnet += treffer.length;
  }
}

const fehlendeBilder = [];
let ohneVerkleinerung = 0;
const miniOrdner = mkdtempSync(join(tmpdir(), "nova-mini-"));

/** Pfad → Data-URI. Pfade dürfen relativ zur Datendatei stehen. */
function miniatur(pfad) {
  const voll = resolve(dirname(resolve(quelle)), pfad);
  if (!existsSync(voll)) {
    fehlendeBilder.push(pfad);
    return null;
  }
  const ziel = join(miniOrdner, `${createHash("sha1").update(voll).digest("hex")}.jpg`);
  if (verkleinern(voll, ziel)) {
    return `data:image/jpeg;base64,${readFileSync(ziel).toString("base64")}`;
  }
  ohneVerkleinerung += 1;
  const typ = MIME[extname(voll).toLowerCase()] ?? "image/jpeg";
  return `data:${typ};base64,${readFileSync(voll).toString("base64")}`;
}

const CHIP = {
  vollstaendig: { klasse: "ok", text: "Vollständig" },
  unvollstaendig: { klasse: "gap", text: "Unvollständig" },
  dublette: { klasse: "dupe", text: "Dublette" },
};

/* ------------------------------------------------------------- Kennzahlen */

/** Eine Meldung kann eine Lampe betreffen oder eine ganze Traverse. Ohne
 *  Angabe ist es eine. */
function anzahlVon(position) {
  const n = Number(position.anzahl);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

const echte = positionen.filter((p) => p.status !== "dublette");
const scheinwerfer = echte.reduce((summe, p) => summe + anzahlVon(p), 0);
const vollstaendig = echte
  .filter((p) => p.status === "vollstaendig")
  .reduce((summe, p) => summe + anzahlVon(p), 0);

const zeiten = positionen.map((p) => p.zeit).filter(Boolean).sort();
const zeitraumRoh =
  daten.zeitraum ||
  (zeiten.length >= 2
    ? `${uhrzeit(zeiten[0])} – ${uhrzeit(zeiten[zeiten.length - 1])}`
    : uhrzeit(zeiten[0]) || "—");

const datum = daten.datum || (zeiten[0] ? zeiten[0].slice(0, 10) : "");
/* Über mehrere Tage ist eine Uhrzeitspanne sinnlos: "21:05 – 16:44" liest sich
   wie ein Tag und war keiner. Dann zählen die Tage, nicht die Stunden. */
const datumBis = daten.datumBis || (zeiten.length ? zeiten[zeiten.length - 1].slice(0, 10) : datum);
const mehrtaegig = Boolean(datumBis && datumBis !== datum);

/* Woher die Meldungen kamen, steht im Kopf — sonst liest jemand später „aus der
   Betreffzeile“ über einem Protokoll, das aus einem Gruppenchat stammt, und
   sucht Mails, die es nie gab. */
const ausWhatsApp = /whatsapp/i.test(String(daten.postfach || ""));
const herkunftSatz = ausWhatsApp
  ? `im <code>WhatsApp-Export</code> der Gruppe.`
  : `an <code>${escapeHtml(daten.postfach || "technik@nova-works.de")}</code>.`;

/* ------------------------------------------------------------------- Bausteine */

function fotoZelle(position) {
  const fotos = Array.isArray(position.fotos) ? position.fotos : [];
  const videos = Array.isArray(position.videos) ? position.videos : [];

  /* Videos werden benannt, nicht gezeigt: Als Bild eingebettet ergäben sie ein
     leeres Rechteck. Verschweigen wäre falsch — sie liegen im Export und sind
     oft der aussagekräftigere Beleg, weil man den Schwenk über die Traverse
     sieht statt eines Ausschnitts. */
  const videoText = videos.length
    ? `${videos.length} Video${videos.length > 1 ? "s" : ""}`
    : "";

  if (fotos.length === 0) {
    return videoText
      ? `<span class="none">kein Foto</span><span class="sub">${escapeHtml(videoText)}</span>`
      : '<span class="none">keins</span>';
  }

  const groessen = fotos.map((f) => dateigroesse(f.groesse)).filter(Boolean);
  const label = `${fotos.length} × ${groessen.join(", ") || "Foto"}`;
  // Klein heißt: beim Versand verkleinert, Details für einen Nachweis fort.
  const klein = fotos.some((f) => typeof f.groesse === "number" && f.groesse < 500 * 1024);
  const kern = klein
    ? `${escapeHtml(label)} <span class="warn" title="unter 500 KB — beim Versand verkleinert">verkleinert</span>`
    : escapeHtml(label);
  return videoText ? `${kern}<span class="sub">${escapeHtml(videoText)}</span>` : kern;
}

function zeile(position) {
  const chip = CHIP[position.status] ?? CHIP.unvollstaendig;
  const zustand = position.zustand
    ? escapeHtml(position.zustand)
    : '<span class="empty">nicht angegeben</span>';

  const untertitel = [uhrzeit(position.zeit), position.absender, position.hinweis]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");

  const typ = position.geraetetyp
    ? `<span class="typ">${escapeHtml(position.geraetetyp)}</span>`
    : "";

  const standort = position.mail
    ? `<a href="${escapeHtml(position.mail)}">${escapeHtml(position.standort || "—")}</a>`
    : escapeHtml(position.standort || "—");

  const anzahl = anzahlVon(position);
  const bezeichner = position.geraet
    ? escapeHtml(position.geraet)
    : `${anzahl}&nbsp;Stück`;

  // Nur Fotos mit hinterlegter Datei landen im Dokument. Die übrigen sind
  // trotzdem in der Foto-Spalte gezählt — sie liegen im Postfach.
  const bilder = (Array.isArray(position.fotos) ? position.fotos : [])
    .filter((f) => f.datei)
    .map((f) => ({ uri: miniatur(f.datei), name: f.name || f.datei }))
    .filter((b) => b.uri);

  const streifen = bilder.length
    ? `\n        <div class="fotos">${bilder
        .map((b) => `<img src="${b.uri}" alt="${escapeHtml(b.name)}">`)
        .join("")}</div>`
    : "";

  return `      <div class="row">
        <div class="id">${bezeichner}${typ}</div>
        <div class="place"><span class="cell-label">Standort</span>${standort}<span class="sub">${untertitel}</span></div>
        <div class="cond"><span class="cell-label">Zustand</span>${zustand}</div>
        <div class="photo"><span class="cell-label">Foto</span>${fotoZelle(position)}</div>
        <div><span class="chip ${chip.klasse}">${chip.text}</span></div>${streifen}
      </div>`;
}

function hinweisBlock(hinweis) {
  return `      <div class="finding">
        <div class="who">${escapeHtml(hinweis.bezug || "Allgemein")}</div>
        <div>
          <h3>${escapeHtml(hinweis.titel || "")}</h3>
          <p>${escapeHtml(hinweis.text || "")}</p>
        </div>
      </div>`;
}

/* ------------------------------------------------------------------- Stil */

/* Farben und Schrift stammen aus Crewplanung.html, damit das Protokoll wie die
   übrigen Werkzeuge aussieht: warmes Off-White, Schwarz, Gold. Bewusst keine
   Google-Schrift — die Werkzeuge nutzen Helvetica, und ein PDF, das erst eine
   Schrift nachladen muss, sieht ohne Netz anders aus als mit. */
const STIL = `
  :root {
    --paper:#f4f3f1; --surface:#ffffff; --surface-2:#eceae7;
    --ink:#1a1a1a; --ink-2:#444444; --muted:#888888;
    --rule:#d9d6d1; --rule-2:#e8e5e0;
    --accent:#a07840; --accent-hell:#c8a96e;
    --licht:#4a7fb5;
    --ok:#3f7a54; --ok-bg:#e2ede6;
    --dupe:#a45a26; --dupe-bg:#f4e4d8;
    --note:#5a5a5a; --note-bg:#e6e3de;
    --body:"Helvetica Neue",Helvetica,Arial,sans-serif;
    --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper:#141414; --surface:#1e1e1e; --surface-2:#252525;
      --ink:#e8e8e8; --ink-2:#bbbbbb; --muted:#888888;
      --rule:#3a3a3a; --rule-2:#2d2d2d;
      --accent:#c8a96e; --accent-hell:#c8a96e;
      --licht:#6f9fd0;
      --ok:#7ec293; --ok-bg:#1d2f24;
      --dupe:#d99a63; --dupe-bg:#33241a;
      --note:#a8a8a8; --note-bg:#2a2a2a;
    }
  }
  /* Das Logo ist dunkle Zeichnung auf Transparenz, gemacht für helles Papier.
     Auf dunklem Grund verschwände es, deshalb dort umgekehrt. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .blatt-kopf img { filter:invert(1); }
  }
  :root[data-theme="dark"] .blatt-kopf img { filter:invert(1); }
  :root[data-theme="light"] .blatt-kopf img { filter:none; }

  :root[data-theme="dark"] {
    --paper:#141414; --surface:#1e1e1e; --surface-2:#252525;
    --ink:#e8e8e8; --ink-2:#bbbbbb; --muted:#888888;
    --rule:#3a3a3a; --rule-2:#2d2d2d;
    --accent:#c8a96e; --accent-hell:#c8a96e;
    --licht:#6f9fd0;
    --ok:#7ec293; --ok-bg:#1d2f24;
    --dupe:#d99a63; --dupe-bg:#33241a;
    --note:#a8a8a8; --note-bg:#2a2a2a;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font-family:var(--body);
         font-size:15px; line-height:1.55; -webkit-font-smoothing:antialiased; }
  .sheet { max-width:64rem; margin:0 auto; padding:0 clamp(1rem,4vw,2.5rem) 3.5rem; }

  /* Blattkopf wie in den übrigen Hauswerkzeugen: freigestelltes Logo auf
     Papier, darunter der Titel, darunter eine 2 px starke schwarze Linie —
     .sheet-head in funkgeraete.html und .print-header in Crewplanung.html.
     Das frühere dunkle Band war keine Hausform, sondern eine Notlösung: das
     alte Logo-Asset hatte einen schwarzen Grund und war auf Papier nicht zu
     gebrauchen. Mit dem freigestellten Logo entfällt der Grund. */
  .blatt-kopf { display:flex; align-items:flex-end; justify-content:space-between;
                gap:1.5rem; flex-wrap:wrap; margin:0 0 1.5rem;
                border-bottom:2px solid var(--ink); padding-bottom:.7rem; }
  .blatt-kopf img { height:30px; width:auto; display:block; margin-bottom:.55rem; }
  .kennung { text-align:right; line-height:1.5; font-size:.72rem; color:var(--ink-2);
             display:flex; flex-direction:column; align-items:flex-end; gap:.5rem; }
  .kennung .objekt { color:var(--ink); font-size:.78rem; font-weight:600;
                     letter-spacing:.12em; text-transform:uppercase; }
  /* Öffnet den Druckdialog des Browsers; dort führt „Als PDF sichern" zum
     selben Ergebnis wie protokoll.mjs --pdf. Im Druck ist der Knopf weg —
     er hat auf einem Nachweis nichts verloren. */
  .druck { font-family:var(--body); font-size:.66rem; font-weight:600; letter-spacing:.1em;
           text-transform:uppercase; color:var(--paper); background:var(--ink);
           border:none; padding:.45rem 1rem; cursor:pointer; white-space:nowrap; }
  .druck:hover { background:var(--ink-2); }
  .druck:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .wortmarke { display:block; font-size:1.05rem; font-weight:200; letter-spacing:.42em;
               text-transform:uppercase; color:var(--ink); margin-bottom:.55rem; }

  h1 { font-size:1.32rem; font-weight:600; letter-spacing:.05em;
       text-transform:uppercase; margin:0; text-wrap:balance; }
  .lede { margin:0 0 1.5rem; max-width:60ch; color:var(--ink-2); font-size:.95rem; }

  /* Flexzeile statt Raster: bei ungerader Feldzahl streckt sich die letzte
     Zeile über die volle Breite, ein Raster ließe dort eine Lücke stehen. */
  .meta { display:flex; flex-wrap:wrap; background:var(--surface);
          border:1px solid var(--rule); border-width:1px 0 0 1px; margin-bottom:2.5rem; }
  .meta div { flex:1 1 7.5rem; padding:.75rem .95rem; display:flex; flex-direction:column;
              gap:.15rem; border:1px solid var(--rule); border-width:0 1px 1px 0; }
  .meta dt { font-size:.66rem; letter-spacing:.16em; text-transform:uppercase; color:var(--muted); }
  .meta dd { margin:0; font-family:var(--mono); font-size:.88rem; font-variant-numeric:tabular-nums; }

  section { margin-bottom:2.5rem; }
  h2 { font-size:.82rem; font-weight:600; letter-spacing:.2em; text-transform:uppercase;
       margin:0 0 .9rem; padding-bottom:.5rem; border-bottom:1px solid var(--ink);
       display:flex; align-items:center; gap:.6rem; }
  /* Der Farbtupfer ist die Gewerkefarbe „Licht" aus der Crewplanung. */
  h2::before { content:""; width:3px; align-self:stretch; background:var(--licht); }
  .section-note { margin:0 0 .9rem; color:var(--ink-2); max-width:62ch; font-size:.92rem; }

  .log { border:1px solid var(--rule); background:var(--surface); }
  .row { display:grid; grid-template-columns:6rem minmax(0,1.6fr) minmax(0,1fr) 9rem 8.5rem; gap:1rem;
         padding:.85rem 1rem; align-items:start; border-bottom:1px solid var(--rule-2); }
  .row:last-child { border-bottom:0; }
  .row.is-head { background:var(--surface-2); border-bottom:1px solid var(--rule);
                 font-size:.66rem; letter-spacing:.16em; text-transform:uppercase;
                 color:var(--muted); padding-top:.55rem; padding-bottom:.55rem; }
  .id { font-family:var(--mono); font-size:.95rem; font-variant-numeric:tabular-nums; }
  .id .typ { display:block; margin-top:.2rem; font-family:var(--body); font-size:.7rem; color:var(--muted); }
  .place { font-weight:500; }
  .place a { color:inherit; text-decoration:none; border-bottom:1px solid var(--rule); }
  .place a:hover, .place a:focus-visible { border-bottom-color:var(--accent); }
  .sub { display:block; margin-top:.2rem; font-family:var(--mono); font-size:.75rem; color:var(--muted);
         font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
  .cond { color:var(--ink-2); }
  .cond .empty { color:var(--muted); font-style:italic; }
  .photo { font-family:var(--mono); font-size:.82rem; font-variant-numeric:tabular-nums; }
  .photo .none { color:var(--dupe); }
  .photo .warn { color:var(--accent); }
  .chip { display:inline-block; font-size:.66rem; font-weight:600; letter-spacing:.12em;
          text-transform:uppercase; padding:.3rem .55rem; white-space:nowrap; }
  .chip.ok { background:var(--ok-bg); color:var(--ok); }
  .chip.gap { background:var(--note-bg); color:var(--note); }
  .chip.dupe { background:var(--dupe-bg); color:var(--dupe); }
  .cell-label { display:none; font-size:.62rem; letter-spacing:.16em; text-transform:uppercase;
                color:var(--muted); margin-bottom:.15rem; }
  .fotos { grid-column:1/-1; display:flex; flex-wrap:wrap; gap:.45rem; margin-top:.7rem; }
  .fotos img { height:120px; width:auto; max-width:100%; display:block;
               border:1px solid var(--rule); background:var(--surface-2); }

  .findings { border:1px solid var(--rule); background:var(--surface); }
  .finding { padding:.95rem 1rem; display:grid; grid-template-columns:6rem 1fr; gap:1rem;
             border-bottom:1px solid var(--rule-2); }
  .finding:last-child { border-bottom:0; }
  .finding .who { font-family:var(--mono); font-size:.82rem; color:var(--accent);
                  font-variant-numeric:tabular-nums; }
  .finding h3 { font-size:.95rem; font-weight:600; margin:0 0 .3rem; }
  .finding p { margin:0; color:var(--ink-2); max-width:62ch; font-size:.92rem; }
  code { font-family:var(--mono); font-size:.88em; background:var(--note-bg); color:var(--ink); padding:.1em .35em; }

  footer { border-top:1px solid var(--rule); padding-top:1rem; color:var(--muted);
           font-size:.8rem; max-width:62ch; }

  /* Nur für den Bildschirm: eine A4-Seite ist rund 690 px breit und fiele
     sonst in den Handy-Umbruch — das Protokoll würde als gestapelte Liste
     gedruckt und bräuchte das Dreifache an Seiten. */
  @media screen and (max-width:760px) {
    .row { grid-template-columns:1fr; gap:.55rem; padding:1rem; }
    .row.is-head { display:none; }
    .cell-label { display:block; }
    .finding { grid-template-columns:1fr; gap:.4rem; }
  }

  /* Satzspiegel wie in den übrigen Hauswerkzeugen (funkgeraete.html). */
  @page { size:A4 portrait; margin:12mm 10mm; }
  @media print {
    body { background:#fff; }
    .sheet { padding:0; max-width:none; }
    .blatt-kopf { margin-bottom:1.3rem; padding-bottom:.5rem; }
    /* Gedruckt wird auf weisses Papier — dort gilt immer die helle Fassung,
       auch wenn der Bildschirm dunkel eingestellt ist. */
    .blatt-kopf img { height:26px; filter:none; }
    .druck { display:none; }
    section { margin-bottom:1.6rem; }
    .meta { margin-bottom:1.6rem; }
    /* Engere Spalten, damit die Tabelle in den Satzspiegel passt. Die letzte
       Spalte muss „Unvollständig" am Stück fassen — das Wort bestimmt sie. */
    .row { grid-template-columns:4.4rem minmax(0,1.4fr) minmax(0,.9fr) 5.6rem 7rem;
           gap:.6rem; padding:.55rem .7rem; font-size:.84rem; }
    .finding { grid-template-columns:4.4rem 1fr; gap:.6rem; padding:.65rem .7rem; }
    .chip { font-size:.62rem; letter-spacing:.06em; padding:.22rem .4rem; }
    .fotos { gap:.35rem; margin-top:.5rem; }
    .fotos img { height:82px; }
    .row, .finding { break-inside:avoid; }
    h1, h2 { break-after:avoid; }
    .place a { border-bottom:0; }
  }
`;

/* ------------------------------------------------------------------- Seite */

/* Logo als Data-URI einbetten: das HTML soll eine einzelne Datei bleiben, die
   sich weiterleiten lässt, und im PDF darf kein Bild fehlen, nur weil das
   Skript aus einem anderen Verzeichnis aufgerufen wurde. */
const logoPfad = new URL("./assets/nova-works-logo.png", import.meta.url);
let logoTag = '<span class="wortmarke">Nova Works</span>';
try {
  const b64 = readFileSync(logoPfad).toString("base64");
  logoTag = `<img src="data:image/png;base64,${b64}" alt="Nova Works">`;
} catch {
  // Ohne Logo trägt die Wortmarke den Kopf — kein Grund, das Protokoll zu verweigern.
}

const titel = daten.objekt ? `Scheinwerfer-Protokoll ${daten.objekt}` : "Scheinwerfer-Protokoll";

const metaFelder = [
  ["Datum", mehrtaegig ? `${datumKurz(datum)} – ${datumLang(datumBis)}` : datumLang(datum) || "—"],
  ["Zeitraum", mehrtaegig ? `${tageZwischen(datum, datumBis)} Tage` : zeitraumRoh],
  ["Meldungen", String(positionen.length)],
  ["Scheinwerfer", String(scheinwerfer)],
  ["Vollständig", `${vollstaendig} von ${scheinwerfer}`],
].filter(Boolean);

const hinweise = Array.isArray(daten.hinweise) ? daten.hinweise : [];

const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(titel)}</title>
<style>${STIL}</style>
</head>
<body>
<div class="sheet">

  <header class="blatt-kopf">
    <div>
      ${logoTag}
      <h1>Scheinwerfer-Protokoll</h1>
    </div>
    <div class="kennung">
      <span class="objekt">${escapeHtml(daten.objekt || "Protokoll")}</span>
      ${daten.projekt ? `<span>Projekt ${escapeHtml(daten.projekt)}</span>` : ""}
      <button type="button" class="druck" onclick="window.print()">Als PDF</button>
    </div>
  </header>

  <div class="head">
    <p class="lede">Erzeugt aus den Meldungen ${herkunftSatz}
    Standort, Anzahl und Zustand stammen ${ausWhatsApp ? "aus der Bildunterschrift" : "aus der Betreffzeile"}.</p>
    <dl class="meta">
${metaFelder.map(([k, v]) => `      <div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("\n")}
    </dl>
  </div>

  <section>
    <h2>Erfassung</h2>
    <div class="log">
      <div class="row is-head">
        <div>Gerät / Anzahl</div><div>Standort</div><div>Zustand</div><div>Foto</div><div>Status</div>
      </div>
${positionen.map(zeile).join("\n")}
    </div>
  </section>
${
  hinweise.length
    ? `
  <section>
    <h2>Prüfhinweise</h2>
    <p class="section-note">Was beim Zusammenstellen aufgefallen ist. Jeder Punkt betrifft die Meldung, nicht das Gerät.</p>
    <div class="findings">
${hinweise.map(hinweisBlock).join("\n")}
    </div>
  </section>
`
    : ""
}
  <footer>
    ${escapeHtml(daten.fussnote || `Erstellt am ${datumLang(daten.erstellt || new Date().toISOString())}. Zeiten in Ortszeit.`)}
  </footer>

</div>
</body>
</html>
`;

/* ------------------------------------------------------------------ Ausgabe */

const zielHtml = resolve(outArg || quelle.replace(/\.json$/i, "") + ".html");
writeFileSync(zielHtml, html, "utf8");
console.log(`HTML  ${zielHtml}`);

/** Kennzahlen und alles, was beim Einbetten der Bilder nicht geklappt hat.
 *  Stillschweigend fehlende Fotos wären das Schlimmste: das Protokoll sähe
 *  vollständig aus und wäre es nicht. */
function bericht() {
  console.log(`      ${positionen.length} Meldungen, ${scheinwerfer} Scheinwerfer, ${vollstaendig} vollständig`);
  if (fehlendeBilder.length) {
    console.warn(`      ${fehlendeBilder.length} Foto(s) nicht gefunden, nicht eingebettet:`);
    for (const pfad of fehlendeBilder) console.warn(`        ${pfad}`);
  }
  if (fotoOrdner) {
    console.log(`      ${zugeordnet} Foto(s) aus dem Ordner zugeordnet`);
    if (ohneZuordnung.length) {
      console.warn(`      Ohne Datei geblieben, obwohl die Meldung ein Foto hatte:`);
      for (const eintrag of ohneZuordnung) console.warn(`        ${eintrag}`);
    }
  }
  if (ohneVerkleinerung) {
    console.warn(`      ${ohneVerkleinerung} Foto(s) in Originalgröße eingebettet — weder sips noch ImageMagick gefunden.`);
    console.warn("      Das Dokument wird dadurch groß. Auf dem Mac bringt sips das von Haus aus mit.");
  }
}

if (!flags.has("--pdf")) {
  bericht();
  process.exit(0);
}

/* --------------------------------------------------------------------- PDF */

const BROWSER = [
  ...(process.env.NOVA_BROWSER ? process.env.NOVA_BROWSER.split(":") : []),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

const browser = BROWSER.filter((pfad) => existsSync(pfad));
if (browser.length === 0) {
  console.error("");
  console.error("PDF nicht erzeugt: kein Chromium-Browser gefunden.");
  console.error(`Das HTML liegt fertig unter ${zielHtml} —`);
  console.error("im Browser öffnen und mit Cmd+P → „Als PDF sichern“ drucken.");
  console.error("Das Ergebnis ist dasselbe, der Weg nur von Hand.");
  process.exit(3);
}

const zielPdf = zielHtml.replace(/\.html$/i, ".pdf");

// Als root verweigert Chromium den Start mit aktiver Sandbox. Das betrifft
// Container und CI, nicht den Mac — dort bleibt die Sandbox deshalb an.
const alsRoot = typeof process.getuid === "function" && process.getuid() === 0;

/** Ein PDF, das diesen Namen verdient: vorhanden, nicht leer, mit Kennung. */
function istPdf(pfad) {
  if (!existsSync(pfad) || statSync(pfad).size < 1000) return false;
  const kopf = Buffer.alloc(5);
  const fd = openSync(pfad, "r");
  try { readSync(fd, kopf, 0, 5, 0); } finally { closeSync(fd); }
  return kopf.toString("latin1") === "%PDF-";
}

function drucken(pfad) {
  // Eigenes Profil je Versuch, damit ein laufender Browser den kopflosen Start
  // nicht abfängt und zwei Versuche sich nicht ins Gehege kommen.
  const profil = mkdtempSync(join(tmpdir(), "nova-protokoll-"));
  try {
    execFileSync(
      pfad,
      [
        "--headless=new",
        "--disable-gpu",
        ...(alsRoot ? ["--no-sandbox"] : []),
        `--user-data-dir=${profil}`,
        // Ohne diese vier startet Chrome nebenher seinen Updater, sucht nach
        // Erweiterungen und fragt nach dem Standardbrowser. Auf einem Rechner,
        // auf dem Chrome ohnehin läuft, endet der kopflose Start daran mit
        // einem Fehler, obwohl mit dem Drucken alles in Ordnung wäre.
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-component-update",
        "--no-pdf-header-footer",
        "--print-to-pdf-no-header",
        `--print-to-pdf=${zielPdf}`,
        `file://${zielHtml}`,
      ],
      { stdio: ["ignore", "ignore", "pipe"], timeout: 60_000 },
    );
  } catch (err) {
    // Chrome schreibt das PDF gelegentlich und endet trotzdem mit einem
    // Fehlercode — meist wegen des Updaters, nicht wegen des Drucks. Deshalb
    // zählt die Datei, nicht der Rückgabewert.
    if (!istPdf(zielPdf)) {
      const roh = err.stderr ? String(err.stderr).trim() : err.message;
      // Die VERBOSE-Zeilen des Updaters sagen nichts über den Druck aus.
      const zeilen = roh.split("\n").filter((z) => !/VERBOSE\d|updater/i.test(z));
      return { fehler: (zeilen.length ? zeilen : roh.split("\n")).slice(-3).join("\n") };
    }
  } finally {
    rmSync(profil, { recursive: true, force: true });
  }
  return istPdf(zielPdf) ? { ok: true } : { fehler: "kein PDF angelegt" };
}

/* Mehrere Browser der Reihe nach. Auf einem Mac mit Microsoft 365 ist Edge
   ohnehin da, und wenn Chrome zickt, druckt Edge dasselbe. Aufzugeben, weil der
   erste von vieren gescheitert ist, wäre voreilig. */
const gescheitert = [];
let erfolg = false;
for (const pfad of browser) {
  const ergebnis = drucken(pfad);
  if (ergebnis.ok) { erfolg = true; break; }
  gescheitert.push(`${basename(pfad)}: ${ergebnis.fehler}`);
  rmSync(zielPdf, { force: true });
}

if (!erfolg) {
  console.error("");
  console.error(`PDF nicht erzeugt — ${gescheitert.length} Browser versucht:`);
  for (const z of gescheitert) console.error(`  ${z}`);
  console.error(`Das HTML liegt unter ${zielHtml} und lässt sich von Hand drucken:`);
  console.error(`  open "${zielHtml}"   dann Cmd+P → „Als PDF sichern“`);
  process.exit(3);
}

console.log(`PDF   ${zielPdf}`);
bericht();


/* ----------------------------------------------------------------- Ablage */

/* SharePoint ist auf dem Arbeitsrechner lokal synchronisiert. Das Protokoll
   wird deshalb in den Projektordner kopiert, statt es über die Graph-API
   hochzuladen: sharepoint_upload_file nimmt den Inhalt nur inline als base64
   entgegen, und 215.000 Zeichen zeichengenau durchzureichen ist kein Weg, auf
   dem ein Nachweis unbeschädigt ankommt. Der Sync-Client erledigt den Rest. */

const ABLAGE_BASIS =
  process.env.NOVA_ABLAGE_BASIS ||
  join(process.env.HOME || "", "Library/CloudStorage/OneDrive-NOVAWORKSGmbH/Angebote");

/** macOS legt Dateinamen in zerlegter Form ab: ein "ä" besteht dort aus a und
 *  einem gesonderten Umlautzeichen. Ohne Normalisierung findet ein Vergleich mit
 *  der zusammengesetzten Schreibweise den Ordner nie — und legt ihn ein zweites
 *  Mal an, scheinbar gleich benannt. */
const nfc = (wert) => String(wert).normalize("NFC");

function ablegen(pdfPfad) {
  if (!daten.projekt) return { fehler: "keine Projektnummer in den Daten — nicht abgelegt" };
  if (!existsSync(ABLAGE_BASIS)) return { fehler: `Ablageordner nicht gefunden: ${ABLAGE_BASIS}` };

  const treffer = readdirSync(ABLAGE_BASIS).filter((n) =>
    nfc(n).startsWith(`${nfc(daten.projekt)}_`),
  );
  if (treffer.length === 0) return { fehler: `kein Projektordner zu ${daten.projekt} unter ${ABLAGE_BASIS}` };
  if (treffer.length > 1) {
    return { fehler: `mehrere Projektordner zu ${daten.projekt}: ${treffer.join(", ")} — nicht abgelegt` };
  }

  const projektOrdner = join(ABLAGE_BASIS, treffer[0]);
  const inhalt = readdirSync(projektOrdner);
  let vorhanden = inhalt.find((n) => nfc(n) === nfc(ABLAGE_ORDNER));

  /* Schreibt jemand "Lampenprotokolle" und das Skript sucht "Lampen Protokolle",
     stünden am Ende zwei fast gleich benannte Ordner nebeneinander und die
     Protokolle verteilten sich auf beide. Deshalb zweiter Versuch ohne
     Leerzeichen, Bindestriche und Gross-/Kleinschreibung: Was der Sache nach
     derselbe Ordner ist, wird auch derselbe. */
  let angepasst = null;
  if (!vorhanden) {
    const lose = (w) => nfc(w).toLowerCase().replace(/[\s_-]+/g, "");
    const nah = inhalt.filter((n) => lose(n) === lose(ABLAGE_ORDNER));
    if (nah.length === 1) {
      vorhanden = nah[0];
      angepasst = nah[0];
    } else if (nah.length > 1) {
      return { fehler: `mehrere Ordner kommen für "${ABLAGE_ORDNER}" in Frage: ${nah.join(", ")} — nicht abgelegt` };
    }
  }

  const ziel = join(projektOrdner, vorhanden ?? ABLAGE_ORDNER);
  if (!vorhanden) mkdirSync(ziel, { recursive: true });

  // Vorhandenes nicht überschreiben: ein überschriebener Nachweis ist ein
  // verlorener Nachweis. Stattdessen durchnummerieren.
  const spanne = mehrtaegig ? `${datum}_bis_${datumBis}` : datum || "ohne-Datum";
  const stamm = `Scheinwerfer-Protokoll_${daten.objekt || "Protokoll"}_${spanne}`;
  let name = `${stamm}.pdf`;
  let n = 2;
  while (existsSync(join(ziel, name))) name = `${stamm}_${n++}.pdf`;

  const zielDatei = join(ziel, name);
  copyFileSync(pdfPfad, zielDatei);
  return { pfad: zielDatei, neuerOrdner: !vorhanden, angepasst };
}

if (flags.has("--ablegen")) {
  const ergebnis = ablegen(zielPdf);
  if (ergebnis.fehler) {
    console.error(`ABLAGE nicht erfolgt: ${ergebnis.fehler}`);
    process.exit(4);
  }
  if (ergebnis.neuerOrdner) console.log(`      Ordner "${ABLAGE_ORDNER}" neu angelegt`);
  if (ergebnis.angepasst) {
    console.log(`      vorhandenen Ordner "${ergebnis.angepasst}" benutzt statt "${ABLAGE_ORDNER}" neu anzulegen`);
  }
  console.log(`ABLAGE ${ergebnis.pfad}`);
}
