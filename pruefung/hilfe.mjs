/* Gemeinsames Handwerkszeug für die Prüfungen.
   Kein npm, keine Abhängigkeiten im Repo: Playwright bringt die Umgebung
   mit, alles andere steht hier. */

import { spawn, execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WURZEL = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const SEITE = join(WURZEL, 'site');

/* --- Playwright finden ---------------------------------------------------
   Je nach Umgebung liegt es im Projekt oder global. Der Reihe nach
   probieren statt einen Pfad fest einzutragen - der stimmte schon
   einmal nicht mehr. */
export async function chromium() {
  const orte = [
    'playwright',
    '/opt/node22/lib/node_modules/playwright/index.mjs',
    '/usr/lib/node_modules/playwright/index.mjs',
    '/usr/local/lib/node_modules/playwright/index.mjs',
  ];
  for (const ort of orte) {
    try { return (await import(ort)).chromium; } catch (e) { /* weiter */ }
  }
  throw new Error(
    'Playwright nicht gefunden. Erwartet global oder unter einem der Pfade in hilfe.mjs.');
}

/* --- Server ---------------------------------------------------------------
   Seit dem Umbau auf das Backend ist die Startseite index.php - ein
   eigener Dateiserver in Node könnte sie nicht ausführen und lieferte
   den Quelltext aus. Deshalb übernimmt der eingebaute Server von PHP;
   der kann beides, PHP und statische Dateien.

   Gestartet wird auf Port 0 - das Betriebssystem sucht einen freien aus.
   Welcher es wurde, steht danach in der Ausgabe des Prozesses; darauf
   wartet warteAufOrt(). Feste Portnummern haben sich gerächt, sobald
   zwei Läufe gleichzeitig liefen.                                       */

function phpBefehl() {
  /* php in der PATH-Variable, sonst die üblichen Orte. Ein fest
     eingetragener Pfad stimmte hier schon einmal nicht mehr. */
  for (const ort of ['php', '/usr/bin/php', '/usr/local/bin/php']) {
    try {
      execFileSync(ort, ['-v'], { stdio: 'ignore' });
      return ort;
    } catch (e) { /* weiter */ }
  }
  throw new Error('PHP nicht gefunden. Die Seite braucht seit dem Umbau PHP.');
}

export function server(wurzel = SEITE) {
  const php = phpBefehl();

  return new Promise((fertig, schiefgegangen) => {
    /* -t setzt das Wurzelverzeichnis. Der Router davor fängt nichts ab -
       PHP liefert vorhandene Dateien selbst aus und führt .php aus. */
    /* Dieselben Grenzen, die site/.user.ini auf dem Server setzt. Der
       eingebaute Server von PHP liest .user.ini nicht - ohne diese Zeilen
       liefe die Prüfung gegen 2 MB Uploadgrenze, während auf dem Server
       32 MB gelten. Eine Prüfung, die andere Grenzen hat als der Ernstfall,
       prüft den falschen Ernstfall. */
    const kind = spawn(php, [
      '-d', 'upload_max_filesize=32M',
      '-d', 'post_max_size=160M',
      '-d', 'memory_limit=512M',
      '-S', '127.0.0.1:0', '-t', wurzel], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let gesammelt = '';
    let schonFertig = false;

    const pruefen = (stueck) => {
      gesammelt += stueck;
      const treffer = gesammelt.match(/127\.0\.0\.1:(\d+)/);
      if (treffer && !schonFertig) {
        schonFertig = true;
        fertig({
          ort: `http://127.0.0.1:${treffer[1]}`,
          zu: () => new Promise((f) => {
            kind.once('close', () => f());
            kind.kill('SIGTERM');
          }),
        });
      }
    };

    kind.stderr.on('data', (d) => pruefen(String(d)));
    kind.stdout.on('data', (d) => pruefen(String(d)));
    kind.on('error', schiefgegangen);

    setTimeout(() => {
      if (!schonFertig) {
        kind.kill('SIGTERM');
        schiefgegangen(new Error('PHP-Server kam nicht hoch:\n' + gesammelt));
      }
    }, 10000);
  });
}

/* --- Protokoll einer Prüfung -------------------------------------------- */
export function protokoll() {
  const zeilen = [];
  let fehler = 0;
  const ok = (bedingung, was, zusatz) => {
    if (!bedingung) fehler++;
    zeilen.push({ gut: !!bedingung, was, zusatz });
    console.log((bedingung ? '  ok    ' : '  FEHL  ') + was + (zusatz ? '  ' + zusatz : ''));
  };
  ok.hinweis = (text) => { zeilen.push({ hinweis: text }); console.log('        ' + text); };
  ok.stand = () => ({ fehler, geprueft: zeilen.filter((z) => 'gut' in z).length });
  return ok;
}

/* Eine Seite mit Fehlerwache: Skriptfehler zählen als Fehler, egal in
   welcher Prüfung sie auftreten. */
export async function seite(browser, ok, opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opt });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => ok(false, 'Skriptfehler auf der Seite', e.message));
  p.schliessen = () => ctx.close();
  return p;
}
