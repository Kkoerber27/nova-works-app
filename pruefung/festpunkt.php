<?php
/* =========================================================================
   Ist die Inhaltsdatei ein Festpunkt des Speicherfilters?

   felder_lesen() baut jeden Abschnitt allein aus dem Schema auf. Steht in
   der Inhaltsdatei ein Schluessel, den das Schema nicht kennt, ist er
   nach dem ersten Speichern dieses Abschnitts weg - lautlos, denn das
   Formular hat ihn nie gezeigt.

   Genau so verschwanden die strukturierten Daten fuer Suchmaschinen:
   meta.organisation stand in der Datei, nicht im Schema. Ein Klick auf
   "Meta & SEO speichern" hätte Anschrift, Telefonnummer und
   Gruendungsjahr aus dem Kopf der Seite geloescht.

   Dieses Skript spielt fuer jeden Abschnitt ein Speichern ohne Aenderung
   durch und vergleicht. Ausgabe ist JSON, damit die Pruefung in
   13-backend.mjs es einlesen kann; von Hand aufgerufen zeigt
   --lesbar denselben Befund als Text.
   ========================================================================= */

require __DIR__ . '/../site/admin/kern/felder.php';

/* name_saeubern() lebt in kern/bild.php, das hier nicht gebraucht wird. */
if (!function_exists('name_saeubern')) {
    function name_saeubern(string $s): string {
        return preg_replace('~[^a-z0-9._-]~', '', strtolower($s)) ?? '';
    }
}

$datei = __DIR__ . '/../site/inhalt/inhalt.json';
$i = json_decode((string) @file_get_contents($datei), true);
if (!is_array($i)) {
    fwrite(STDERR, "inhalt.json ist nicht lesbar.\n");
    exit(2);
}

$befund = [];
foreach (abschnitte() as $name => $s) {
    $alt = $i[$name] ?? [];
    $neu = felder_lesen($s['felder'], $alt);
    foreach ($s['unberuehrt'] ?? [] as $k) {
        if (is_array($alt) && array_key_exists($k, $alt)) $neu[$k] = $alt[$k];
    }

    $a = json_encode($alt, JSON_UNESCAPED_UNICODE);
    $b = json_encode($neu, JSON_UNESCAPED_UNICODE);
    $befund[$name] = ['festpunkt' => $a === $b, 'verloren' => []];

    if ($a === $b) continue;

    /* Was genau fehlt danach? Reihenfolge zaehlt hier nicht. */
    $fa = schluessel_flach($alt);
    $fb = schluessel_flach($neu);
    $befund[$name]['verloren'] = array_values(array_keys(array_diff_key($fa, $fb)));
    $befund[$name]['neu']      = array_values(array_keys(array_diff_key($fb, $fa)));
    $geaendert = [];
    foreach ($fa as $k => $w) if (isset($fb[$k]) && $fb[$k] !== $w) $geaendert[] = $k;
    $befund[$name]['geaendert'] = $geaendert;
}

function schluessel_flach($x, string $p = ''): array {
    $r = [];
    if (!is_array($x)) return [$p => $x];
    foreach ($x as $k => $v) {
        $n = $p === '' ? (string) $k : "$p.$k";
        if (is_array($v) && $v) $r += schluessel_flach($v, $n); else $r[$n] = is_array($v) ? '[]' : $v;
    }
    return $r;
}

if (in_array('--lesbar', $argv, true)) {
    $fehler = 0;
    foreach ($befund as $name => $b) {
        printf("  %-14s %s\n", $name, $b['festpunkt'] ? 'Festpunkt' : 'WEICHT AB');
        if ($b['festpunkt']) continue;
        $fehler++;
        foreach ($b['verloren']  as $k) echo "      verloren:  $k\n";
        foreach ($b['neu']       as $k) echo "      neu:       $k\n";
        foreach ($b['geaendert'] as $k) echo "      geaendert: $k\n";
    }
    exit($fehler ? 1 : 0);
}

echo json_encode($befund);
