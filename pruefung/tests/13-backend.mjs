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
import { seite, SEITE, WURZEL, phpBefehl } from '../hilfe.mjs';
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, cpSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

    /* Nach dem Laden muessen die Namen noch stehen, wo sie standen.

       Hier sass der schlimmste Fehler dieses Projekts: Beim Laden zaehlt
       jede Liste ihre Reihen neu durch, und eine innere Liste ersetzte
       dabei "die erste Zahl im Namen" - das war aber die Nummer des
       Projekts, nicht die des Bildes. Jede Bilderliste schrieb also die
       Projektnummer um. Sichtbar war davon nichts; erst beim Speichern
       landeten alle Projekte auf den Plaetzen 0 bis 2 und ueberschrieben
       sich gegenseitig. Zehn Projekte wurden zu drei halben. */
    await p.goto(ort + '/admin/abschnitt.php?a=referenzen');
    const pfade = await p.evaluate(() => {
      const aussen = document.querySelector('[data-liste][data-tiefe="0"]');
      const reihen = [...aussen.querySelector('[data-reihen]').children]
        .filter((k) => k.hasAttribute('data-reihe'));
      const falsch = [];
      let geprueft = 0;
      reihen.forEach((reihe, nr) => {
        reihe.querySelectorAll('[name]').forEach((f) => {
          geprueft++;
          if (f.name.lastIndexOf('d[projekte][' + nr + '][', 0) !== 0) falsch.push(f.name);
        });
      });
      return { geprueft, falsch, reihen: reihen.length };
    });
    ok(pfade.falsch.length === 0,
       'jedes Feld traegt nach dem Laden noch die Nummer seines Projekts',
       pfade.falsch.length ? `${pfade.falsch.length} verrutscht, z.B. ${pfade.falsch[0]}`
                           : `${pfade.geprueft} Namen in ${pfade.reihen} Projekten`);

    /* Und der Beweis am Ergebnis: einmal speichern, ohne etwas zu
       aendern, darf die Inhaltsdatei nicht anfassen. */
    const vorSpeichern = readFileSync(INHALT, 'utf8');
    await p.goto(ort + '/admin/abschnitt.php?a=referenzen');
    await p.click('#formular button[type=submit]');
    await p.waitForTimeout(600);
    ok(/gespeichert/.test(await p.textContent('body')),
       'ein Speichern ohne Aenderung wird bestaetigt');

    const nachSpeichern = readFileSync(INHALT, 'utf8');
    const za = JSON.parse(vorSpeichern), zb = JSON.parse(nachSpeichern);
    const zaehl = (d) => d.referenzen.projekte.map(
      (x) => [x.bilder?.length || 0, x.worum?.length || 0, x.unser?.length || 0].join('/'));
    ok(JSON.stringify(zaehl(za)) === JSON.stringify(zaehl(zb)),
       'und laesst jedem Projekt seine Bilder und Absaetze',
       zaehl(zb).join(' '));
    /* Und kein Text darf das Projekt gewechselt haben. Verglichen wird
       ohne Ruecksicht auf Leerraum: Einzeilige Felder laufen beim Speichern
       durch zeile_saeubern(), das mehrere Leerzeichen zu einem macht und
       ein geschuetztes Leerzeichen zu einem gewoehnlichen. Das ist
       gewollt und waere hier nur ein falscher Alarm. */
    const ohneLeerraum = (x) => JSON.stringify(x).replace(/\s+/g, ' ');
    ok(ohneLeerraum(za.referenzen) === ohneLeerraum(zb.referenzen),
       'und keinem Projekt den Text eines anderen',
       `${JSON.stringify(zb.referenzen).length} Zeichen`);

    /* Dieselbe Frage fuer alle neun Abschnitte, ohne Browser: Was in der
       Inhaltsdatei steht, muss das Schema auch kennen - sonst loescht das
       erste Speichern des Abschnitts es lautlos. So verschwanden die
       strukturierten Daten meta.organisation. */
    const befund = JSON.parse(
      execFileSync(phpBefehl(), [join(WURZEL, 'pruefung/festpunkt.php')],
                   { encoding: 'utf8' }));
    for (const [abschnitt, b] of Object.entries(befund)) {
      ok(b.festpunkt,
         `Speichern ohne Aenderung laesst "${abschnitt}" unberuehrt`,
         b.festpunkt ? '' : `verliert ${b.verloren.join(', ') || '-'}`);
    }

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
    /* Geprüft wird auf die Kopf- und Fußzeile der Seite, nicht auf jedes
       <header>: Das Impressum hat seit dem Design-Durchgang einen eigenen
       <header class="legal__kopf"> im Inhalt, und der gehört dorthin. */
    ok(!recht.includes('class="masthead"') && !recht.includes('class="footer"'),
       'und zwar nur der Inhalt, nicht Kopf- und Fußzeile der Seite');

    await p.fill('#html', recht + '\n<script>alert(1)</script>');
    await p.click('#formular button[type=submit], button[type=submit]'); await p.waitForTimeout(600);
    ok(/script.*Element|dürfen nichts nachladen/.test(await p.textContent('body')),
       'ein <script> im Rechtstext wird abgewiesen');
    ok(!readFileSync(join(SEITE, 'impressum.php'), 'utf8').includes('alert(1)'),
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
