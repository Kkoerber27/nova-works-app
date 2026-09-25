/* Bewegung beim Scrollen.

   Nur eines fährt beim Scrollen mit: die Bilder werden tiefer. Kann der
   Browser scrollgebundene CSS-Animationen, macht das Stylesheet die
   Arbeit; sonst springt eine Schleife in main.js ein.

   Den Farbtausch der Überschriften gibt es nicht mehr - und genau das
   wird hier festgehalten, damit er nicht zurückkommt.

   Beide Wege werden geprüft - der Rückfallweg hatte zwei Fehler:
   ein Zähler lief ins Negative, und die Kartenbilder wurden nie
   sichtbar, weil das Laufband in der mittleren Kopie läuft.

   Und: im Ruhe-Modus (prefers-reduced-motion) muss alles stillstehen. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Bewegung beim Scrollen';

const tiefe = (p) => p.evaluate(() => {
  const nimm = (w) => [...document.querySelectorAll(w)].map((e) => {
    const s = getComputedStyle(e);
    return { skala: s.scale, versatz: s.translate };
  });
  return { referenz: nimm('.ref__foto'), karte: nimm('.card__media') };
});

export default async function ({ ort, browser, ok }) {
  const p = await seite(browser, ok);
  await p.goto(ort + '/index.php');
  await p.waitForTimeout(900);

  const kann = await p.evaluate(() =>
    !!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'scroll()')));
  ok.hinweis(kann ? 'Browser kann scrollgebundene Animationen - das Stylesheet führt'
                  : 'Browser kann sie nicht - die Schleife in main.js führt');

  /* Zwei Messpunkte weit auseinander: dazwischen muss sich etwas
     bewegen. */
  await p.evaluate(() => document.querySelectorAll('.ref')[0].scrollIntoView({ block: 'end' }));
  await p.waitForTimeout(700);
  const oben = await tiefe(p);
  await p.evaluate(() => document.querySelectorAll('.ref')[0].scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(700);
  const unten = await tiefe(p);

  const bewegt = oben.referenz.some((a, i) =>
    a.skala !== unten.referenz[i].skala || a.versatz !== unten.referenz[i].versatz);
  ok(bewegt, 'die Projektbilder fahren beim Scrollen heran',
     `${oben.referenz[0]?.skala} / ${oben.referenz[0]?.versatz}  ->  ` +
     `${unten.referenz[0]?.skala} / ${unten.referenz[0]?.versatz}`);

  /* Die Kartenbilder hängen an der Sicht auf den Abschnitt Services,
     nicht an den Referenzen - also dort messen. Die Karten selbst
     laufen im Band und stehen nie still; ihr Bezug ist der Abschnitt. */
  await p.evaluate(() => document.getElementById('services').scrollIntoView({ block: 'end' }));
  await p.waitForTimeout(700);
  const kOben = await tiefe(p);
  await p.evaluate(() => document.getElementById('services').scrollIntoView({ block: 'start' }));
  await p.waitForTimeout(700);
  const kUnten = await tiefe(p);
  const kartenBewegt = kOben.karte.some((a, i) =>
    a.skala !== kUnten.karte[i].skala || a.versatz !== kUnten.karte[i].versatz);
  ok(kartenBewegt, 'die Kartenbilder im Laufband ebenso',
     `${kOben.karte[0]?.skala} / ${kOben.karte[0]?.versatz}  ->  ` +
     `${kUnten.karte[0]?.skala} / ${kUnten.karte[0]?.versatz}`);

  /* Die Überschriften bleiben unterwegs, wie sie sind. Gemessen wird
     die gerechnete Farbe, nicht die Angabe. */
  const farben = [];
  for (const anteil of [0.1, 0.45, 0.8]) {
    await p.evaluate((a) => window.scrollTo(0,
      (document.documentElement.scrollHeight - innerHeight) * a), anteil);
    await p.waitForTimeout(700);
    farben.push(await p.evaluate(() => [...document.querySelectorAll('.section__title')]
      .map((t) => getComputedStyle(t).color)));
  }
  const steht = farben[0].every((c, i) => c === farben[1][i] && c === farben[2][i]);
  ok(steht, 'die Abschnittsüberschriften wechseln unterwegs nicht die Farbe',
     farben[0][0]);

  /* Und kein Halbsatz darin steht in der Signalfarbe - das einzelne
     farbige Wort in einer Überschrift ist genau das, was hier weg
     sollte. */
  const bunt = await p.evaluate(() => [...document.querySelectorAll('.section__title em')].length);
  ok(bunt === 0, 'und keine trägt einen farbig abgesetzten Halbsatz');
  await p.schliessen();

  /* --- Ruhe-Modus: nichts fährt, nichts wechselt --- */
  const r = await seite(browser, ok, { reducedMotion: 'reduce' });
  await r.goto(ort + '/index.php');
  await r.waitForTimeout(900);
  await r.evaluate(() => document.querySelectorAll('.ref')[0].scrollIntoView({ block: 'end' }));
  await r.waitForTimeout(600);
  const rOben = await tiefe(r);
  await r.evaluate(() => document.querySelectorAll('.ref')[0].scrollIntoView({ block: 'start' }));
  await r.waitForTimeout(600);
  const rUnten = await tiefe(r);
  ok(rOben.referenz.every((a, i) =>
       a.skala === rUnten.referenz[i].skala && a.versatz === rUnten.referenz[i].versatz),
     'im Ruhe-Modus fährt kein Bild heran');
  const rZeilen = await r.evaluate(() => [...document.querySelectorAll('.hero__zeile-innen')]
    .map((z) => Math.round(new DOMMatrix(getComputedStyle(z).transform).m42)));
  ok(rZeilen.every((v) => Math.abs(v) <= 1), 'und der Claim steht ohne Fahrt', rZeilen.join(', '));
  await r.schliessen();
}
