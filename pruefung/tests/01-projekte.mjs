/* Die Referenzprojekte: Bilder, Galerien, Gewerke.

   Bewusst ohne feste Zahlen. Projekte kommen dazu, Fotos werden
   nachgereicht - geprüft wird die Regel, nicht der Stand:
   jedes Projekt hat ein Foto oder den roten Platzhalter, jedes Foto
   lädt erst beim Heranscrollen, jede Galerie zeigt höchstens drei. */
import { seite } from '../hilfe.mjs';
export const NAME = 'Projekte und Bilder';

export default async function ({ ort, browser, ok }) {
  const p = await seite(browser, ok);
  const geholt = [];
  p.on('request', (r) => {
    const d = r.url().split('/').pop();
    if (/\.(jpe?g|png|webp|svg)$/i.test(d)) geholt.push(d);
  });
  await p.goto(ort + '/index.php');
  await p.waitForTimeout(900);

  const stand = await p.evaluate(() => {
    const refs = [...document.querySelectorAll('.refs .ref')];
    return {
      projekte: refs.length,
      offen: document.querySelectorAll('.ref__bild--offen').length,
      liste: refs.map((r) => ({
        titel: r.querySelector('.ref__titel')?.textContent.trim(),
        kicker: r.querySelector('.eyebrow')?.textContent.trim(),
        foto: r.querySelector('.ref__foto')?.getAttribute('src'),
        lazy: r.querySelector('.ref__foto')?.getAttribute('loading'),
        bilder: r.querySelectorAll('.ref__bilder li a').length,
        ohneBeschreibung: [...r.querySelectorAll('.ref__bilder li a')]
          .filter((a) => a.textContent.trim().length < 15).length,
        gewerkeTitel: r.querySelector('.gewerke dt')?.textContent.trim() || '',
        gewerke: r.querySelector('.gewerke dd')?.textContent.trim() || '',
        gewerkeOffen: r.querySelectorAll('.gewerke dd.offen').length,
        absaetze: r.querySelectorAll('.ref__text p:not(.eyebrow)').length,
      })),
    };
  });

  ok(stand.projekte >= 5, 'die Referenzen sind da', `${stand.projekte} Projekte`);

  for (const r of stand.liste) {
    const kurz = (r.titel || '(ohne Titel)').slice(0, 30).padEnd(31);
    ok(!!r.titel && !!r.kicker, `${kurz} Titel und Ort`, r.kicker);
    ok(!!r.foto || stand.offen > 0, `${kurz} Foto oder Platzhalter`,
       r.foto ? r.foto.split('/').pop() : 'Platzhalter');
    if (r.foto) {
      ok(r.lazy === 'lazy', `${kurz} lädt erst beim Heranscrollen`);
      ok(r.bilder >= 1 && r.bilder <= 3, `${kurz} ein bis drei Galeriebilder`, String(r.bilder));
      ok(r.ohneBeschreibung === 0, `${kurz} jedes Bild hat eine Beschreibung`);
    }
    /* Die Gewerke stehen als Definitionsliste - links das Wort, rechts
       die Leistungen im Fliesstext. Geprüft wird die Regel, nicht eine
       Zahl: Es muss ein benanntes Feld geben und darin etwas stehen. */
    ok(/gewerke/i.test(r.gewerkeTitel), `${kurz} Gewerke sind benannt`, r.gewerkeTitel);
    ok(r.gewerke.length > 3, `${kurz} Gewerke eingetragen`,
       r.gewerkeOffen ? 'noch offen (rot markiert)' : r.gewerke.slice(0, 40));
    ok(r.absaetze >= 2, `${kurz} Veranstaltung und Aufgabe getrennt`, `${r.absaetze} Absätze`);
  }

  /* Die Zahl der Fotos plus die der Platzhalter muss aufgehen - ein
     Projekt ohne beides wäre ein Loch im Raster. */
  const mitFoto = stand.liste.filter((r) => r.foto).length;
  ok(mitFoto + stand.offen === stand.projekte,
     'jedes Projekt hat ein Foto oder den roten Platzhalter',
     `${mitFoto} Fotos + ${stand.offen} offen = ${stand.projekte}`);

  /* --- Nachladen: das unterste Foto darf beim Aufruf noch fehlen ---
     Geprüft wird der Stamm des Dateinamens, nicht die genaue Datei:
     Jedes Bild liegt in mehreren Breiten vor (live-640.webp bis
     live-2560.webp), und welche davon der Browser wählt, hängt an
     Fenstergröße und Pixeldichte. Fest auf eine Datei zu prüfen hieße,
     die Prüfung an den Zufall der Testumgebung zu binden. */
  const stamm = (d) => d.replace(/-\d+\.(webp|jpe?g)$/i, '').replace(/\.(webp|jpe?g)$/i, '');
  const wurdeGeholt = (name) => geholt.some((d) => stamm(d) === name);

  const untenPfad = stand.liste.filter((r) => r.foto).pop()?.foto.split('/').pop();
  const unten = untenPfad ? stamm(untenPfad) : null;
  const kopfbild = await p.evaluate(() =>
    document.querySelector('.hero__media')?.getAttribute('src')?.split('/').pop() || '');

  if (unten) {
    ok(!wurdeGeholt(unten), 'das unterste Projektfoto wird nicht mitgeladen', unten);
    ok(wurdeGeholt(stamm(kopfbild)),
       'das Kopfbild dagegen schon - es ist das Erste, was man sieht', stamm(kopfbild));

    await p.evaluate(() => [...document.querySelectorAll('.ref__foto')].pop().scrollIntoView());
    await p.waitForTimeout(1500);
    ok(wurdeGeholt(unten), 'beim Heranscrollen kommt es nach');
    const fertig = await p.evaluate(() => {
      const i = [...document.querySelectorAll('.ref__foto')].pop();
      return { da: i.complete && i.naturalWidth > 0, breite: i.naturalWidth };
    });
    ok(fertig.da && fertig.breite > 100, 'und steht dann im Rahmen', `${fertig.breite} px`);
  }

  /* --- Die Bildstaffel: der Grund für den ganzen Umbau ---
     Jedes Foto muss in mehreren Breiten als WebP angeboten werden, und
     die größte muss reichen, um es auf einem Retina-Schirm ohne
     Hochrechnen zu zeigen. Genau daran krankte die alte Fassung. */
  const staffel = await p.evaluate(() => [...document.querySelectorAll('.ref__media picture')]
    .map((b) => {
      const q = b.querySelector('source[type="image/webp"]');
      const breiten = (q?.getAttribute('srcset') || '').split(',')
        .map((t) => parseInt((t.trim().split(/\s+/)[1] || '').replace('w', ''), 10))
        .filter(Boolean);
      return { breiten, sizes: q?.getAttribute('sizes') || '' };
    }));
  ok(staffel.length > 0, 'die Projektbilder stehen in einem <picture>', `${staffel.length} Stück`);
  ok(staffel.every((b) => b.breiten.length >= 2),
     'jedes bietet mehrere Breiten an',
     `mindestens ${Math.min(...staffel.map((b) => b.breiten.length))}`);
  ok(staffel.every((b) => b.sizes.includes('px') || b.sizes.includes('vw')),
     'und sagt dem Browser, wie breit es gezeigt wird');
  const groesste = staffel.map((b) => Math.max(...b.breiten));
  ok(groesste.filter((g) => g >= 1920).length >= staffel.length - 3,
     'fast alle reichen bis mindestens 1920 px',
     `${groesste.filter((g) => g >= 1920).length} von ${staffel.length}`);

  /* --- Ohne JavaScript muss alles im Quelltext stehen --- */
  const q = await seite(browser, ok, { javaScriptEnabled: false });
  await q.goto(ort + '/index.php', { waitUntil: 'networkidle' });
  const ohne = await q.evaluate(() => ({
    projekte: document.querySelectorAll('.refs .ref').length,
    pfade: [...document.querySelectorAll('.ref__foto')]
      .map((i) => i.getAttribute('src')).filter((s) => s && s.startsWith('/assets/img/')).length,
    fotos: document.querySelectorAll('.ref__foto').length,
    listen: document.querySelectorAll('.ref__bilder li a').length,
  }));
  ok(ohne.projekte === stand.projekte, 'ohne JavaScript stehen alle Projekte da', String(ohne.projekte));
  ok(ohne.pfade === ohne.fotos, 'und alle Bildpfade im Quelltext', `${ohne.pfade} von ${ohne.fotos}`);
  ok(ohne.listen > 0, 'die Galerien sind dort normale Verweislisten', `${ohne.listen} Verweise`);
  await q.schliessen();
  await p.schliessen();
}
