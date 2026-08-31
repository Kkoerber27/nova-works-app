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
import { basename, join, resolve } from "node:path";

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

  return `      <div class="row">
        <div class="id">${bezeichner}${typ}</div>
        <div class="place"><span class="cell-label">Standort</span>${standort}<span class="sub">${untertitel}</span></div>
        <div class="cond"><span class="cell-label">Zustand</span>${zustand}</div>
        <div class="photo"><span class="cell-label">Foto</span>${fotoZelle(position)}</div>
        <div><span class="chip ${chip.klasse}">${chip.text}</span></div>
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

const STIL = `
  :root {
    --paper:#F3F4F6; --surface:#FFFFFF; --ink:#15171B; --ink-2:#464B53;
    --muted:#757C86; --rule:#DCDFE4; --rule-2:#EAECEF; --accent:#B9741A;
    --ok:#226B45; --ok-bg:#DCEDE3; --bad:#A32E24; --bad-bg:#F6DEDB;
    --note:#4A5361; --note-bg:#E3E7EC;
    --display:"Barlow Condensed","Helvetica Neue",Arial,sans-serif;
    --body:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    --mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper:#121417; --surface:#1A1D22; --ink:#E8EAED; --ink-2:#B0B6BF;
      --muted:#858C96; --rule:#2C3138; --rule-2:#23272D; --accent:#E0A34A;
      --ok:#6FCB98; --ok-bg:#17301F; --bad:#E88B80; --bad-bg:#3A1D1A;
      --note:#A8B2BF; --note-bg:#232932;
    }
  }
  :root[data-theme="dark"] {
    --paper:#121417; --surface:#1A1D22; --ink:#E8EAED; --ink-2:#B0B6BF;
    --muted:#858C96; --rule:#2C3138; --rule-2:#23272D; --accent:#E0A34A;
    --ok:#6FCB98; --ok-bg:#17301F; --bad:#E88B80; --bad-bg:#3A1D1A;
    --note:#A8B2BF; --note-bg:#232932;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font-family:var(--body);
         font-size:15px; line-height:1.55; -webkit-font-smoothing:antialiased; }
  .sheet { max-width:68rem; margin:0 auto; padding:clamp(1.5rem,4vw,3.5rem) clamp(1rem,4vw,3rem) 4rem;
           display:flex; flex-direction:column; gap:2.75rem; }
  .head { display:flex; flex-direction:column; gap:1.5rem; }
  .eyebrow { font-family:var(--display); font-weight:600; font-size:.8rem; letter-spacing:.16em;
             text-transform:uppercase; color:var(--accent); display:flex; align-items:center; gap:.7rem; }
  .eyebrow::after { content:""; flex:1; height:2px; background:var(--accent); opacity:.35; }
  h1 { font-family:var(--display); font-weight:700; font-size:clamp(2.4rem,7vw,3.6rem); line-height:1.02;
       margin:0; text-wrap:balance; }
  .lede { margin:0; max-width:56ch; color:var(--ink-2); font-size:1.05rem; }
  /* Zellenrahmen statt Gitterlücken: bei ungerader Feldzahl bliebe sonst ein
     eingefärbter Rest neben der letzten Zelle stehen. */
  .meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));
          background:var(--surface); border:1px solid var(--rule); border-width:1px 0 0 1px; }
  .meta div { padding:.85rem 1rem; display:flex; flex-direction:column; gap:.2rem;
              border:1px solid var(--rule); border-width:0 1px 1px 0; }
  .meta dt { font-family:var(--display); font-weight:600; font-size:.72rem; letter-spacing:.13em;
             text-transform:uppercase; color:var(--muted); }
  .meta dd { margin:0; font-family:var(--mono); font-size:.9rem; font-variant-numeric:tabular-nums; }
  section { display:flex; flex-direction:column; gap:1.1rem; }
  h2 { font-family:var(--display); font-weight:600; font-size:1.6rem; margin:0; padding-bottom:.5rem;
       border-bottom:2px solid var(--ink); }
  .section-note { margin:0; color:var(--ink-2); max-width:62ch; }
  .log { border:1px solid var(--rule); background:var(--surface); }
  .row { display:grid; grid-template-columns:6.5rem minmax(0,1.6fr) minmax(0,1fr) 9.5rem 9rem; gap:1rem;
         padding:.95rem 1.15rem; align-items:start; border-bottom:1px solid var(--rule-2); }
  .row:last-child { border-bottom:0; }
  .row.is-head { background:var(--paper); border-bottom:1px solid var(--rule); font-family:var(--display);
                 font-weight:600; font-size:.72rem; letter-spacing:.13em; text-transform:uppercase;
                 color:var(--muted); padding-top:.6rem; padding-bottom:.6rem; }
  .id { font-family:var(--mono); font-weight:500; font-size:1rem; font-variant-numeric:tabular-nums; }
  .id .typ { display:block; margin-top:.2rem; font-family:var(--body); font-size:.72rem; color:var(--muted); }
  .place { font-weight:500; }
  .place a { color:inherit; text-decoration:none; border-bottom:1px solid var(--rule); }
  .place a:hover, .place a:focus-visible { border-bottom-color:var(--accent); }
  .sub { display:block; margin-top:.2rem; font-family:var(--mono); font-size:.78rem; color:var(--muted);
         font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
  .cond { color:var(--ink-2); }
  .cond .empty { color:var(--muted); font-style:italic; }
  .photo { font-family:var(--mono); font-size:.85rem; font-variant-numeric:tabular-nums; }
  .photo .none { color:var(--bad); }
  .photo .warn { color:var(--accent); }
  .chip { display:inline-block; font-family:var(--display); font-weight:600; font-size:.75rem;
          letter-spacing:.09em; text-transform:uppercase; padding:.28rem .6rem; white-space:nowrap; }
  .chip.ok { background:var(--ok-bg); color:var(--ok); }
  .chip.gap { background:var(--note-bg); color:var(--note); }
  .chip.dupe { background:var(--bad-bg); color:var(--bad); }
  .cell-label { display:none; font-family:var(--display); font-weight:600; font-size:.68rem;
                letter-spacing:.13em; text-transform:uppercase; color:var(--muted); margin-bottom:.15rem; }
  .findings { display:flex; flex-direction:column; gap:1px; background:var(--rule); border:1px solid var(--rule); }
  .finding { background:var(--surface); padding:1rem 1.15rem; display:grid; grid-template-columns:6.5rem 1fr; gap:1rem; }
  .finding .who { font-family:var(--mono); font-size:.85rem; color:var(--accent); font-variant-numeric:tabular-nums; }
  .finding h3 { font-family:var(--body); font-size:.98rem; font-weight:600; margin:0 0 .3rem; }
  .finding p { margin:0; color:var(--ink-2); max-width:62ch; }
  code { font-family:var(--mono); font-size:.88em; background:var(--note-bg); color:var(--ink); padding:.1em .35em; }
  footer { border-top:1px solid var(--rule); padding-top:1.25rem; color:var(--muted); font-size:.85rem; max-width:62ch; }
  /* Nur für den Bildschirm: eine A4-Seite ist rund 690 px breit und fiele
     sonst in den Handy-Umbruch — das Protokoll würde als gestapelte Liste
     gedruckt und bräuchte das Dreifache an Seiten. */
  @media screen and (max-width:760px) {
    .row { grid-template-columns:1fr; gap:.55rem; padding:1.1rem; }
    .row.is-head { display:none; }
    .cell-label { display:block; }
    .finding { grid-template-columns:1fr; gap:.4rem; }
  }
  @page { margin:14mm; }
  @media print {
    body { background:#fff; }
    /* Flex-Spalten zerlegt Chrome beim Seitenumbruch nicht, sondern schiebt
       ganze Blöcke auf die nächste Seite — aus anderthalb Seiten werden vier.
       Im Druck deshalb normaler Blockfluss mit Abständen statt gap. */
    .sheet, .head, section, .findings { display:block; }
    .sheet { padding:0; max-width:none; }
    .sheet > * + * { margin-top:1.6rem; }
    .head > * + * { margin-top:.8rem; }
    section > * + * { margin-top:.7rem; }
    .findings { border-width:1px 1px 0; }
    .findings > .finding { border-bottom:1px solid var(--rule); }
    /* Engere Spalten, damit die Tabelle in den Satzspiegel passt. Die letzte
       Spalte muss „Unvollständig“ am Stück fassen — das Wort bestimmt sie. */
    .row { grid-template-columns:4.4rem minmax(0,1.4fr) minmax(0,.9fr) 5.4rem 7.4rem;
           gap:.6rem; padding:.6rem .8rem; font-size:.86rem; }
    .chip { font-size:.66rem; letter-spacing:.05em; padding:.24rem .45rem; }
    .finding { grid-template-columns:4.6rem 1fr; gap:.7rem; padding:.7rem .8rem; }
    h1 { font-size:2.6rem; }
    .row, .finding { break-inside:avoid; }
    h1, h2 { break-after:avoid; }
    .place a { border-bottom:0; }
  }
`;

/* ------------------------------------------------------------------- Seite */

const titel = daten.objekt ? `Scheinwerfer-Protokoll ${daten.objekt}` : "Scheinwerfer-Protokoll";

const metaFelder = [
  ["Objekt", daten.objekt || "—"],
  daten.projekt ? ["Projekt", daten.projekt] : null,
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${STIL}</style>
</head>
<body>
<div class="sheet">

  <header class="head">
    <div class="eyebrow">Nova Works${daten.projekt ? ` &middot; Projekt ${escapeHtml(daten.projekt)}` : ""}</div>
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

if (!flags.has("--pdf")) {
  console.log(`      ${positionen.length} Meldungen, ${scheinwerfer} Scheinwerfer, ${vollstaendig} vollständig`);
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
console.log(`      ${positionen.length} Meldungen, ${scheinwerfer} Scheinwerfer, ${vollstaendig} vollständig`);
