/* Das Backend unter /admin.

   Geprüft wird der ganze Weg, den ein Mensch geht: einrichten, anmelden,
   einen Text ändern, ihn auf der Website wiederfinden, zurückholen, ein
   Foto hochladen, es löschen.

   Dazu die drei Riegel, auf die es ankommt: kein Zugang ohne Anmeldung,
   kein Formular ohne Merkmal, kein Löschen eines Bildes, das noch auf der
   Seite steht.

   Der Lauf verändert echte Dateien. Alles, was er anfasst, wird vorher
   weggelegt und am Ende zurückgestellt - sonst stünde nach der Prüfung
   ein Prüfpasswort auf der Seite. */
import { seite, SEITE, WURZEL } from '../hilfe.mjs';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const NAME = 'Backend';

const PASSWORT   = 'pruefung-nova-2026-xyz';
const INHALT     = join(SEITE, 'inhalt/inhalt.json');
const ZUGANG     = join(SEITE, 'inhalt/zugang.php');
const SICHERUNG  = join(SEITE, 'inhalt/sicherungen');
const ORIGINALE  = join(SEITE, 'inhalt/originale');
const IMG        = join(SEITE, 'assets/img');
const VERZEICHNIS= join(IMG, 'bilder.json');

export default async function ({ ort, browser, ok }) {
  /* --- Zustand sichern --- */
  const vorher = {
    inhalt: readFileSync(INHALT, 'utf8'),
    verzeichnis: readFileSync(VERZEICHNIS, 'utf8'),
    zugang: existsSync(ZUGANG) ? readFileSync(ZUGANG, 'utf8') : null,
    sicherungen: existsSync(SICHERUNG),
  };
  if (existsSync(ZUGANG)) rmSync(ZUGANG);

  const p = await seite(browser, ok);
  p.on('dialog', (d) => d.accept());

  try {
    /* --- Ohne Anmeldung kommt niemand hinein --- */
    for (const pfad of ['/admin/', '/admin/abschnitt.php?a=hero', '/admin/mediathek.php',
                        '/admin/rechtsseiten.php?d=impressum', '/admin/sicherungen.php']) {
      await p.goto(ort + pfad);
      const t = await p.textContent('body');
      ok(/Passwort/.test(t) && !/Willkommen zurück/.test(t),
         `ohne Anmeldung gesperrt: ${pfad}`);
    }

    /* --- Ersteinrichtung --- */
    await p.goto(ort + '/admin/');
    ok(/Verwaltung einrichten/.test(await p.textContent('body')),
       'ohne Zugangsdatei wird ein Passwort verlangt');

    await p.fill('#passwort', 'zukurz'); await p.fill('#nochmal', 'zukurz');
    await p.click('button[type=submit]'); await p.waitForTimeout(300);
    ok(/mindestens zwölf/.test(await p.textContent('body')),
       'ein zu kurzes Passwort wird abgelehnt');

    await p.fill('#passwort', PASSWORT); await p.fill('#nochmal', PASSWORT + 'x');
    await p.click('button[type=submit]'); await p.waitForTimeout(300);
    ok(/stimmen nicht überein/.test(await p.textContent('body')),
       'zwei verschiedene Eingaben werden abgelehnt');

    await p.fill('#passwort', PASSWORT); await p.fill('#nochmal', PASSWORT);
    await p.click('button[type=submit]'); await p.waitForTimeout(500);
    ok(/Willkommen zurück/.test(await p.textContent('body')), 'Passwort gesetzt, Übersicht da');
    ok(existsSync(ZUGANG), 'die Zugangsdatei ist entstanden');
    ok(!/[\s'"]\s*zugang/i.test('') && !readFileSync(ZUGANG, 'utf8').includes(PASSWORT),
       'und das Passwort steht nicht im Klartext darin');

    /* --- Jeder Abschnitt lässt sich öffnen --- */
    const kacheln = await p.evaluate(() =>
      [...document.querySelectorAll('a.kachel[href^="abschnitt.php"]')]
        .map((a) => a.getAttribute('href')));
    ok(kacheln.length >= 8, 'die Übersicht zeigt alle Abschnitte', `${kacheln.length} Kacheln`);

    for (const h of kacheln) {
      await p.goto(ort + '/admin/' + h);
      const da = await p.evaluate(() => ({
        felder: document.querySelectorAll('#formular input, #formular textarea, #formular select').length,
        fehler: /Fatal error|Warning:|Notice:/.test(document.body.textContent),
      }));
      ok(da.felder > 1 && !da.fehler, `Abschnitt öffnet: ${h.replace('abschnitt.php?a=', '')}`,
         `${da.felder} Felder`);
    }

    /* --- Verschachtelte Listen: Projekte mit ihren Bildern --- */
    await p.goto(ort + '/admin/abschnitt.php?a=referenzen');
    const listen = await p.evaluate(() => {
      const aussen = document.querySelector('[data-liste][data-tiefe="0"]');
      const reihen = [...aussen.querySelector('[data-reihen]').children]
        .filter((k) => k.hasAttribute('data-reihe'));
      return {
        projekte: reihen.length,
        innen: reihen[0].querySelectorAll('[data-liste]').length,
        namen: [...reihen[0].querySelectorAll('[name]')].map((f) => f.name).slice(0, 3),
      };
    });
    ok(listen.projekte >= 5, 'die Projekte stehen als Liste', `${listen.projekte} Stück`);
    ok(listen.innen >= 3, 'und tragen eigene Listen für Bilder und Absätze', `${listen.innen}`);
    ok(listen.namen.every((n) => /^d\[projekte\]\[\d+\]\[/.test(n)),
       'die Feldnamen bilden den Pfad ab', listen.namen[0]);

    /* Eine Reihe hinzufügen und die Nummerierung prüfen - der Punkt, an
       dem eine Liste in einer Liste sonst die Nummern durcheinanderbringt. */
    const nachher = await p.evaluate(() => {
      const aussen = document.querySelector('[data-liste][data-tiefe="0"]');
      aussen.querySelector(':scope > .liste__zufuegen > [data-zufuegen]').click();
      const reihen = [...aussen.querySelector('[data-reihen]').children]
        .filter((k) => k.hasAttribute('data-reihe'));
      const letzte = reihen[reihen.length - 1];
      return {
        anzahl: reihen.length,
        namen: [...letzte.querySelectorAll('[name]')].map((f) => f.name),
      };
    });
    ok(nachher.anzahl === listen.projekte + 1, 'eine neue Reihe lässt sich hinzufügen');
    ok(nachher.namen.every((n) => !n.includes('__I')),
       'und bekommt echte Nummern statt des Platzhalters',
       nachher.namen.find((n) => n.includes('__I')) || 'alle ersetzt');

    /* --- Speichern und auf der Website wiederfinden --- */
    const MARKE = 'PRUEFMARKE-' + Date.now();
    await p.goto(ort + '/admin/abschnitt.php?a=hero');
    await p.fill('input[name="d[zeilen][0]"]', MARKE);
    await p.click('#formular button[type=submit]'); await p.waitForTimeout(600);
    ok(/gespeichert/.test(await p.textContent('body')), 'Speichern bestätigt');

    const seiteText = await (await fetch(ort + '/index.php')).text();
    ok(seiteText.includes(MARKE), 'die Änderung steht sofort auf der Website');

    /* --- Sicherung und Zurückholen --- */
    await p.goto(ort + '/admin/sicherungen.php');
    const hatSicherung = await p.evaluate(() =>
      !!document.querySelector('button, form') &&
      /\d{2}\.\d{2}\.\d{4}/.test(document.body.textContent));
    ok(hatSicherung, 'vor dem Speichern wurde gesichert');

    await p.click('button:has-text("Zurückholen")'); await p.waitForTimeout(700);
    const zurueck = await (await fetch(ort + '/index.php')).text();
    ok(!zurueck.includes(MARKE), 'Zurückholen stellt den alten Stand wieder her');

    /* --- Fremde Formulare werden abgewiesen --- */
    for (const ziel of ['/admin/mediathek.php', '/admin/abschnitt.php?a=hero',
                        '/admin/sicherungen.php']) {
      const status = await p.evaluate(async ([o, z]) => {
        const f = new FormData(); f.append('was', 'loeschen'); f.append('name', 'live');
        return (await fetch(o + z, { method: 'POST', body: f })).status;
      }, [ort, ziel]);
      ok(status === 400, `ohne Merkmal abgewiesen: ${ziel}`, String(status));
    }

    /* --- Mediathek: HEIC, Upload, Staffel, Löschschutz --- */
    const tmp = join(WURZEL, 'pruefung', '.tmp-backend');
    mkdirSync(tmp, { recursive: true });

    /* HEIC vom iPhone: richtige Signatur, kein lesbares Bild. */
    const heic = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic'), Buffer.alloc(512)]);
    writeFileSync(join(tmp, 'kamera.heic'), heic);

    await p.goto(ort + '/admin/mediathek.php');
    await p.setInputFiles('#dateien', join(tmp, 'kamera.heic'));
    await p.click('button:has-text("Hochladen und umwandeln")'); await p.waitForTimeout(1200);
    const heicText = await p.textContent('body');
    ok(/HEIC/.test(heicText) && /Kompatibilität/.test(heicText),
       'HEIC wird erkannt und mit einer Anleitung abgelehnt');

    /* Ein echtes Foto - mit falscher Endung, um zu prüfen, dass der
       Inhalt zählt und nicht der Dateiname. */
    const quelle = join(ORIGINALE, 'rainbow-2.jpg');
    if (existsSync(quelle)) {
      cpSync(quelle, join(tmp, 'tarnung.png'));
      await p.goto(ort + '/admin/mediathek.php');
      await p.setInputFiles('#dateien', join(tmp, 'tarnung.png'));
      await p.fill('#name', 'Prüf Bild!! 2026');
      await p.click('button:has-text("Hochladen und umwandeln")'); await p.waitForTimeout(12000);
      ok(/hochgeladen und in WebP umgewandelt/.test(await p.textContent('body')),
         'ein Foto mit falscher Endung wird am Inhalt erkannt und angenommen');

      const name = 'pruef-bild-2026';
      ok(existsSync(join(IMG, name + '.jpg')), 'der Name wurde gesäubert', name);
      const breiten = [640, 960, 1280, 1920, 2560]
        .filter((w) => existsSync(join(IMG, `${name}-${w}.webp`)));
      ok(breiten.length === 5, 'alle fünf WebP-Breiten sind entstanden', breiten.join(', '));
      const klein = statSync(join(IMG, `${name}-640.webp`)).size;
      const gross = statSync(join(IMG, `${name}-2560.webp`)).size;
      ok(gross > klein * 2, 'und sie unterscheiden sich wirklich in der Größe',
         `${Math.round(klein / 1024)} kB / ${Math.round(gross / 1024)} kB`);
      ok(existsSync(join(ORIGINALE, name + '.jpg')),
         'das Original wird aufbewahrt, damit sich alles neu erzeugen lässt');

      await p.goto(ort + '/admin/abschnitt.php?a=hero');
      const inAuswahl = await p.evaluate((n) =>
        [...document.querySelectorAll('select[data-bildwahl] option')]
          .some((o) => o.value === n), name);
      ok(inAuswahl, 'das neue Bild steht sofort in der Auswahl der Abschnitte');

      /* Löschschutz: ein benutztes Bild darf nicht einfach verschwinden. */
      await p.goto(ort + '/admin/mediathek.php');
      const geschuetzt = await p.evaluate(async ([o, n]) => {
        const m = document.querySelector('input[name=merkmal]').value;
        const f = new FormData();
        f.append('merkmal', m); f.append('was', 'loeschen'); f.append('name', n);
        return (await fetch(o + '/admin/mediathek.php', { method: 'POST', body: f })).text();
      }, [ort, 'live']);
      ok(/wird noch benutzt/.test(geschuetzt),
         'ein Bild, das auf der Seite steht, lässt sich nicht löschen');

      const geloescht = await p.evaluate(async ([o, n]) => {
        const m = document.querySelector('input[name=merkmal]').value;
        const f = new FormData();
        f.append('merkmal', m); f.append('was', 'loeschen'); f.append('name', n);
        return (await fetch(o + '/admin/mediathek.php', { method: 'POST', body: f })).text();
      }, [ort, name]);
      ok(/gelöscht/.test(geloescht), 'ein unbenutztes lässt sich löschen');
      ok(!existsSync(join(IMG, `${name}-2560.webp`)) && !existsSync(join(ORIGINALE, name + '.jpg')),
         'und alle seine Fassungen samt Original verschwinden mit');
    } else {
      ok.hinweis('kein Original zum Hochladen gefunden - Upload-Prüfung übersprungen');
    }

    /* --- Rechtsseiten --- */
    await p.goto(ort + '/admin/rechtsseiten.php?d=impressum');
    const recht = await p.inputValue('#html');
    ok(recht.includes('<') && recht.length > 200, 'die Rechtsseite steht als HTML im Feld',
       `${recht.length} Zeichen`);
    ok(!recht.includes('<header') && !recht.includes('<footer'),
       'und zwar nur der Inhalt, nicht Kopf- und Fußzeile');

    await p.fill('#html', recht + '\n<script>alert(1)</script>');
    await p.click('#formular button[type=submit], button[type=submit]'); await p.waitForTimeout(600);
    ok(/script.*Element|dürfen nichts nachladen/.test(await p.textContent('body')),
       'ein <script> im Rechtstext wird abgewiesen');
    ok(!readFileSync(join(SEITE, 'impressum.html'), 'utf8').includes('alert(1)'),
       'und landet nicht in der Datei');

    /* --- Abmelden --- */
    await p.goto(ort + '/admin/abmelden.php'); await p.waitForTimeout(300);
    await p.goto(ort + '/admin/mediathek.php');
    ok(/Passwort/.test(await p.textContent('body')), 'nach dem Abmelden ist wieder zu');

    rmSync(tmp, { recursive: true, force: true });

  } finally {
    /* --- Zustand zurückstellen --- */
    writeFileSync(INHALT, vorher.inhalt);
    writeFileSync(VERZEICHNIS, vorher.verzeichnis);
    if (vorher.zugang !== null) writeFileSync(ZUGANG, vorher.zugang);
    else if (existsSync(ZUGANG)) rmSync(ZUGANG);
    if (!vorher.sicherungen && existsSync(SICHERUNG)) rmSync(SICHERUNG, { recursive: true, force: true });
    await p.schliessen();
  }
}
