/* Der Auftritt des Claims.

   Der Claim wird von main.js in seine tatsächlichen Zeilen zerlegt und
   fährt Zeile für Zeile herein. Zwei Fehler sind dabei schon passiert
   und dürfen nicht wiederkommen:
   - Geschnitten wurde vor dem Laden der Schrift, dadurch kam jedes Wort
     auf eine eigene Zeile.
   - Der Startzustand hing an einer Klasse, die ein anderer Schnipsel
     setzte. Fehlte der, stand der Claim von Anfang an - es passierte
     sichtbar nichts. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Hero-Auftritt';

export default async function ({ ort, browser, ok }) {
  const p = await seite(browser, ok);
  await p.goto(ort + '/index.php');

  /* Gleich nach dem Laden: die Zeilen müssen unterhalb ihres Kastens
     stehen, sonst gibt es nichts zu sehen. */
  await p.waitForFunction(() =>
    document.querySelector('.hero__zeile-innen') !== null, null, { timeout: 5000 });
  const start = await p.evaluate(() => {
    const zeilen = [...document.querySelectorAll('.hero__zeile-innen')];
    return {
      anzahl: zeilen.length,
      versatz: zeilen.map((z) => Math.round(new DOMMatrix(getComputedStyle(z).transform).m42)),
      klasse: document.querySelector('.hero').className,
      geschnitten: [...document.querySelectorAll('.hero__zeile')]
        .every((z) => getComputedStyle(z).overflow === 'hidden'),
    };
  });
  ok(start.anzahl >= 2, 'der Claim ist in Zeilen zerlegt', `${start.anzahl} Zeilen`);
  ok(/hero--auftritt/.test(start.klasse), 'main.js hat den Auftritt angemeldet', start.klasse);
  ok(start.geschnitten, 'die Zeilen sitzen in geschnittenen Kästen');
  ok(start.versatz.every((v) => v > 20),
     'jede Zeile startet unterhalb ihres Kastens - der Auftritt läuft',
     `Verschiebung ${start.versatz.join(', ')} px`);

  await p.waitForTimeout(1800);
  const ende = await p.evaluate(() => {
    const zeilen = [...document.querySelectorAll('.hero__zeile-innen')];
    return {
      versatz: zeilen.map((z) => Math.round(new DOMMatrix(getComputedStyle(z).transform).m42)),
      verzug: zeilen.map((z) => getComputedStyle(z).transitionDelay),
      text: document.querySelector('.hero__title').textContent.replace(/\s+/g, ' ').trim(),
      gewicht: getComputedStyle(document.querySelector('.hero__title')).fontWeight,
      mittig: getComputedStyle(document.querySelector('.hero__title')).textAlign,
    };
  });
  ok(ende.versatz.every((v) => Math.abs(v) <= 1), 'am Ende steht jede Zeile',
     `Verschiebung ${ende.versatz.join(', ')} px`);
  ok(new Set(ende.verzug).size > 1, 'die Zeilen kommen versetzt, nicht alle auf einmal',
     ende.verzug.join(' '));
  ok(ende.text === 'Momente, die bleiben, weil alles passt.',
     'der Claim steht vollständig und mit Leerzeichen', ende.text);
  ok(Number(ende.gewicht) >= 800, 'im kräftigen Schnitt', ende.gewicht);
  ok(ende.mittig === 'center', 'und mittig');

  /* Am Handy bricht er anders um - er muss trotzdem vollständig sein. */
  const h = await seite(browser, ok, { viewport: { width: 390, height: 844 } });
  await h.goto(ort + '/index.php');
  await h.waitForTimeout(2000);
  const handy = await h.evaluate(() => ({
    zeilen: document.querySelectorAll('.hero__zeile-innen').length,
    text: document.querySelector('.hero__title').textContent.replace(/\s+/g, ' ').trim(),
  }));
  ok(handy.zeilen > start.anzahl, 'am Handy bricht der Claim in mehr Zeilen um',
     `${handy.zeilen} statt ${start.anzahl}`);
  ok(handy.text === 'Momente, die bleiben, weil alles passt.', 'und bleibt vollständig');
  await h.schliessen();

  /* Ohne JavaScript steht er einfach da - ohne Auftritt, aber lesbar. */
  const q = await seite(browser, ok, { javaScriptEnabled: false });
  await q.goto(ort + '/index.php', { waitUntil: 'networkidle' });
  const roh = await q.evaluate(() => {
    const t = document.querySelector('.hero__title');
    return { text: t.textContent.replace(/\s+/g, ' ').trim(),
             sichtbar: getComputedStyle(t).opacity !== '0' && t.getBoundingClientRect().height > 20 };
  });
  ok(roh.sichtbar && roh.text === 'Momente, die bleiben, weil alles passt.',
     'ohne JavaScript steht der Claim vollständig da');
  await q.schliessen();
  await p.schliessen();
}
