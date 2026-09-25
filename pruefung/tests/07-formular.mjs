/* Das Kontaktformular.

   Ohne JavaScript postet es ganz normal an /kontakt.php. Mit
   JavaScript prüft es die Eingaben selbst und schickt im Hintergrund.
   Beides muss funktionieren - und im Fehlerfall müssen Telefon und
   E-Mail dastehen, damit niemand ohne Weg bleibt. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Kontaktformular';

export default async function ({ ort, browser, ok }) {
  const p = await seite(browser, ok);
  await p.goto(ort + '/index.php');
  await p.waitForTimeout(600);
  await p.evaluate(() => document.getElementById('kontakt').scrollIntoView());
  await p.waitForTimeout(500);

  const bau = await p.evaluate(() => {
    const f = document.getElementById('kontaktformular');
    const feld = (id) => {
      const e = document.getElementById(id);
      if (!e) return null;
      const beschriftet = !!document.querySelector(`label[for="${id}"]`) ||
                          !!e.closest('label') || !!e.getAttribute('aria-label');
      return { da: true, pflicht: e.required, beschriftet, typ: e.type };
    };
    return {
      ziel: f.getAttribute('action'), methode: f.getAttribute('method'),
      vorname: feld('vorname'), nachname: feld('nachname'), email: feld('email'),
      unternehmen: feld('unternehmen'), telefon: feld('telefon'),
      nachricht: feld('nachricht'), datenschutz: feld('datenschutz'),
      honigtopf: (() => { const h = document.getElementById('website');
        if (!h) return null;
        const r = h.getBoundingClientRect();
        return {
          /* Für Menschen unsichtbar heisst hier: aus dem Bild geschoben
             oder auf Nullgröße. Nicht display:none - dann füllten Bots
             ihn nicht mehr aus, und die Falle liefe leer. */
          versteckt: r.right < 0 || r.left > innerWidth || r.width <= 1 || r.height <= 1,
          ausTab: h.tabIndex === -1,
          fuerVorleser: !!h.closest('[aria-hidden="true"]'),
        }; })(),
      datenschutzVerweis: !!document.querySelector('#kontakt a[href*="datenschutz"]'),
    };
  });
  /* Absolut, nicht relativ: Die Hülle der Seite verweist seit dem Umbau
     durchgehend ab der Wurzel, damit die Fehlerseite unter jedem Pfad
     funktioniert. Für das Formular gilt dasselbe. */
  ok(bau.ziel === '/kontakt.php' && bau.methode === 'post',
     'das Formular postet an /kontakt.php', `${bau.methode} ${bau.ziel}`);
  for (const n of ['vorname', 'nachname', 'email', 'nachricht', 'datenschutz']) {
    ok(bau[n] && bau[n].da && bau[n].beschriftet && bau[n].pflicht,
       `${n.padEnd(12)} vorhanden, beschriftet, Pflichtfeld`);
  }
  for (const n of ['unternehmen', 'telefon']) {
    ok(bau[n] && bau[n].da && bau[n].beschriftet && !bau[n].pflicht,
       `${n.padEnd(12)} vorhanden, beschriftet, freiwillig`);
  }
  ok(bau.honigtopf && bau.honigtopf.versteckt, 'der Honigtopf gegen Spam ist unsichtbar');
  ok(bau.honigtopf && bau.honigtopf.ausTab && bau.honigtopf.fuerVorleser,
     'und weder mit der Tabtaste noch für Vorleseprogramme erreichbar');
  ok(bau.datenschutzVerweis, 'die Einwilligung verweist auf die Datenschutzerklärung');

  /* --- Leer abschicken: es muss meckern, nicht senden --- */
  let gesendet = 0;
  p.on('request', (r) => { if (r.url().includes('kontakt.php')) gesendet++; });
  await p.click('#kontaktformular button[type="submit"]');
  await p.waitForTimeout(600);
  const leer = await p.evaluate(() => ({
    meldungen: [...document.querySelectorAll('[id^="err-"]')]
      .filter((e) => e.textContent.trim().length > 0).length,
    fokus: document.activeElement.id,
  }));
  ok(leer.meldungen >= 3, 'leer abgeschickt: die Fehler stehen an den Feldern',
     `${leer.meldungen} Meldungen`);
  ok(gesendet === 0, 'und nichts ging raus');
  ok(leer.fokus === 'vorname', 'der Fokus springt ins erste fehlerhafte Feld', leer.fokus);

  /* --- Unsinnige E-Mail --- */
  await p.fill('#vorname', 'Max');
  await p.fill('#nachname', 'Muster');
  await p.fill('#email', 'keine-adresse');
  await p.fill('#nachricht', 'Wir bräuchten Technik für eine Abendveranstaltung.');
  await p.check('#datenschutz');
  await p.click('#kontaktformular button[type="submit"]');
  await p.waitForTimeout(600);
  ok(await p.evaluate(() => document.getElementById('err-email').textContent.trim().length > 0),
     'eine unsinnige E-Mail-Adresse wird beanstandet');
  ok(gesendet === 0, 'auch dann geht nichts raus');

  /* --- Sauber ausgefüllt, Server antwortet mit Fehler --- */
  await p.route('**/kontakt.php', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false}' }));
  await p.fill('#email', 'max@example.org');
  await p.click('#kontaktformular button[type="submit"]');
  await p.waitForTimeout(900);
  const schief = await p.evaluate(() => {
    const s = document.getElementById('form-status');
    return { text: s.textContent, telefon: !!s.querySelector('a[href^="tel:"]'),
             mail: !!s.querySelector('a[href^="mailto:"]') };
  });
  ok(schief.telefon && schief.mail,
     'geht es schief, stehen Telefon und E-Mail da', schief.text.slice(0, 60).replace(/\s+/g, ' '));

  /* --- Und wenn es klappt --- */
  await p.unroute('**/kontakt.php');
  await p.route('**/kontakt.php', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await p.click('#kontaktformular button[type="submit"]');
  await p.waitForTimeout(900);
  const gut = await p.evaluate(() => ({
    text: document.getElementById('form-status').textContent,
    vorname: document.getElementById('vorname').value,
    knopf: document.querySelector('#kontaktformular button[type="submit"]').hasAttribute('data-loading'),
  }));
  ok(/Danke/i.test(gut.text), 'bei Erfolg kommt eine Bestätigung', gut.text.slice(0, 50).replace(/\s+/g, ' '));
  ok(gut.vorname === '', 'das Formular ist danach geleert');
  ok(!gut.knopf, 'der Knopf ist wieder bedienbar');
  await p.schliessen();

  /* --- Ohne JavaScript: die Pflichtfelder hält der Browser selbst --- */
  const q = await seite(browser, ok, { javaScriptEnabled: false });
  await q.goto(ort + '/index.php', { waitUntil: 'networkidle' });
  const roh = await q.evaluate(() => {
    const f = document.getElementById('kontaktformular');
    return { ziel: f.getAttribute('action'),
             pflicht: f.querySelectorAll('[required]').length,
             knopf: !!f.querySelector('button[type="submit"]') };
  });
  ok(roh.ziel === '/kontakt.php' && roh.knopf && roh.pflicht >= 4,
     'ohne JavaScript bleibt es ein normales Formular', `${roh.pflicht} Pflichtfelder`);
  await q.schliessen();
}
