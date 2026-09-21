/* Seitlicher Überlauf.

   Diese Prüfung hat am meisten gefunden: ein clip-path, das den
   Überlauf stehen ließ; unteilbare URLs in der Datenschutzerklärung;
   ein fehlendes min-width in der AGB-Übersicht; ein Raster mit
   aspect-ratio, das seine Mindestbreite aus der Texthöhe ableitete.

   Ausdrücklich erlaubt sind nur Kästen, die selbst seitwärts scrollen -
   das Laufband und die Tabellen in den Rechtstexten. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Breite';

const SEITEN = ['/index.html', '/impressum.html', '/datenschutz.html', '/agb.html', '/404.html'];
const BREITEN = [320, 390, 430, 768, 1024, 1440, 1920];

export default async function ({ ort, browser, ok }) {
  for (const breite of BREITEN) {
    const p = await seite(browser, ok, { viewport: { width: breite, height: 900 } });
    for (const pfad of SEITEN) {
      await p.goto(ort + pfad);
      await p.waitForTimeout(500);
      /* Bis ganz nach unten: die Projektbilder laden erst beim
         Herankommen, dadurch wächst die Seite unter dem Scrollen. */
      for (let i = 0; i < 10; i++) {
        await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await p.waitForTimeout(250);
        if (await p.evaluate(() => Math.abs(window.scrollY -
            (document.documentElement.scrollHeight - innerHeight)) < 2)) break;
      }
      const w = await p.evaluate(() => document.documentElement.scrollWidth);
      ok(w <= breite, `${String(breite).padStart(4)} px  ${pfad.padEnd(20)} kein seitlicher Überlauf`,
         w > breite ? `${w} statt ${breite}` : '');
      if (w > breite) {
        /* Beim Fehlschlag gleich den Schuldigen nennen - sonst sucht
           man ihn von Hand. */
        const raus = await p.evaluate(() => [...document.querySelectorAll('body *')]
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
          .filter((e) => !e.closest('[data-slider], .agb__tabelle, .legal__tabelle'))
          .slice(0, 4)
          .map((e) => `${e.tagName}.${(e.className || '').toString().slice(0, 30)}`));
        ok.hinweis('ragt heraus: ' + (raus.join(', ') || '(nichts außerhalb der Scrollkästen)'));
      }
    }
    await p.schliessen();
  }

  /* --- Der rote Platzhalter --------------------------------------------
     Er erscheint nur, solange ein Projekt kein Foto hat. Haben alle
     eines, wird sein CSS nie ausgeführt - und ein Fehler darin fiele
     erst auf, wenn das nächste Projekt ohne Bild dazukommt. Genau das
     ist schon passiert: Der Kasten ist ein Raster mit aspect-ratio und
     leitete ohne min-width:0 seine Mindestbreite aus der Texthöhe ab.
     Am Handy war er dadurch 424 statt 350 px breit.

     Deshalb wird er hier eingesetzt, auch wenn keiner gebraucht wird. */
  for (const breite of [320, 390]) {
    const p = await seite(browser, ok, { viewport: { width: breite, height: 900 } });
    await p.goto(ort + '/index.html');
    await p.waitForTimeout(500);
    const gesetzt = await p.evaluate(() => {
      const m = document.querySelector('.ref__media');
      if (!m) return false;
      m.innerHTML = '<p class="ref__bild ref__bild--offen">' +
        '<strong>Foto folgt</strong>' +
        'Zu diesem Projekt liegt noch kein Bild vor.</p>';
      return true;
    });
    ok(gesetzt, `${String(breite).padStart(4)} px  Platzhalter zum Prüfen eingesetzt`);
    await p.waitForTimeout(400);
    const mass = await p.evaluate(() => {
      const e = document.querySelector('.ref__bild--offen');
      const r = e.getBoundingClientRect();
      return { seite: document.documentElement.scrollWidth,
               kasten: Math.round(r.width),
               eltern: Math.round(e.parentElement.getBoundingClientRect().width) };
    });
    ok(mass.seite <= breite,
       `${String(breite).padStart(4)} px  mit Platzhalter kein seitlicher Überlauf`,
       mass.seite > breite ? `${mass.seite} statt ${breite}` : '');
    ok(mass.kasten <= mass.eltern + 1,
       `${String(breite).padStart(4)} px  der Platzhalter bleibt in seiner Spalte`,
       `${mass.kasten} in ${mass.eltern} px`);
    await p.schliessen();
  }
}
