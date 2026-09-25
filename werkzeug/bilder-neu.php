<?php
/* =========================================================================
   NOVA WORKS - Bilder neu erzeugen
   Liest alles aus site/inhalt/originale/ und schreibt die fertigen
   Fassungen nach site/assets/img/ - WebP in mehreren Breiten, JPEG als
   Rückfall.

   Denselben Weg geht die Mediathek im Backend beim Hochladen; dieses
   Werkzeug ist für den Stapel gedacht - etwa nachdem in
   admin/kern/bild.php an den Reglern gedreht wurde.

       php werkzeug/bilder-neu.php              alle
       php werkzeug/bilder-neu.php live header  nur diese

   Die Originale werden nie verändert. Wer mit dem Ergebnis unzufrieden
   ist, ändert die Regler in site/admin/kern/bild.php und lässt den
   Befehl noch einmal laufen.
   ========================================================================= */

require __DIR__ . '/../site/admin/kern/bild.php';

$wurzel   = dirname(__DIR__);
$quellen  = "$wurzel/site/inhalt/originale";
$ziel     = "$wurzel/site/assets/img";
$filter   = array_slice($argv, 1);

if (!is_dir($quellen)) {
    fwrite(STDERR, "Ordner site/inhalt/originale/ fehlt.\n");
    exit(1);
}

$dateien = [];
foreach (scandir($quellen) as $d) {
    if ($d[0] === '.') continue;
    $endung = strtolower(pathinfo($d, PATHINFO_EXTENSION));
    if (!in_array($endung, BILD_FORMATE, true)) continue;
    $name = pathinfo($d, PATHINFO_FILENAME);
    if ($filter && !in_array($name, $filter, true)) continue;
    $dateien[$name] = "$quellen/$d";
}
ksort($dateien);

if (!$dateien) { fwrite(STDERR, "Nichts zu tun.\n"); exit(1); }

$verzeichnis = [];
$vorher = $nachher = 0;
$start  = microtime(true);

printf("%-14s %11s  %-28s %9s %9s\n", 'Bild', 'Original', 'Breiten', 'WebP', 'Rückfall');
echo str_repeat('-', 78), "\n";

foreach ($dateien as $name => $pfad) {
    /* Was bisher dort lag, für den Vergleich am Ende. */
    $alt = "$ziel/$name.jpg";
    if (is_file($alt)) $vorher += filesize($alt);

    $ergebnis = bild_staffel($pfad, $ziel, $name);

    if (!$ergebnis['ok']) {
        printf("%-14s  FEHLER: %s\n", $name, $ergebnis['fehler']);
        continue;
    }

    $breiten = array_keys($ergebnis['fassungen']);
    $sumW = $sumJ = 0;
    foreach ($ergebnis['fassungen'] as $f) {
        $sumW += $f['bytes']['webp'];
        $sumJ += $f['bytes']['jpeg'] ?? 0;
    }
    $nachher += $sumW;

    /* Die größte erzeugte Breite ist das, was am Ende auf einem
       Retina-Schirm gezeigt wird - daran misst sich die Schärfe. */
    $groesste = max($breiten);
    $knapp = $groesste < 2560 ? ' *' : '';

    printf("%-14s %11s  %-28s %9s %9s%s\n",
        $name,
        $ergebnis['quelle']['breite'] . 'x' . $ergebnis['quelle']['hoehe'],
        implode(' ', $breiten),
        lesbar($sumW), lesbar($sumJ), $knapp);

    $verzeichnis[$name] = [
        'quelle'    => $ergebnis['quelle'],
        'fassungen' => array_values(array_map(
            fn ($f) => ['breite' => $f['breite'], 'hoehe' => $f['hoehe']],
            $ergebnis['fassungen'])),
    ];
}

/* Das Verzeichnis braucht die Vorlage, um srcset und width/height zu
   schreiben, ohne jedes Bild erneut öffnen zu müssen. */
if (!$filter && $verzeichnis) {
    file_put_contents("$ziel/bilder.json",
        json_encode($verzeichnis, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
}

echo str_repeat('-', 78), "\n";
printf("%d Bilder in %.1f s   WebP gesamt %s\n",
       count($verzeichnis), microtime(true) - $start, lesbar($nachher));
echo "* = das Original gibt keine 2560 Pixel her\n";

function lesbar(int $b): string {
    return $b >= 1048576 ? round($b / 1048576, 1) . ' MB' : round($b / 1024) . ' kB';
}
