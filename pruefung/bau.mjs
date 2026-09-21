#!/usr/bin/env node
/* Baut aus der Seite eine einzelne HTML-Datei zum Herumreichen.

     node pruefung/bau.mjs [ziel.html]

   Die Vorschau ist eine Datei ohne Nachbarn: Stylesheet, Skript,
   Schrift und alle Bilder stecken eingebettet darin. Nur so lässt sie
   sich als Artefakt veröffentlichen oder per Mail schicken.

   Sie ist nicht die Seite. Was hier gebaut wird, ist eine Kopie zum
   Ansehen - geprüft wird immer die echte Seite unter site/. */

import { readFile, writeFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { SEITE, WURZEL } from './hilfe.mjs';

const ZIEL = process.argv[2] || join(WURZEL, 'vorschau.html');

const b64 = async (pfad) => (await readFile(join(SEITE, pfad))).toString('base64');
const TYP = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
              '.webp': 'image/webp', '.svg': 'image/svg+xml' };

/* Jeden Verweis auf assets/img/… durch die Datei selbst ersetzen.
   Fehlt eine Datei, bleibt der Platz leer statt kaputt - dann sieht man
   im Bau-Bericht, was noch fehlt. */
const fehlend = new Set(), eingebettet = new Map();
async function einbetten(text) {
  const pfade = [...new Set((text.match(/assets\/img\/[A-Za-z0-9._-]+/g) || []))];
  for (const pfad of pfade) {
    if (eingebettet.has(pfad)) continue;
    try {
      const daten = await b64(pfad);
      eingebettet.set(pfad, `data:${TYP[extname(pfad).toLowerCase()] || 'image/jpeg'};base64,${daten}`);
    } catch (e) {
      fehlend.add(pfad);
      eingebettet.set(pfad, '');
    }
  }
  /* Von hinten ersetzen, damit "live.jpg" nicht in "live-2.jpg" greift. */
  for (const pfad of pfade.sort((a, b) => b.length - a.length)) {
    text = text.split(pfad + '?v=').join(eingebettet.get(pfad) + '#v=');
    text = text.split(pfad).join(eingebettet.get(pfad));
  }
  return text;
}

const stueck = (quelle, muster, name) => {
  const t = quelle.match(muster);
  if (!t) throw new Error(`Im Quelltext fehlt: ${name}`);
  return t[1];
};

const idx = await readFile(join(SEITE, 'index.html'), 'utf8');

let css = await readFile(join(SEITE, 'assets/css/style.css'), 'utf8');
css = css.replace(/url\(['"]?\.\.\/fonts\/([A-Za-z0-9._-]+)['"]?\)/g, (_, datei) => `url(SCHRIFT:${datei})`);
for (const datei of [...new Set((css.match(/SCHRIFT:([A-Za-z0-9._-]+)/g) || []))]) {
  const name = datei.replace('SCHRIFT:', '');
  const daten = (await readFile(join(SEITE, 'assets/fonts', name))).toString('base64');
  css = css.split(datei).join(`data:font/woff2;base64,${daten}`);
}
const js = await readFile(join(SEITE, 'assets/js/main.js'), 'utf8');

const kopf  = stueck(idx, /(<header class="masthead"[\s\S]*?<\/header>)/, '<header class="masthead">');
const lade  = stueck(idx, /(<div class="nav-drawer"[\s\S]*?\n<\/div>)/, '<div class="nav-drawer">');
const fuss  = stueck(idx, /(<footer class="footer">[\s\S]*?<\/footer>)/, '<footer class="footer">');
const inhalt = stueck(idx, /<main id="main">([\s\S]*?)<\/main>/, '<main id="main">');
/* Die Großansicht steht außerhalb von <main> - ohne sie bliebe in der
   Vorschau ein Klick auf ein Referenzbild wirkungslos. */
const lupe  = stueck(idx, /(<dialog class="lupe"[\s\S]*?<\/dialog>)/, '<dialog class="lupe">');
const titel = stueck(idx, /<title>([^<]*)<\/title>/, '<title>');

let seite = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel}</title>
<!-- Vorschau, gebaut von pruefung/bau.mjs. Alles in einer Datei:
     Stylesheet, Skript, Schrift und Bilder sind eingebettet. Nicht
     bearbeiten - Änderungen gehören nach site/. -->
<style>
${css}
</style>
</head>
<body>
<a class="skip-link" href="#main">Zum Inhalt springen</a>
<div class="grain" aria-hidden="true"></div>
${kopf}
${lade}
<main id="main">
${inhalt}
</main>
${fuss}
${lupe}
<script>
${js}
</script>
</body>
</html>
`;

seite = await einbetten(seite);

/* Torwächter: Bleibt ein Pfad stehen, zeigt die Vorschau ein totes Bild -
   und das fällt erst auf, wenn sie schon verschickt ist. */
for (const muster of [/url\(['"]?assets\/img/, /src="assets\/img/, /href="assets\/img/]) {
  if (muster.test(seite)) throw new Error(`Ein Bildpfad blieb stehen: ${muster}`);
}

await writeFile(ZIEL, seite);

const kb = (n) => (n / 1024).toFixed(0).padStart(5) + ' kB';
console.log(`  Vorschau: ${ZIEL}`);
console.log(`  ${kb(Buffer.byteLength(seite))}, ${eingebettet.size - fehlend.size} Bilder eingebettet`);
if (fehlend.size) {
  console.log(`  noch offen: ${[...fehlend].map((f) => basename(f)).join(', ')}`);
}
