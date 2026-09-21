/* Gemeinsames Handwerkszeug für die Prüfungen.
   Kein npm, keine Abhängigkeiten im Repo: Playwright bringt die Umgebung
   mit, alles andere steht hier. */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
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

/* --- Kleiner Dateiserver -------------------------------------------------
   Die Seite braucht keinen Build. Sie muss aber über http laufen: über
   file:// greifen weder Module noch fetch, und loading="lazy" verhält
   sich anders. */
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json',
};

export function server(wurzel = SEITE) {
  const s = http.createServer(async (req, res) => {
    let pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pfad.endsWith('/')) pfad += 'index.html';
    /* normalize + führende Schrägstriche weg: sonst käme man mit ../
       aus dem Verzeichnis heraus. */
    const ziel = join(wurzel, normalize(pfad).replace(/^(\.\.[/\\])+/, ''));
    try {
      const st = await stat(ziel);
      if (!st.isFile()) throw new Error('kein File');
      res.writeHead(200, { 'Content-Type': TYPEN[extname(ziel).toLowerCase()] || 'application/octet-stream' });
      res.end(await readFile(ziel));
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('nicht gefunden');
    }
  });
  return new Promise((ok) => {
    s.listen(0, '127.0.0.1', () => ok({
      ort: `http://127.0.0.1:${s.address().port}`,
      zu: () => new Promise((f) => s.close(f)),
    }));
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
