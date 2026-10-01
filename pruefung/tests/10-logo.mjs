/* Der Trennstrich im Logo.

   Er lag einmal bei 0,96 Einheiten Höhe - auf dem Handy 0,27 CSS-Pixel,
   weniger als ein Gerätepixel. Sichtbar war er nur über Kantenglättung,
   und die fiel weg, sobald der Kopf beim Scrollen in eine eigene Ebene
   mit Hintergrundunschärfe rutschte: Dann war der Strich weg.

   Gehalten wird deshalb zweierlei - die Geometrie in der Datei und das,
   was am Bildschirm ankommt. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seite, SEITE } from '../hilfe.mjs';
export const NAME = 'Logo-Trennstrich';

const HOCH = 141.732;   // viewBox-Höhe
const BREIT = 425.197;  // viewBox-Breite

export default async function ({ ort, browser, ok }) {
  const svg = await readFile(join(SEITE, 'assets/img/logo-weiss.svg'), 'utf8');
  const rect = svg.match(/<rect[^>]*nw-linie[^>]*>/);
  ok(!!rect, 'der Strich steht im Logo');
  if (!rect) return;
  const hoehe = Number(rect[0].match(/height="([0-9.]+)"/)[1]);
  const y = Number(rect[0].match(/y="([0-9.]+)"/)[1]);

  for (const [wo, breite] of [['Kopf am Handy', 120], ['Fußzeile', 140], ['Kopf am Schirm', 170]]) {
    const px = hoehe * (breite / BREIT);
    ok(px >= 1, `${wo.padEnd(16)} (${breite} px breit) mindestens ein Pixel hoch`,
       px.toFixed(2) + ' px');
  }

  /* Und am Bildschirm: oben wie gescrollt muss er sich abheben. */
  const lese = await browser.newPage();
  await lese.goto('about:blank');
  const profil = (buf) => lese.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode();
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    const aus = []; const von = Math.round(c.width * .25), bis = Math.round(c.width * .75);
    for (let yy = 0; yy < c.height; yy++) {
      let s = 0;
      for (let xx = von; xx < bis; xx++) {
        const i = (yy * c.width + xx) * 4; s += (px[i] + px[i + 1] + px[i + 2]) / 3;
      }
      aus.push(s / (bis - von));
    }
    return aus;
  }, 'data:image/png;base64,' + buf.toString('base64'));

  for (const [breite, dichte] of [[390, 3], [390, 2], [1440, 2], [1920, 1]]) {
    const p = await seite(browser, ok,
      { viewport: { width: breite, height: 844 }, deviceScaleFactor: dichte });
    await p.goto(ort + '/index.php');
    await p.waitForTimeout(700);
    for (const zustand of ['oben', 'gescrollt']) {
      if (zustand === 'gescrollt') {
        await p.evaluate(() => window.scrollTo(0, 1600));
        await p.waitForTimeout(800);
        ok(await p.evaluate(() => document.getElementById('masthead').classList.contains('is-stuck')),
           `${breite}/${dichte} der Kopf ist gescrollt angeheftet`);
      }
      const m = await p.evaluate(() => {
        const r = document.querySelector('.masthead__logo img').getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      const oben = m.y + y * (m.h / HOCH);
      const buf = await p.screenshot({
        clip: { x: m.x, y: Math.max(0, oben - 5), width: m.w, height: 11 } });
      const zs = await profil(buf);
      const grund = zs.slice().sort((a, b) => a - b)[1];
      const spitze = Math.max(...zs.map((v) => v - grund));
      ok(spitze >= 25, `${String(breite).padStart(4)} px / Dichte ${dichte} / ${zustand.padEnd(9)} der Strich hebt sich ab`,
         spitze.toFixed(0) + ' von 255');
    }
    await p.schliessen();
  }
  await lese.close();

  /* --- Der Claim sitzt mittig unter der Wortmarke ---
     Im Original liegen Wortmarke, Trennstrich und Claim alle drei auf
     derselben Mitte - nachgemessen bei 600 px Breite: 299,5 / 300,5 /
     300. Seit der Claim als eigener Text darunter steht, kann er
     daneben rutschen, und genau das ist passiert: Er stand links
     ausgerichtet statt zentriert.

     Gemessen wird die Mitte der Schrift, nicht die ihres Kastens. Die
     Sperrung sitzt auch hinter dem letzten Buchstaben; der Kasten ist
     dadurch um ein halbes Sperrmaß breiter als das, was man sieht. */
  for (const [wo, waehler] of [['Kopfzeile', '.masthead__logo'],
                               ['Fußzeile',  '.footer__logo']]) {
    const q = await seite(browser, ok, { viewport: { width: 1440, height: 900 } });
    await q.goto(ort + '/index.php', { waitUntil: 'networkidle' });
    await q.waitForTimeout(400);

    const m = await q.evaluate((w) => {
      const marke  = document.querySelector(w);
      const bild   = marke.querySelector('.marke__zeichen');
      const claim  = marke.querySelector('.marke__claim');
      if (!bild || !claim) return null;

      const b = bild.getBoundingClientRect();
      const c = claim.getBoundingClientRect();
      const sperre = parseFloat(getComputedStyle(claim).letterSpacing) || 0;

      return {
        bildMitte:  b.left + b.width / 2,
        /* Kastenmitte, um die halbe Sperrung nach links korrigiert. */
        textMitte:  c.left + (c.width - sperre) / 2,
        claimBreite: c.width,
        /* Die sichtbare Wortmarke füllt 87,7 % des Bildrahmens -
           gemessen am Zuschnitt: 526 von 600 px. */
        marke:      b.width * 0.877,
      };
    }, waehler);

    if (!m) { ok.hinweis(`${wo}: keine Marke gefunden`); await q.schliessen(); continue; }

    const ab = Math.abs(m.textMitte - m.bildMitte);
    ok(ab <= 2, `${wo}: der Claim sitzt mittig unter der Wortmarke`,
       `${ab.toFixed(1)} px daneben`);

    /* Und er bleibt schmaler als die Wortmarke - sonst liest er sich
       wie eine zweite Zeile Wortmarke statt wie eine Unterzeile. */
    const anteil = m.claimBreite / m.marke;
    ok(anteil < 0.95, `${wo}: und bleibt schmaler als sie`,
       `${Math.round(anteil * 100)} %`);

    await q.schliessen();
  }
}
