/* Die Druckausgabe der Rechtstexte.

   AGB und Datenschutzerklärung werden ausgedruckt und abgeheftet. Auf
   Papier muss deshalb alles schwarz auf weiß stehen - das Aufzählen
   einzelner Auswahlbefehle ließ immer wieder etwas hell: erst <strong>,
   dann die Geltungszeile. Jetzt hält eine Regel alles. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Druckausgabe';

export default async function ({ ort, browser, ok }) {
  const p = await seite(browser, ok);
  await p.emulateMedia({ media: 'print' });

  for (const pfad of ['/agb.html', '/datenschutz.html', '/impressum.html']) {
    await p.goto(ort + pfad);
    await p.waitForTimeout(500);
    const d = await p.evaluate(() => {
      const hell = (f) => {
        const m = f.match(/\d+/g);
        if (!m) return false;
        const [r, g, b] = m.map(Number);
        return (r * 0.299 + g * 0.587 + b * 0.114) > 110;   // zu hell für Papier
      };
      const alle = [...document.querySelectorAll('main *')]
        .filter((e) => e.textContent.trim().length > 0 &&
                       e.getBoundingClientRect().height > 0);
      return {
        grund: getComputedStyle(document.body).backgroundColor,
        helle: alle.filter((e) => hell(getComputedStyle(e).color))
          .slice(0, 5).map((e) => `${e.tagName}.${(e.className || '').toString().slice(0, 24)}`),
        geprueft: alle.length,
        weg: ['.masthead', '.footer', '.grain', '.skip-link', '.zustimmung']
          .filter((w) => [...document.querySelectorAll(w)]
            .some((e) => getComputedStyle(e).display !== 'none')),
      };
    });
    ok(/rgb\(255,\s*255,\s*255\)|white/.test(d.grund),
       `${pfad.padEnd(20)} weißer Grund`, d.grund);
    ok(d.helle.length === 0, `${pfad.padEnd(20)} nichts bleibt hell`,
       d.helle.join(', ') || `${d.geprueft} Elemente geprüft`);
    ok(d.weg.length === 0, `${pfad.padEnd(20)} Kopf, Fuß und Hinweis sind weg`,
       d.weg.join(', ') || 'alles ausgeblendet');
  }
  await p.schliessen();
}
