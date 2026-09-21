/* Die Vorschau.

   Sie ist eine zweite Umgebung und muss auch so geprüft werden. Einmal
   ist genau das schiefgegangen: Der Startzustand des Claims hing an
   einer Klasse, die ein Schnipsel im Kopf der Seite setzte - den baute
   die Vorschau nicht mit ein. In der Vorschau passierte deshalb
   sichtbar nichts, obwohl auf der Seite alles lief. */
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { WURZEL } from '../hilfe.mjs';
export const NAME = 'Vorschau';

const lauf = promisify(execFile);

export default async function ({ browser, ok }) {
  const ziel = join(tmpdir(), `nova-vorschau-${process.pid}.html`);
  let bericht = '';
  try {
    const { stdout } = await lauf('node', [join(WURZEL, 'pruefung/bau.mjs'), ziel]);
    bericht = stdout.trim();
    ok(true, 'die Vorschau lässt sich bauen');
    ok.hinweis(bericht.split('\n').map((z) => z.trim()).join(' · '));
  } catch (e) {
    ok(false, 'die Vorschau lässt sich bauen', e.message.split('\n')[0]);
    return;
  }

  const roh = await readFile(ziel, 'utf8');
  ok(!/assets\/(img|css|js|fonts)\//.test(roh),
     'kein Pfad nach draußen - die Datei steht für sich allein');
  ok(/data:font\/woff2;base64,/.test(roh), 'die Schrift ist eingebettet');
  ok(/data:image\/(jpeg|png|svg)/.test(roh), 'die Bilder sind eingebettet');

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const fehler = []; p.on('pageerror', (e) => fehler.push(e.message));
  const nachDraussen = [];
  p.on('request', (r) => { if (!/^(data|file|blob):/.test(r.url())) nachDraussen.push(r.url()); });

  await p.goto('file://' + ziel);
  await p.waitForTimeout(2000);

  const z = await p.evaluate(() => ({
    projekte: document.querySelectorAll('.refs .ref').length,
    zeilen: document.querySelectorAll('.hero__zeile-innen').length,
    auftritt: document.querySelector('.hero').className,
    versatz: [...document.querySelectorAll('.hero__zeile-innen')]
      .map((e) => Math.round(new DOMMatrix(getComputedStyle(e).transform).m42)),
    gewicht: getComputedStyle(document.querySelector('.hero__title')).fontWeight,
    logo: (() => { const i = document.querySelector('.masthead__logo img');
      return i && i.complete && i.naturalWidth > 0; })(),
    kopfbild: getComputedStyle(document.querySelector('.hero__media')).backgroundImage.slice(0, 20),
    lupe: !!document.querySelector('[data-lupe]'),
    zustimmung: !!document.querySelector('.zustimmung'),
    fussknopf: !!document.querySelector('.footer__knopf'),
  }));

  ok(z.projekte >= 5, 'alle Projekte sind drin', `${z.projekte}`);
  ok(z.zeilen >= 2 && /hero--auftritt/.test(z.auftritt),
     'der Claim ist zerlegt und der Auftritt angemeldet', z.auftritt);
  ok(z.versatz.every((v) => Math.abs(v) <= 1),
     'und am Ende steht jede Zeile', z.versatz.join(', '));
  ok(Number(z.gewicht) >= 800, 'im kräftigen Schnitt', z.gewicht);
  ok(z.logo, 'das Logo lädt aus der Datei');
  ok(z.kopfbild.startsWith('url("data:'), 'das Kopfbild ebenso', z.kopfbild + '…');
  ok(z.lupe && z.zustimmung && z.fussknopf,
     'Großansicht, Einwilligungs-Hinweis und Fußzeilen-Knopf sind da');

  /* Ein Klick muss auch hier ein Bild zeigen - nicht einen toten Pfad. */
  await p.evaluate(() => document.querySelector('.ref__bild[data-lupe-auf]').scrollIntoView());
  await p.waitForTimeout(500);
  await p.click('.ref__bild[data-lupe-auf]');
  await p.waitForTimeout(600);
  const gross = await p.evaluate(() => {
    const b = document.querySelector('[data-lupe-bild]');
    return { offen: document.querySelector('[data-lupe]').open,
             quelle: (b.getAttribute('src') || '').slice(0, 22),
             geladen: b.complete && b.naturalWidth > 0, breite: b.naturalWidth,
             /* Im Dialog suchen, nicht im ganzen Dokument: Das Merkmal
                data-lupe-titel trägt auch jede Bilderliste, und die
                steht im Quelltext weiter oben. */
             titel: document.querySelector('[data-lupe] [data-lupe-titel]').textContent.trim() };
  });
  ok(gross.offen && gross.quelle.startsWith('data:image'),
     'ein Klick öffnet die Großansicht mit eingebettetem Bild', gross.quelle + '…');
  ok(gross.geladen && gross.breite > 100, 'und das Bild lädt wirklich', `${gross.breite} px`);
  ok(gross.titel.length > 3, 'der Projektname steht darunter', gross.titel);

  ok(nachDraussen.length === 0, 'die Vorschau ruft nichts von außen ab',
     nachDraussen.slice(0, 2).join(' ') || 'keine Abrufe');
  ok(fehler.length === 0, 'keine Skriptfehler in der Vorschau', fehler.join(' | ') || 'keine');

  await ctx.close();
  await unlink(ziel).catch(() => {});
}
