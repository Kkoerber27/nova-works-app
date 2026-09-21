#!/usr/bin/env node
/* Alle Prüfungen der Homepage in einem Lauf.

     node pruefung/lauf.mjs             alles
     node pruefung/lauf.mjs breite hero nur diese

   Beendet sich mit 1, sobald eine Prüfung fehlschlägt - damit taugt der
   Lauf auch als Torwächter vor einem Commit. */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, server, protokoll } from './hilfe.mjs';

const HIER = fileURLToPath(new URL('.', import.meta.url));
const wahl = process.argv.slice(2);

const dateien = (await readdir(join(HIER, 'tests')))
  .filter((d) => d.endsWith('.mjs')).sort()
  .filter((d) => !wahl.length || wahl.some((w) => d.includes(w)));

if (!dateien.length) {
  console.error('Keine passende Prüfung gefunden.');
  process.exit(2);
}

const start = Date.now();
const { ort, zu } = await server();
const browser = await (await chromium()).launch();

let fehlerGesamt = 0, geprueftGesamt = 0;
const bilanz = [];

for (const datei of dateien) {
  const modul = await import(join(HIER, 'tests', datei));
  const name = modul.NAME || datei.replace(/^\d+-|\.mjs$/g, '');
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  const ok = protokoll();
  try {
    await modul.default({ ort, browser, ok });
  } catch (e) {
    ok(false, 'Prüfung abgebrochen', e.message);
  }
  const { fehler, geprueft } = ok.stand();
  fehlerGesamt += fehler; geprueftGesamt += geprueft;
  bilanz.push({ name, fehler, geprueft });
}

await browser.close();
await zu();

console.log('\n' + '─'.repeat(52));
for (const b of bilanz) {
  console.log(`  ${b.fehler ? '\x1b[31mFEHL\x1b[0m' : ' ok '}  ${b.name.padEnd(24)} ${String(b.geprueft).padStart(3)} geprüft` +
              (b.fehler ? `, ${b.fehler} fehlgeschlagen` : ''));
}
const dauer = ((Date.now() - start) / 1000).toFixed(1);
console.log('─'.repeat(52));
console.log(fehlerGesamt
  ? `\x1b[31m${fehlerGesamt} von ${geprueftGesamt} Prüfungen fehlgeschlagen\x1b[0m  (${dauer}s)`
  : `Alle ${geprueftGesamt} Prüfungen bestanden  (${dauer}s)`);
process.exit(fehlerGesamt ? 1 : 0);
