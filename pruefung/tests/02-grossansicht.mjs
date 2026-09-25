/* Die Großansicht der Projektbilder.

   Das <dialog> bringt Escape, Fokusfalle und die Rückkehr des Fokus
   selbst mit. Geprüft wird deshalb vor allem das Selbstgebaute:
   Blättern, Zähler, Bildnachweis, der Klick neben das Bild - und dass
   ein einzelnes Bild weder Pfeile noch Zähler bekommt. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Großansicht';

export default async function ({ ort, browser, ok }) {
  const p = await seite(browser, ok);
  await p.goto(ort + '/index.php');
  await p.waitForTimeout(800);

  const vorher = await p.evaluate(() => ({
    schalter: document.querySelectorAll('.ref__bild[data-lupe-auf]').length,
    offen: document.querySelectorAll('.ref__bild--offen').length,
    projekte: document.querySelectorAll('.refs .ref').length,
    listenVersteckt: [...document.querySelectorAll('.ref__bilder')].every((l) => l.hidden),
    dialogZu: !document.querySelector('[data-lupe]').open,
  }));
  ok(vorher.schalter + vorher.offen === vorher.projekte,
     'jedes Projekt hat einen Bildschalter oder den roten Platzhalter',
     `${vorher.schalter} + ${vorher.offen} = ${vorher.projekte}`);
  ok(vorher.listenVersteckt, 'die Verweislisten sind ausgeblendet, sobald JavaScript läuft');
  ok(vorher.dialogZu, 'die Großansicht ist zu Beginn geschlossen');

  /* Jedes Projekt einmal durchblättern. */
  const anzahl = vorher.projekte;
  let gesehen = 0, mitNachweis = 0;
  for (let i = 0; i < anzahl; i++) {
    const ref = (await p.$$('.refs .ref'))[i];
    const schalter = await ref.$('.ref__bild[data-lupe-auf]');
    if (!schalter) continue;
    const titel = await ref.$eval('.ref__titel', (e) => e.textContent.trim());
    const bilder = await ref.$$eval('.ref__bilder li a', (a) => a.length);
    await ref.scrollIntoViewIfNeeded();
    await p.waitForTimeout(350);
    await schalter.click();
    await p.waitForTimeout(400);

    for (let k = 0; k < bilder; k++) {
      if (k) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(350); }
      const z = await p.evaluate(() => {
        const d = document.querySelector('[data-lupe]');
        const b = d.querySelector('[data-lupe-bild]');
        const n = d.querySelector('[data-lupe-nachweis]');
        return {
          offen: d.open,
          datei: (b.getAttribute('src') || '').split('/').pop(),
          geladen: b.complete && b.naturalWidth > 0,
          alt: (b.getAttribute('alt') || '').length,
          titel: d.querySelector('[data-lupe-titel]').textContent.trim(),
          zaehler: d.querySelector('[data-lupe-zaehler]').textContent.trim(),
          pfeileVersteckt: [...d.querySelectorAll('[data-lupe-schritt]')].every((x) => x.hidden),
          nachweis: n.hidden ? '' : n.textContent.trim(),
          passtInsFenster: b.getBoundingClientRect().height <= window.innerHeight + 1,
        };
      });
      gesehen++;
      if (z.nachweis) mitNachweis++;
      ok(z.offen && z.geladen && z.alt > 10 && z.passtInsFenster,
         `${titel.slice(0, 26).padEnd(27)} ${(z.zaehler || '1 / 1').padEnd(6)} ${z.datei}`,
         z.passtInsFenster ? '' : 'ragt aus dem Fenster');
      ok(z.titel === titel, `${titel.slice(0, 26).padEnd(27)} Projektname steht darunter`, z.titel);
      if (bilder === 1) {
        ok(z.pfeileVersteckt && z.zaehler === '',
           `${titel.slice(0, 26).padEnd(27)} ein Bild: weder Pfeile noch Zähler`);
      } else {
        ok(!z.pfeileVersteckt && z.zaehler === `${k + 1} / ${bilder}`,
           `${titel.slice(0, 26).padEnd(27)} Pfeile und Zähler stimmen`, z.zaehler);
      }
    }

    /* Zurück an den Anfang: nach einer vollen Runde muss wieder das
       erste Bild stehen. */
    if (bilder > 1) {
      await p.keyboard.press('ArrowRight'); await p.waitForTimeout(350);
      const rum = await p.evaluate(() =>
        document.querySelector('[data-lupe-zaehler]').textContent.trim());
      ok(rum === `1 / ${bilder}`, `${titel.slice(0, 26).padEnd(27)} blättert im Kreis`, rum);
    }

    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    ok(await p.evaluate(() => !document.querySelector('[data-lupe]').open),
       `${titel.slice(0, 26).padEnd(27)} Escape schließt`);
  }
  ok(gesehen > 0, 'es wurden Bilder gezeigt', `${gesehen} insgesamt`);
  ok(mitNachweis > 0, 'mindestens ein Bild trägt seinen Fotonachweis', `${mitNachweis} Stück`);

  /* Der Klick neben das Bild schließt ebenfalls. */
  const ref = await p.$('.refs .ref .ref__bild[data-lupe-auf]');
  await ref.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await ref.click(); await p.waitForTimeout(400);
  await p.mouse.click(8, 8); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.querySelector('[data-lupe]').open),
     'ein Klick neben das Bild schließt auch');

  /* Ohne JavaScript bleibt die Liste ein normaler Weg zu den Bildern. */
  const q = await seite(browser, ok, { javaScriptEnabled: false });
  await q.goto(ort + '/index.php', { waitUntil: 'networkidle' });
  const roh = await q.evaluate(() => {
    const l = document.querySelector('.ref__bilder');
    return { sichtbar: !l.hidden, verweise: l.querySelectorAll('a[href]').length,
             nachweis: /Foto:/.test(document.body.textContent) };
  });
  ok(roh.sichtbar && roh.verweise > 0,
     'ohne JavaScript sind die Galerien sichtbare Verweislisten', `${roh.verweise} Verweise`);
  ok(roh.nachweis, 'und der Fotonachweis steht im Quelltext');
  await q.schliessen();
  await p.schliessen();
}
