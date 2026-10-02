<?php
/* =========================================================================
   NOVA WORKS - Router für den lokalen Server

   Nur für die Arbeit am eigenen Rechner. Er tut genau eine Sache: Er
   verbietet dem Browser, Stylesheet, Skript, Bilder und Schrift zu
   behalten.

   Warum: Beim Entwickeln ist eine alte Fassung im Zwischenspeicher das
   teuerste Missverständnis überhaupt. Man sieht eine Änderung nicht,
   hält sie für kaputt, sucht am falschen Ende - und das mehrfach
   hintereinander, weil der Zwischenspeicher nicht sagt, dass er einen
   anlügt.

   Die Dateien werden hier selbst ausgeliefert statt über "return false".
   Beim Rückgabewert false übernimmt der eingebaute Server, und er
   verwirft dabei die Kopfzeilen des Routers - nachgemessen: Von
   Cache-Control blieb nichts übrig.

   Auf dem Server gilt das Gegenteil: Dort sollen Browser die Dateien ein
   Jahr behalten (siehe .htaccess). Diese Datei kommt dort nie zum
   Einsatz; sie wird ausschließlich von werkzeug/lokal-starten.sh
   benutzt.
   ========================================================================= */

const TYPEN = [
    'css'  => 'text/css; charset=utf-8',
    'js'   => 'text/javascript; charset=utf-8',
    'mjs'  => 'text/javascript; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'svg'  => 'image/svg+xml',
    'webp' => 'image/webp',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'gif'  => 'image/gif',
    'ico'  => 'image/x-icon',
    'woff2'=> 'font/woff2',
    'woff' => 'font/woff',
    'txt'  => 'text/plain; charset=utf-8',
    'xml'  => 'application/xml; charset=utf-8',
];

$pfad = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$pfad = rawurldecode($pfad);

/* Kein Ausbruch aus dem Verzeichnis: realpath loest ../ auf, danach muss
   der Pfad immer noch unterhalb von site/ liegen. */
$wurzel = realpath(__DIR__ . '/../site');
$ziel   = realpath($wurzel . $pfad);

$endung = strtolower(pathinfo($pfad, PATHINFO_EXTENSION));

if ($ziel !== false && is_file($ziel) && str_starts_with($ziel, $wurzel)
    && isset(TYPEN[$endung])) {
    header('Content-Type: ' . TYPEN[$endung]);
    header('Content-Length: ' . filesize($ziel));
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    readfile($ziel);
    return true;
}

/* Alles andere - PHP-Dateien, Verzeichnisse, Fehlende - macht der
   eingebaute Server wie gewohnt. */
return false;
