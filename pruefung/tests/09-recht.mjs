/* Impressum, AGB, Datenschutzerklärung.

   Geprüft wird nicht der Wortlaut - der gehört den Juristen -, sondern
   dass die Pflichtangaben da sind, dass die Aussagen zum Verhalten der
   Seite mit dem Quelltext übereinstimmen und dass die AGB vollständig
   und in der richtigen Reihenfolge stehen. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seite, SEITE } from '../hilfe.mjs';
export const NAME = 'Rechtstexte';

export default async function ({ ort, browser, ok }) {
  /* --- Impressum --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/impressum.html'); await p.waitForTimeout(400);
    const t = await p.evaluate(() => document.querySelector('main').textContent.replace(/\s+/g, ' '));
    const pflicht = {
      'Firma': /NovaWorks GmbH/,
      'Anschrift': /\d{5}\s+\w/,
      'Telefon': /\+?49|0\d{3,5}[\s/-]?\d/,
      'E-Mail': /@nova-works\.de/,
      'Vertretung': /vertreten|Geschäftsführ/i,
      'Registereintrag': /HRB|Handelsregister/i,
      'Umsatzsteuer-ID': /USt|Umsatzsteuer/i,
    };
    for (const [was, muster] of Object.entries(pflicht)) {
      ok(muster.test(t), `Impressum: ${was} genannt`);
    }
    /* Kein Fehler, sondern eine Erinnerung: Ob eine Erklärung zur
       Verbraucherschlichtung nötig ist, hängt nach § 36 VSBG an der
       Mitarbeiterzahl. Das kann der Test nicht wissen - er sagt nur, ob
       eine dasteht. Der Verweis auf die EU-Streitbeilegungsplattform
       gehört nicht mehr hinein: die Plattform ist seit Juli 2025 zu. */
    ok.hinweis(/Streitbeilegung|Verbraucherschlicht|Schlichtungsstelle/i.test(t)
      ? 'Impressum: eine Erklärung zur Verbraucherschlichtung steht drin'
      : 'Impressum: keine Erklärung zur Verbraucherschlichtung - bei mehr als 10 '
        + 'Mitarbeitenden nach § 36 VSBG nötig, sonst freiwillig');
    ok(!/Nova Works GmbH/.test(t), 'Impressum: einheitliche Schreibweise NovaWorks GmbH');
    await p.schliessen();
  }

  /* --- AGB --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/agb.html'); await p.waitForTimeout(400);
    const a = await p.evaluate(() => {
      const kopf = [...document.querySelectorAll('.legal--agb h3')].map((h) => h.textContent.trim());
      const nummern = kopf.map((k) => Number((k.match(/§\s*(\d+)/) || [])[1])).filter((n) => n);
      return {
        kopf, nummern,
        uebersicht: [...document.querySelectorAll('.legal--agb a[href^="#teil-"]')].map((a) => ({
          ziel: a.getAttribute('href').slice(1),
          gibtEs: !!document.getElementById(a.getAttribute('href').slice(1)),
          spanne: (a.parentElement.textContent.match(/(\d+)\s*[–-]\s*(\d+)/) || []).slice(1).map(Number),
        })),
        ziele: [...document.querySelectorAll('.legal--agb h3[id]')].length,
        leer: kopf.filter((k, i) => {
          const h = document.querySelectorAll('.legal--agb h3')[i];
          let n = h.nextElementSibling, text = '';
          while (n && n.tagName !== 'H3') { text += n.textContent; n = n.nextElementSibling; }
          return text.trim().length < 40;
        }),
      };
    });
    ok(a.nummern.length >= 30, 'AGB: alle Paragraphen sind da', `${a.nummern.length} Stück`);
    ok(a.nummern.every((n, i) => n === i + 1),
       'AGB: durchnummeriert und in der Reihenfolge', `§1 bis §${a.nummern[a.nummern.length - 1]}`);
    ok(a.leer.length === 0, 'AGB: kein Paragraph ohne Text',
       a.leer.join(', ') || 'alle gefüllt');
    ok(a.ziele >= a.nummern.length, 'AGB: jeder Paragraph ist einzeln anspringbar',
       `${a.ziele} Sprungziele`);
    ok(a.uebersicht.length >= 5 && a.uebersicht.every((u) => u.gibtEs),
       'AGB: die Übersicht führt zu allen Teilen', `${a.uebersicht.length} Teile`);
    /* Die in der Übersicht genannten Spannen müssen lückenlos von §1 bis
       zum letzten Paragraphen reichen - sonst fehlt ein Teil oder eine
       Angabe stimmt nicht mehr. */
    const spannen = a.uebersicht.map((u) => u.spanne).filter((sp) => sp.length === 2);
    const lueckenlos = spannen.length === a.uebersicht.length &&
      spannen[0][0] === 1 &&
      spannen.every((sp, i) => i === 0 || sp[0] === spannen[i - 1][1] + 1) &&
      spannen[spannen.length - 1][1] === a.nummern[a.nummern.length - 1];
    ok(lueckenlos, 'AGB: die Spannen der Teile decken alle Paragraphen lückenlos ab',
       spannen.map((sp) => `§§${sp[0]}–${sp[1]}`).join(' '));

    /* Ein Sprung aus der Übersicht muss unter der Kopfzeile landen. */
    await p.click('.legal--agb a[href^="#"]');
    await p.waitForTimeout(700);
    const sprung = await p.evaluate(() => {
      const z = document.querySelector(decodeURIComponent(location.hash));
      const kopf = document.getElementById('masthead').getBoundingClientRect().bottom;
      return { oben: Math.round(z.getBoundingClientRect().top), kopf: Math.round(kopf) };
    });
    ok(sprung.oben >= sprung.kopf - 2 && sprung.oben < 260,
       'AGB: ein Sprung landet sichtbar unter der Kopfzeile',
       `Ziel bei ${sprung.oben} px, Kopfzeile endet bei ${sprung.kopf}`);
    await p.schliessen();
  }

  /* --- Datenschutzerklärung gegen den echten Quelltext --- */
  {
    const p = await seite(browser, ok);
    await p.goto(ort + '/datenschutz.html'); await p.waitForTimeout(400);
    const d = await p.evaluate(() => ({
      text: document.querySelector('main').textContent.replace(/\s+/g, ' '),
      offen: [...document.querySelectorAll('.offen--block')].length,
      abschnitte: [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim()),
    }));

    const js = await readFile(join(SEITE, 'assets/js/main.js'), 'utf8');
    const css = await readFile(join(SEITE, 'assets/css/style.css'), 'utf8');
    const html = await readFile(join(SEITE, 'index.html'), 'utf8');

    /* Keine Cookies, kein sessionStorage - und im localStorage genau
       ein Eintrag, der in der Erklärung beim Namen stehen muss. */
    ok(!/document\.cookie|sessionStorage/.test(js),
       'main.js fasst weder Cookies noch sessionStorage an');
    const speicher = [...new Set((js.match(/localStorage\.\w+\(\s*[A-Z_]+/g) || [])
      .map((x) => x.replace(/.*\(\s*/, '')))];
    ok(speicher.length <= 1, 'im localStorage steht höchstens ein Eintrag',
       speicher.join(', ') || 'keiner');
    if (speicher.length === 1) {
      const name = (js.match(/EINWILLIGUNG_SCHLUESSEL\s*=\s*'([^']+)'/) || [])[1];
      ok(!!name && d.text.includes(name), 'und sein Name steht in der Erklärung', String(name));
      ok(/localStorage/.test(d.text) && /TDDDG/.test(d.text),
         'mit Speicherort und Rechtsgrundlage');
    }
    ok(/setzt\s+keine\s+Cookies/.test(d.text), 'die Erklärung sagt: keine Cookies');

    /* Nichts von fremden Servern - weder im Quelltext noch im
       Stylesheet. schema.org und w3.org sind Namensräume, keine
       Verbindungen. */
    const fremde = [html, css].join('\n')
      .match(/https?:\/\/(?!nova-works\.de|www\.nova-works\.de|schema\.org|www\.w3\.org)[^"' )]+/g) || [];
    ok(fremde.length === 0, 'Seite und Stylesheet laden nichts von fremden Servern',
       fremde.slice(0, 3).join(' '));
    ok(/url\(['"]?\.\.\/fonts\//.test(css), 'die Schrift liegt lokal');

    /* Jedes Formularfeld muss aufgezählt sein. */
    for (const f of ['Vorname', 'Nachname', 'E-Mail', 'Unternehmen', 'Telefon', 'Nachricht']) {
      ok(d.text.includes(f), `das Formularfeld ${f} ist in der Erklärung genannt`);
    }
    ok(/Zusatzfeld|Honigtopf|Spam/i.test(d.text), 'der Spam-Schutz im Formular ist erwähnt');
    ok(d.abschnitte.length >= 5, 'die Erklärung ist gegliedert', `${d.abschnitte.length} Abschnitte`);
    ok.hinweis(d.offen
      ? `noch ${d.offen} rot markierte Lücke(n) - vor dem Livegang füllen`
      : 'keine offenen Lücken mehr');
    await p.schliessen();
  }
}
