#!/usr/bin/env node
/* Bilder auf Webgröße bringen.

     node pruefung/bild.mjs IMG_1234.jpeg live-2.jpg
     node pruefung/bild.mjs IMG_1234.jpeg live-2.jpg 0.7

   Aus den Kameravorlagen (oft 3 bis 5 MB) wird ein Bild mit höchstens
   1600 px langer und 900 px kurzer Kante. Das ist die Größe, in der
   die Fotos auf der Seite und in der Großansicht gebraucht werden -
   mehr lädt nur länger.

   Chromium ist hier das einzige Bildwerkzeug: laden, auf eine
   Leinwand zeichnen, als JPEG kodieren. Kein ImageMagick, kein npm.

   Die Vorlage bleibt liegen; sie gehört nach dem Umrechnen aus dem
   Arbeitsbaum entfernt, damit das Repo nicht mit Kamerabildern
   volläuft. */

import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, SEITE } from './hilfe.mjs';

const [von, nach, gueteRoh] = process.argv.slice(2);
if (!von || !nach) {
  console.error('Aufruf: node pruefung/bild.mjs <Vorlage> <Ziel> [Güte 0..1]');
  process.exit(2);
}
const guete = Number(gueteRoh) || 0.78;
const IMG = join(SEITE, 'assets/img');
const KURZ = 900, LANG = 1600;

const browser = await (await chromium()).launch();
const p = await browser.newPage();
const roh = await readFile(join(IMG, von));
const r = await p.evaluate(async (arg) => {
  const bild = await new Promise((ok, er) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => er(new Error('lässt sich nicht laden'));
    i.src = arg.uri;
  });
  const W = bild.naturalWidth, H = bild.naturalHeight;
  const f = Math.min(1, arg.kurz / Math.min(W, H), arg.lang / Math.max(W, H));
  const c = document.createElement('canvas');
  c.width = Math.round(W * f); c.height = Math.round(H * f);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bild, 0, 0, c.width, c.height);
  return { vorher: [W, H], nachher: [c.width, c.height],
           daten: c.toDataURL('image/jpeg', arg.guete) };
}, { uri: 'data:image/jpeg;base64,' + roh.toString('base64'), kurz: KURZ, lang: LANG, guete });
await browser.close();

const buf = Buffer.from(r.daten.split(',')[1], 'base64');
await writeFile(join(IMG, nach), buf);
const vor = (await stat(join(IMG, von))).size;

console.log(`  ${von}  ${r.vorher.join('x')}  ${(vor / 1048576).toFixed(1)} MB`);
console.log(`  -> ${nach}  ${r.nachher.join('x')}  ${(buf.length / 1024).toFixed(0)} kB  (Güte ${guete})`);
if (buf.length > 320 * 1024) {
  console.log('  Hinweis: über 320 kB. Bei viel Blattwerk oder Körnung hilft eine');
  console.log('           niedrigere Güte, etwa 0.70, ohne sichtbaren Verlust.');
}
console.log(`  Die Vorlage ${von} kann jetzt aus site/assets/img/ entfernt werden.`);
