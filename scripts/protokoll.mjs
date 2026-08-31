#!/usr/bin/env node
/**
 * Erzeugt aus den gesammelten Meldungen ein Scheinwerfer-Protokoll als HTML
 * und auf Wunsch als PDF.
 *
 *   node scripts/protokoll.mjs daten.json
 *   node scripts/protokoll.mjs daten.json --pdf
 *   node scripts/protokoll.mjs daten.json --out ~/Desktop/protokoll.html --pdf
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
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
const zeitraum =
  daten.zeitraum ||
  (zeiten.length >= 2
    ? `${uhrzeit(zeiten[0])} – ${uhrzeit(zeiten[zeiten.length - 1])}`
    : uhrzeit(zeiten[0]) || "—");

const datum = daten.datum || (zeiten[0] ? zeiten[0].slice(0, 10) : "");

/* ------------------------------------------------------------------- Bausteine */

function fotoZelle(position) {
  const fotos = Array.isArray(position.fotos) ? position.fotos : [];
  if (fotos.length === 0) return '<span class="none">keins</span>';
  const groessen = fotos.map((f) => dateigroesse(f.groesse)).filter(Boolean);
  const label = `${fotos.length} × ${groessen.join(", ") || "Foto"}`;
  // Klein heißt: vom Mailprogramm verkleinert, Details für einen Nachweis fort.
  const klein = fotos.some((f) => typeof f.groesse === "number" && f.groesse < 500 * 1024);
  return klein
    ? `${escapeHtml(label)} <span class="warn" title="unter 500 KB — beim Versand verkleinert">verkleinert</span>`
    : escapeHtml(label);
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
    --band:#0a0a0a; --band-ink:#e8e8e8; --band-rule:#3a3a3a;
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

  /* Kopfband: das Logo hat einen schwarzen Grund und braucht eine dunkle
     Fläche — in der App sitzt es aus demselben Grund in der Seitenleiste. */
  .band { background:var(--band); color:var(--band-ink);
          margin:0 calc(-1 * clamp(1rem,4vw,2.5rem)) 2.25rem;
          padding:1.1rem clamp(1rem,4vw,2.5rem);
          display:flex; align-items:center; justify-content:space-between;
          gap:1.5rem; flex-wrap:wrap; border-bottom:2px solid var(--accent-hell); }
  .band img { height:34px; width:auto; display:block; }
  .band .kennung { font-size:.72rem; letter-spacing:.22em; text-transform:uppercase;
                   color:var(--accent-hell); text-align:right; line-height:1.6; }
  .band .kennung .projekt { color:var(--band-ink); opacity:.6; }
  .band-rechts { display:flex; align-items:center; gap:1.1rem; flex-wrap:wrap; justify-content:flex-end; }
  /* Öffnet den Druckdialog des Browsers; dort führt „Als PDF sichern" zum
     selben Ergebnis wie protokoll.mjs --pdf. Im Druck ist der Knopf weg —
     er hat auf einem Nachweis nichts verloren. */
  .druck { font-family:var(--body); font-size:.68rem; font-weight:600; letter-spacing:.18em;
           text-transform:uppercase; color:var(--accent-hell); background:none;
           border:1px solid var(--accent-hell); padding:.5rem .9rem; cursor:pointer;
           white-space:nowrap; }
  .druck:hover { background:var(--accent-hell); color:var(--band); }
  .druck:focus-visible { outline:2px solid var(--band-ink); outline-offset:2px; }
  .band .wortmarke { font-size:1.1rem; letter-spacing:.3em; text-transform:uppercase;
                     color:var(--band-ink); }

  h1 { font-size:clamp(1.5rem,4vw,2.1rem); font-weight:300; letter-spacing:.15em;
       text-transform:uppercase; margin:0 0 .5rem; text-wrap:balance; }
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

  @page { margin:12mm; }
  @media print {
    body { background:#fff; }
    .sheet { padding:0; max-width:none; }
    .band { margin:0 0 1.6rem; padding:.8rem 1rem; }
    .band img { height:26px; }
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
  ["Datum", datumLang(datum) || "—"],
  ["Zeitraum", zeitraum],
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

  <div class="band">
    ${logoTag}
    <div class="band-rechts">
      <div class="kennung">${escapeHtml(daten.objekt || "Protokoll")}${daten.projekt ? `<br><span class="projekt">Projekt ${escapeHtml(daten.projekt)}</span>` : ""}</div>
      <button type="button" class="druck" onclick="window.print()">Als PDF</button>
    </div>
  </div>

  <header class="head">
    <h1>Scheinwerfer-Protokoll</h1>
    <p class="lede">Erzeugt aus den Meldungen an <code>${escapeHtml(daten.postfach || "technik@nova-works.de")}</code>.
    Standort, Anzahl und Zustand stammen aus der Betreffzeile.</p>
    <dl class="meta">
${metaFelder.map(([k, v]) => `      <div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("\n")}
    </dl>
  </header>

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
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/opt/pw-browsers/chromium",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

const browser = BROWSER.find((pfad) => existsSync(pfad));
if (!browser) {
  console.error("");
  console.error("PDF nicht erzeugt: kein Chromium-Browser gefunden.");
  console.error(`Das HTML liegt fertig unter ${zielHtml} —`);
  console.error("im Browser öffnen und mit Cmd+P → „Als PDF sichern“ drucken.");
  console.error("Das Ergebnis ist dasselbe, der Weg nur von Hand.");
  process.exit(3);
}

const zielPdf = zielHtml.replace(/\.html$/i, ".pdf");
// Eigenes Profil, damit ein laufender Browser den kopflosen Start nicht abfängt.
const profil = mkdtempSync(join(tmpdir(), "nova-protokoll-"));

// Als root verweigert Chromium den Start mit aktiver Sandbox. Das betrifft
// Container und CI, nicht den Mac — dort bleibt die Sandbox deshalb an.
const alsRoot = typeof process.getuid === "function" && process.getuid() === 0;

try {
  execFileSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      ...(alsRoot ? ["--no-sandbox"] : []),
      `--user-data-dir=${profil}`,
      "--no-pdf-header-footer",
      "--print-to-pdf-no-header",
      `--print-to-pdf=${zielPdf}`,
      `file://${zielHtml}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"], timeout: 60_000 },
  );
} catch (err) {
  console.error("");
  console.error(`PDF nicht erzeugt: ${basename(browser)} endete mit einem Fehler.`);
  const details = err.stderr ? String(err.stderr).trim().split("\n").slice(-3).join("\n") : err.message;
  if (details) console.error(details);
  console.error(`Das HTML liegt unter ${zielHtml} und lässt sich von Hand drucken.`);
  process.exit(3);
}

if (!existsSync(zielPdf)) {
  console.error(`PDF nicht erzeugt: ${zielPdf} wurde nicht angelegt.`);
  process.exit(3);
}

console.log(`PDF   ${zielPdf}`);
bericht();
