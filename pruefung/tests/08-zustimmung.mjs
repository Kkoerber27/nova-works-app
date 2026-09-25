/* Der Einwilligungs-Hinweis und die Einstellungen dahinter.

   Der wichtigste Punkt: Wegklicken ist keine Zustimmung. Escape und
   der Klick neben den Schirm dürfen nichts speichern - sonst wäre die
   Frage eine Falle statt einer Frage. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Einwilligung';

const SCHLUESSEL = 'nova-einwilligung';
const SEITEN = ['/index.php', '/impressum.html', '/datenschutz.html', '/agb.html', '/404.html'];

const gespeichert = (p) => p.evaluate((k) => {
  try { return JSON.parse(window.localStorage.getItem(k) || 'null'); } catch (e) { return 'FEHLER'; }
}, SCHLUESSEL);

export default async function ({ ort, browser, ok }) {
  /* --- Der Hinweis kommt auf jeder Seite --- */
  {
    const p = await seite(browser, ok);
    for (const pfad of SEITEN) {
      await p.goto(ort + pfad);
      await p.waitForTimeout(450);
      const z = await p.evaluate(() => {
        const b = document.querySelector('.zustimmung');
        return { da: !!b, rolle: b && b.getAttribute('role'),
                 benannt: !!(b && b.getAttribute('aria-labelledby')),
                 verweis: b && b.querySelector('a')?.getAttribute('href'),
                 wege: [...document.querySelectorAll('[data-zustimmung]')]
                   .map((k) => k.getAttribute('data-zustimmung')) };
      });
      ok(z.da && z.rolle === 'dialog' && z.benannt,
         `${pfad.padEnd(20)} Hinweis erscheint und ist benannt`);
      ok(z.wege.includes('alle') && z.wege.includes('keine') && z.wege.includes('einstellungen'),
         `${pfad.padEnd(20)} zustimmen, ablehnen, Einstellungen`, z.wege.join(', '));
      /* Die 404-Seite kann unter jedem Pfad ausgeliefert werden und
         verlinkt deshalb absolut. */
      const soll = pfad === '/404.html' ? '/datenschutz.html' : 'datenschutz.html';
      ok(z.verweis === soll, `${pfad.padEnd(20)} Verweis auf die Erklärung stimmt`, z.verweis);
    }
    await p.schliessen();
  }

  /* --- Keiner der Wege sticht hervor --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/index.php'); await p.waitForTimeout(500);
    const stil = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
      return { text: e.textContent.trim(), klasse: e.className,
               masse: `${Math.round(r.width)}x${Math.round(r.height)}`,
               bild: [c.backgroundColor, c.color, c.borderColor, c.borderWidth,
                      c.fontWeight, c.fontSize].join(' | ') }; };
    const zwei = await p.$$eval('.zustimmung__wahl .btn', (el, _) =>
      el.map((e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
        return { text: e.textContent.trim(), klasse: e.className,
                 masse: `${Math.round(r.width)}x${Math.round(r.height)}`,
                 bild: [c.backgroundColor, c.color, c.borderColor, c.borderWidth,
                        c.fontWeight, c.fontSize].join(' | ') }; }));
    ok(zwei.length === 2, 'zustimmen und ablehnen stehen nebeneinander',
       zwei.map((z) => z.text).join(' / '));
    ok(new Set(zwei.map((z) => z.masse)).size === 1,
       'gleich groß - ablehnen ist nicht der kleinere Weg', zwei[0]?.masse);
    ok(new Set(zwei.map((z) => z.bild)).size === 1 &&
       new Set(zwei.map((z) => z.klasse)).size === 1,
       'und optisch nicht zu unterscheiden', zwei[0]?.bild);
    await p.schliessen();
  }

  /* --- Zustimmen speichert und bleibt gespeichert --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/index.php'); await p.waitForTimeout(500);
    await p.click('[data-zustimmung="alle"]'); await p.waitForTimeout(350);
    ok(await p.$$eval('.zustimmung', (e) => e.length) === 0, 'nach Zustimmen ist der Hinweis weg');
    const w = await gespeichert(p);
    ok(w && w.wahl && Object.values(w.wahl).every((v) => v === true),
       'Zustimmen speichert alle Gruppen', JSON.stringify(w?.wahl));
    ok(Object.keys(w).sort().join(',') === 'stand,wahl,zeit',
       'gespeichert werden nur Auswahl, Zeit und Stand - keine Kennung', Object.keys(w).join(','));
    await p.reload(); await p.waitForTimeout(600);
    ok(await p.$$eval('.zustimmung', (e) => e.length) === 0,
       'und er kommt beim nächsten Aufruf nicht wieder');
    await p.schliessen();
  }

  /* --- Ablehnen lässt nur das Notwendige stehen --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/index.php'); await p.waitForTimeout(500);
    await p.click('[data-zustimmung="keine"]'); await p.waitForTimeout(350);
    const w = await gespeichert(p);
    ok(w.wahl.notwendig === true, 'das Notwendige bleibt');
    ok(Object.entries(w.wahl).filter(([k]) => k !== 'notwendig').every(([, v]) => v === false),
       'alles Optionale ist aus', JSON.stringify(w.wahl));
    ok(await p.evaluate(() => window.novaEinwilligung.erlaubt('statistik')) === false,
       'die Auskunft für später sagt: nicht erlaubt');
    await p.schliessen();
  }

  /* --- Wegklicken ist keine Zustimmung --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/index.php'); await p.waitForTimeout(500);
    await p.click('[data-zustimmung="einstellungen"]'); await p.waitForTimeout(400);
    ok(await p.$$eval('dialog.einstellungen[open]', (e) => e.length) === 1,
       'die Einstellungen gehen auf');
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    ok(await gespeichert(p) === null, 'Escape speichert nichts');
    ok(await p.$$eval('.zustimmung', (e) => e.length) === 1,
       'und der Hinweis steht wieder da - die Frage bleibt offen');
    await p.schliessen();
  }

  /* --- Einstellungen: Gruppen, gemischte Auswahl, Rückweg --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/index.php'); await p.waitForTimeout(500);
    await p.click('[data-zustimmung="einstellungen"]'); await p.waitForTimeout(400);
    const gruppen = await p.$$eval('.einstellungen .gruppe', (el) => el.map((g) => ({
      name: g.querySelector('.gruppe__name').textContent.trim(),
      leer: !!g.querySelector('.gruppe__leer'),
      pflicht: g.querySelector('input').disabled,
      an: g.querySelector('input').checked,
    })));
    ok(gruppen.length >= 2, 'die Gruppen stehen einzeln da', gruppen.map((g) => g.name).join(', '));
    ok(gruppen.filter((g) => g.pflicht).every((g) => g.an),
       'das Notwendige ist an und lässt sich nicht abwählen');
    ok(gruppen.filter((g) => !g.pflicht).every((g) => !g.an),
       'alles andere ist zunächst aus');
    for (const g of gruppen.filter((x) => x.leer)) {
      ok(true, `${g.name.padEnd(16)} offen als "zurzeit nicht im Einsatz" gekennzeichnet`);
    }
    const drei = await p.$$eval('.einstellungen__wahl .btn', (el) => el.map((e) => {
      const c = getComputedStyle(e);
      return { text: e.textContent.trim(), klasse: e.className,
               bild: [c.backgroundColor, c.color, c.borderColor, c.fontWeight].join(' | ') }; }));
    ok(new Set(drei.map((d) => d.bild)).size === 1 && new Set(drei.map((d) => d.klasse)).size === 1,
       'auch hier sticht kein Weg hervor', drei.map((d) => d.text).join(' / '));

    /* Einen optionalen Schalter umlegen - dort klicken, wo er zu sehen
       ist; die unsichtbare Checkbox liegt genau darüber. */
    const optional = await p.$('.gruppe input:not([disabled])');
    if (optional) {
      const schluessel = await optional.evaluate((e) => e.getAttribute('data-gruppe'));
      const box = await optional.boundingBox();
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await p.waitForTimeout(250);
      ok(await optional.evaluate((e) => e.checked),
         'ein Klick auf den sichtbaren Schalter legt ihn um', schluessel);
      await p.click('[data-einstellung="speichern"]'); await p.waitForTimeout(400);
      const w = await gespeichert(p);
      ok(w.wahl[schluessel] === true, 'gespeichert wird genau das Angekreuzte', JSON.stringify(w.wahl));
      ok(await p.$$eval('.zustimmung', (e) => e.length) === 0, 'der Hinweis verschwindet');

      await p.click('.footer__knopf'); await p.waitForTimeout(400);
      ok(await p.$$eval('dialog.einstellungen[open]', (e) => e.length) === 1,
         'die Fußzeile öffnet die Einstellungen erneut');
      ok(await p.$eval(`[data-gruppe="${schluessel}"]`, (e) => e.checked),
         'und die Wahl steht beim Wiederöffnen drin');
    }
    await p.schliessen();
  }

  /* --- Ein neuer Stand fragt neu --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/index.php'); await p.waitForTimeout(500);
    await p.evaluate((k) => window.localStorage.setItem(k, JSON.stringify(
      { stand: 0, zeit: '2020-01-01T00:00:00.000Z', wahl: { notwendig: true, statistik: true } })), SCHLUESSEL);
    await p.reload(); await p.waitForTimeout(600);
    ok(await p.$$eval('.zustimmung', (e) => e.length) === 1,
       'eine Entscheidung zu einem alten Stand zählt nicht mehr - es wird neu gefragt');
    await p.schliessen();
  }

  /* --- Kein Cookie, keine Verbindung nach draußen --- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    const fremd = [];
    p.on('request', (r) => { const h = new URL(r.url()).hostname; if (h !== '127.0.0.1') fremd.push(h); });
    await p.goto(ort + '/index.php'); await p.waitForTimeout(600);
    await p.click('[data-zustimmung="alle"]'); await p.waitForTimeout(500);
    ok(fremd.length === 0, 'auch nach der Zustimmung geht nichts nach draußen',
       fremd.join(', ') || 'keine Verbindung');
    ok(await p.evaluate(() => document.cookie) === '', 'es wird kein Cookie gesetzt');
    ok((await ctx.cookies()).length === 0, 'und der Browser bekommt auch keines vom Server');
    await ctx.close();
  }

  /* --- Ohne JavaScript entsteht nichts, und es fehlt nichts --- */
  {
    const q = await seite(browser, ok, { javaScriptEnabled: false });
    await q.goto(ort + '/index.php', { waitUntil: 'networkidle' });
    ok(await q.$$eval('.zustimmung', (e) => e.length) === 0, 'ohne JavaScript kein Hinweis');
    ok(await q.$$eval('.footer__knopf', (e) => e.length) === 0,
       'und kein Knopf, der ins Leere führte');
    await q.schliessen();
  }

  /* --- Am Handy verdeckt er die Pflichtangaben nicht --- */
  {
    const p = await seite(browser, ok, { viewport: { width: 390, height: 844 } });
    await p.goto(ort + '/index.php'); await p.waitForTimeout(700);
    const k = await p.$eval('.zustimmung', (e) => Math.round(e.getBoundingClientRect().bottom));
    ok(k <= 844, 'der Hinweis steht vollständig im Bild', `Unterkante ${k} von 844`);
    for (let i = 0; i < 12; i++) {
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForTimeout(300);
      if (await p.evaluate(() => Math.abs(window.scrollY -
          (document.documentElement.scrollHeight - innerHeight)) < 2)) break;
    }
    await p.waitForTimeout(400);
    const frei = await p.evaluate(() => {
      const a = document.querySelector('.footer__meta a[href*="impressum"]');
      const r = a.getBoundingClientRect();
      const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!oben && (a === oben || a.contains(oben));
    });
    ok(frei, 'das Impressum bleibt anklickbar, obwohl der Hinweis steht');
    await p.schliessen();
  }
}
