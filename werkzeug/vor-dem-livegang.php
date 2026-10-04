<?php
/* =========================================================================
   NOVA WORKS - Abnahme vor dem Livegang

       php werkzeug/vor-dem-livegang.php

   Geht alles durch, was stimmen muss, bevor die Seite die bestehende
   WordPress-Installation ersetzt. Beendet sich mit 1, sobald etwas
   fehlt - so laesst es sich auch in einen Ablauf haengen.

   Die Pruefungen sind in zwei Klassen geteilt:
     FEHLT   so darf die Seite nicht online gehen
     PRUEFEN kein Fehler, aber jemand muss es wissen
   ========================================================================= */

$wurzel = dirname(__DIR__);
$seite  = "$wurzel/site";

$fehler = 0; $hinweise = 0;
function melde(string $art, string $was, string $zusatz = '', string $rat = ''): void {
    global $fehler, $hinweise;
    if ($art === 'FEHLT')   $fehler++;
    if ($art === 'PRUEFEN') $hinweise++;
    $farbe = ['OK' => "\033[32m", 'FEHLT' => "\033[31m", 'PRUEFEN' => "\033[33m"][$art];
    printf("  %s%-8s\033[0m %-44s %s\n", $farbe, $art, $was, $zusatz);
    if ($rat !== '') foreach (explode("\n", wordwrap($rat, 62)) as $z) echo "           $z\n";
}

echo "\n  Abnahme vor dem Livegang\n  ", str_repeat('=', 74), "\n\n";

/* ---------------------------------------------------------------- Recht */
echo "  Rechtstexte\n";

$offen = [];
foreach (['impressum.php', 'datenschutz.php', 'agb.php'] as $d) {
    $n = substr_count((string) @file_get_contents("$seite/$d"), 'offen--block');
    if ($n) $offen[$d] = $n;
}
if ($offen) {
    $liste = [];
    foreach ($offen as $d => $n) $liste[] = "$d ($n)";
    melde('FEHLT', 'keine rot markierten Lücken mehr', implode(', ', $liste),
          'Die rot gestrichelten Kästen sind für den Besucher sichtbar. '
        . 'Sie stehen dort, weil eine Angabe fehlt, die rechtlich '
        . 'gebraucht wird - nicht als Gestaltungselement.');
} else {
    melde('OK', 'keine rot markierten Lücken mehr');
}

/* Pflichtangaben nach § 5 DDG - geprüft wird, dass sie dastehen, nicht
   ob sie stimmen. Das kann nur ein Mensch. */
$imp = (string) @file_get_contents("$seite/impressum.php");
foreach (['Anschrift' => 'Ettlingen', 'Vertretung' => 'Vertreten durch',
          'Telefon' => 'Telefon', 'E-Mail' => '@nova-works.de',
          'Register' => 'HRB', 'Umsatzsteuer-ID' => 'DE4'] as $was => $suche) {
    melde(str_contains($imp, $suche) ? 'OK' : 'FEHLT', "Impressum nennt: $was");
}

/* --------------------------------------------------------------- Dateien */
echo "\n  Dateien, die mit hochmüssen\n";

foreach (['.htaccess'  => 'Weiterleitungen, Caching, Sicherheits-Header',
          '.user.ini'  => 'Upload-Grenze 32 MB, Speicher 512 MB',
          'index.php'  => 'die Startseite',
          'kontakt.php'=> 'der Formular-Handler',
          'robots.txt' => '', 'sitemap.xml' => '',
          '404.php'    => '', 'favicon.svg' => ''] as $d => $wofuer) {
    $p = $d === 'favicon.svg' ? "$seite/assets/img/$d" : "$seite/$d";
    melde(is_file($p) ? 'OK' : 'FEHLT', "vorhanden: $d", $wofuer,
          is_file($p) ? '' : 'Punkt-Dateien blendet FileZilla aus: Server → '
                          . 'Versteckte Dateien anzeigen.');
}

/* Die gesperrten Ordner brauchen jeweils ihre eigene .htaccess. */
foreach (['inhalt', 'vorlage', 'admin/kern'] as $o) {
    melde(is_file("$seite/$o/.htaccess") ? 'OK' : 'FEHLT',
          "gesperrt: $o/", '',
          'Ohne diese Datei kann jeder inhalt.json herunterladen.');
}

/* --------------------------------------------------------------- Bilder */
echo "\n  Bilder\n";

$verz = json_decode((string) @file_get_contents("$seite/assets/img/bilder.json"), true) ?: [];
$inhalt = json_decode((string) @file_get_contents("$seite/inhalt/inhalt.json"), true) ?: [];

$gebraucht = [];
if (!empty($inhalt['hero']['bild'])) $gebraucht[$inhalt['hero']['bild']] = 'Hero';
foreach ($inhalt['leistungen']['karten'] ?? [] as $k)
    if (!empty($k['bild'])) $gebraucht[$k['bild']] = 'Leistung „' . $k['titel'] . '"';
foreach ($inhalt['referenzen']['projekte'] ?? [] as $p)
    foreach ($p['bilder'] ?? [] as $b)
        if (!empty($b['bild'])) $gebraucht[$b['bild']] = 'Projekt „' . $p['titel'] . '"';

$fehlend = []; $klein = [];
foreach ($gebraucht as $name => $wo) {
    if (!isset($verz[$name])) { $fehlend[] = "$name ($wo)"; continue; }
    $gross = end($verz[$name]['fassungen']);
    if ($gross['breite'] < 1920) $klein[] = "$name " . $gross['breite'] . 'px';
}
melde($fehlend ? 'FEHLT' : 'OK', 'jedes eingebundene Bild liegt vor',
      $fehlend ? implode(', ', $fehlend) : count($gebraucht) . ' Bilder',
      $fehlend ? 'Wo ein Bild fehlt, bleibt auf der Seite ein leerer Rahmen.' : '');

if ($klein) {
    melde('PRUEFEN', 'Bilder ohne hohe Auflösung', count($klein) . ' Stück',
          implode(', ', $klein) . ' - auf großen Schirmen weich. '
        . 'Die Seite funktioniert, es sieht nur nicht so gut aus.');
} else {
    melde('OK', 'alle Bilder reichen bis mindestens 1920 px');
}

/* Liegen die Dateien auch wirklich da? */
$lose = 0;
foreach ($verz as $name => $b) {
    foreach ($b['fassungen'] as $f)
        if (!is_file("$seite/assets/img/$name-{$f['breite']}.webp")) $lose++;
    if (!is_file("$seite/assets/img/$name.jpg")) $lose++;
}
melde($lose ? 'FEHLT' : 'OK', 'bilder.json und Dateien stimmen überein',
      $lose ? "$lose Dateien fehlen" : '',
      $lose ? 'php werkzeug/bilder-neu.php erzeugt sie neu.' : '');

/* -------------------------------------------------------------- Formular */
echo "\n  Kontaktformular\n";

$k = (string) @file_get_contents("$seite/kontakt.php");
preg_match("~\\\$empfaenger\s*=\s*'([^']*)'~", $k, $e);
preg_match("~\\\$absender\s*=\s*'([^']*)'~", $k, $a);
melde(!empty($e[1]) ? 'OK' : 'FEHLT', 'Empfänger eingetragen', $e[1] ?? '');
melde(!empty($a[1]) && str_ends_with($a[1], '@nova-works.de') ? 'OK' : 'FEHLT',
      'Absender ist eine Adresse der Domain', $a[1] ?? '');
melde('PRUEFEN', 'Absenderadresse existiert bei Strato', $a[1] ?? '',
      'Sie wird nie ausgelesen, muss aber als Postfach oder Weiterleitung '
    . 'angelegt sein. Sonst stuft der Mailserver jede Anfrage als Spam ein.');

/* ---------------------------------------------------------------- Backend */
echo "\n  Backend\n";

melde(is_file("$seite/inhalt/zugang.php") ? 'PRUEFEN' : 'OK',
      'keine Zugangsdatei im Paket',
      is_file("$seite/inhalt/zugang.php") ? 'inhalt/zugang.php' : '',
      is_file("$seite/inhalt/zugang.php")
        ? 'Die Datei enthaelt die Pruefsumme eines lokalen Passworts. Sie '
        . 'gehoert nicht mit hoch - auf dem Server wird ein eigenes vergeben.'
        : '');
melde('PRUEFEN', 'Passwort direkt nach dem Hochladen setzen', '/admin',
      'Solange keines gesetzt ist, kann das jeder tun, der die Adresse '
    . 'kennt. Das ist der erste Schritt nach dem Upload.');

/* Passt die Inhaltsdatei zum Schema des Backends? Was in der Datei steht
   und im Schema fehlt, loescht das erste Speichern dieses Abschnitts -
   ohne Rueckfrage, denn das Formular hat es nie gezeigt. Einmal ist das
   schon passiert, darum steht die Frage jetzt in der Abnahme. */
$festpunkt = __DIR__ . '/../pruefung/festpunkt.php';
if (is_file($festpunkt)) {
    $roh = @shell_exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($festpunkt) . ' 2>/dev/null');
    $befund = json_decode((string) $roh, true);
    if (!is_array($befund)) {
        melde('PRUEFEN', 'Inhalt und Schema vergleichbar', 'nicht ermittelbar',
              'Das Pruefskript pruefung/festpunkt.php lief nicht durch.');
    } else {
        $schief = [];
        foreach ($befund as $name => $b) if (empty($b['festpunkt'])) $schief[] = $name;
        melde($schief ? 'FEHLT' : 'OK', 'Inhaltsdatei passt zum Schema',
              $schief ? implode(', ', $schief) : '',
              $schief
                ? 'In diesen Abschnitten stehen Angaben, die das Backend nicht '
                . 'kennt. Wer sie dort speichert, loescht sie. Entweder ins Schema '
                . 'aufnehmen oder unter \'unberuehrt\' eintragen.'
                : '');
    }
}

/* ---------------------------------------------------------------- Adressen */
echo "\n  Adressen\n";

$meta = $inhalt['meta'] ?? [];
foreach (['kanonisch' => $meta['kanonisch'] ?? '',
          'og:url'    => $meta['og']['url'] ?? ''] as $was => $wert) {
    melde(str_starts_with($wert, 'https://nova-works.de') ? 'OK' : 'FEHLT',
          "$was zeigt auf die Domain", $wert);
}

$sm = (string) @file_get_contents("$seite/sitemap.xml");
$fehltImSitemap = [];
foreach (['impressum.php', 'datenschutz.php', 'agb.php'] as $d)
    if (!str_contains($sm, $d)) $fehltImSitemap[] = $d;
melde($fehltImSitemap ? 'FEHLT' : 'OK', 'sitemap.xml nennt alle Seiten',
      implode(', ', $fehltImSitemap));

/* Kein Verweis mehr auf die alten .html-Adressen im Markup. */
$reste = [];
foreach (glob("$seite/*.php") as $d) {
    $t = (string) file_get_contents($d);
    if (preg_match('~href="[^"]*(impressum|datenschutz|agb)\.html~', $t))
        $reste[] = basename($d);
}
melde($reste ? 'FEHLT' : 'OK', 'keine Verweise mehr auf die .html-Seiten',
      implode(', ', $reste));

/* ------------------------------------------------------------------ Ende */
echo "\n  ", str_repeat('=', 74), "\n";
if ($fehler) {
    echo "\n  \033[31m$fehler Punkt(e) fehlen.\033[0m So darf die Seite nicht online gehen.\n";
} elseif ($hinweise) {
    echo "\n  \033[33mBereit - $hinweise Punkt(e) muss jemand wissen.\033[0m\n";
} else {
    echo "\n  \033[32mBereit.\033[0m\n";
}
echo "\n";
exit($fehler ? 1 : 0);
