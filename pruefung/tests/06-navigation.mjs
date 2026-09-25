/* Navigation, Kopfzeile, Laufband.

   Das Laufband ist ein seitwärts scrollbarer Kasten, den main.js
   selbst weiterschiebt und für den Endloslauf verdoppelt. Es muss sich
   auch mit der Tastatur bedienen lassen. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Navigation und Laufband';

const SEITEN = ['/index.php', '/impressum.php', '/datenschutz.php', '/agb.php', '/404.php'];

export default async function ({ ort, browser, ok }) {
  const p = await seite(browser, ok);

  for (const pfad of SEITEN) {
    await p.goto(ort + pfad);
    await p.waitForTimeout(450);
    const n = await p.evaluate(() => ({
      titel: document.title,
      nav: [...document.querySelectorAll('.nav .nav__link')].map((a) => a.textContent.trim()),
      sprung: !!document.querySelector('.skip-link[href="#main"]'),
      haupt: !!document.getElementById('main'),
      fuss: [...document.querySelectorAll('.footer__meta a')].map((a) => a.textContent.trim()),
      logo: !!document.querySelector('.masthead__logo img[alt]'),
    }));
    ok(/nova\s*works/i.test(n.titel), `${pfad.padEnd(20)} Seitentitel`, n.titel);
    ok(n.nav.length >= 4, `${pfad.padEnd(20)} Navigation vollständig`, n.nav.join(' · '));
    ok(n.sprung && n.haupt, `${pfad.padEnd(20)} Sprungmarke zum Inhalt`);
    ok(n.logo, `${pfad.padEnd(20)} Logo mit Alternativtext`);
    ok(n.fuss.some((t) => /Impressum/.test(t)) && n.fuss.some((t) => /Datenschutz/.test(t)) &&
       n.fuss.some((t) => /AGB/.test(t)),
       `${pfad.padEnd(20)} Pflichtangaben in der Fußzeile`, n.fuss.join(' · '));
  }

  /* --- Kopfzeile klebt beim Scrollen --- */
  await p.goto(ort + '/index.php');
  await p.waitForTimeout(600);
  ok(!(await p.evaluate(() => document.getElementById('masthead').classList.contains('is-stuck'))),
     'die Kopfzeile ist oben noch nicht angeheftet');
  await p.evaluate(() => window.scrollTo(0, 1200));
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => document.getElementById('masthead').classList.contains('is-stuck')),
     'beim Scrollen heftet sie sich an');

  /* --- Laufband --- */
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(400);
  const band = await p.evaluate(() => {
    const k = document.querySelector('[data-slider]');
    return { da: !!k, karten: document.querySelectorAll('.card').length,
             scrollbar: k.scrollWidth > k.clientWidth + 10,
             erreichbar: k.tabIndex >= 0, rolle: k.getAttribute('role'),
             name: k.getAttribute('aria-label') };
  });
  ok(band.da && band.karten >= 3, 'das Laufband trägt die Leistungsfelder', `${band.karten} Karten`);
  ok(band.scrollbar, 'und ist seitwärts scrollbar');
  ok(band.erreichbar && band.rolle === 'region' && !!band.name,
     'mit Tastatur erreichbar und benannt', band.name);

  /* Der Fokus hält das Band an - sonst liefe es unter der Tastatur
     weiter und man käme nie dorthin, wo man hinwollte.

     Vorher muss die Seite stillstehen: Das Stylesheet scrollt weich,
     und solange die Seite noch fährt, gehen die Pfeiltasten an sie
     statt an das Band. Genau daran ist diese Prüfung erst
     unzuverlässig geworden - mal ging sie durch, mal nicht. */
  const stelle = () => p.evaluate(() =>
    Math.round(document.querySelector('[data-slider]').scrollLeft));
  const steht = async () => {
    let letzte = -1;
    for (let i = 0; i < 40; i++) {
      const y = await p.evaluate(() => Math.round(window.scrollY));
      if (y === letzte) return y;
      letzte = y;
      await p.waitForTimeout(120);
    }
    return letzte;
  };
  await p.evaluate(() => document.getElementById('services').scrollIntoView());
  await steht();
  await p.evaluate(() => document.querySelector('[data-slider]').focus());
  await steht();
  const a = await stelle();
  await p.waitForTimeout(600);
  const b = await stelle();
  ok(a === b, 'der Fokus hält den Lauf an', `${a} -> ${b}`);
  /* Von einer festen Stelle aus starten. Stand das Band schon fast am
     Ende, kamen die Tasten dort an und es bewegte sich kaum - je nach
     Zufall mal so, mal so. */
  await p.evaluate(() => { document.querySelector('[data-slider]').scrollLeft = 200; });
  await p.waitForTimeout(400);
  const b2 = await stelle();
  for (let i = 0; i < 5; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150); }
  const c = await stelle();
  /* Nur auf Bewegung prüfen, nicht auf Richtung: Das Band läuft endlos,
     indem die Karten verdoppelt sind und scrollLeft beim Überschreiten
     eines Satzes um dessen Breite zurückspringt. Sichtbar ändert sich
     dabei nichts, die Zahl springt aber. Da der Lauf steht, kann jede
     Änderung nur von den Tasten kommen. */
  ok(Math.abs(c - b2) > 40, 'mit den Pfeiltasten bedienbar', `${b2} -> ${c}`);

  /* --- Mobile Navigation --- */
  const h = await seite(browser, ok, { viewport: { width: 390, height: 844 } });
  await h.goto(ort + '/index.php');
  await h.waitForTimeout(600);
  const taste = await h.$('.nav-toggle');
  ok(!!taste, 'am Handy gibt es die Menütaste');
  if (taste) {
    ok(await h.evaluate(() => document.getElementById('nav-drawer').hidden ||
       !document.getElementById('nav-drawer').classList.contains('is-offen')),
       'das Menü ist zunächst zu');
    await taste.click(); await h.waitForTimeout(500);
    const auf = await h.evaluate(() => {
      const d = document.getElementById('nav-drawer');
      return { sichtbar: !d.hidden && d.getBoundingClientRect().height > 50,
               verweise: d.querySelectorAll('a').length };
    });
    ok(auf.sichtbar && auf.verweise >= 4, 'ein Tippen öffnet es', `${auf.verweise} Verweise`);
    await h.keyboard.press('Escape'); await h.waitForTimeout(500);
    ok(await h.evaluate(() => {
      const d = document.getElementById('nav-drawer');
      return d.hidden || d.getBoundingClientRect().height < 50;
    }), 'Escape schließt es wieder');
  }
  await h.schliessen();
  await p.schliessen();
}
