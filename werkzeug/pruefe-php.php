<?php
/* =========================================================================
   NOVA WORKS - Taugt dieses PHP für die Seite?

   Läuft auf zwei Wegen:

     php werkzeug/pruefe-php.php        auf der Kommandozeile
     https://…/pruefe-php.php           im Browser, nach dem Hochladen

   Für den Browser-Weg die Datei ins Wurzelverzeichnis des Webspace
   legen, aufrufen - und danach WIEDER LÖSCHEN. Sie verrät sonst jedem,
   welche PHP-Fassung dort läuft.
   ========================================================================= */

$imBrowser = PHP_SAPI !== 'cli';
$pruefungen = [];
$fehler = 0;
$warnung = 0;

function pruef(string $was, bool $gut, string $stand, string $rat = '', bool $nurWarnung = false) {
    global $pruefungen, $fehler, $warnung;
    if (!$gut) { $nurWarnung ? $warnung++ : $fehler++; }
    $pruefungen[] = ['was' => $was, 'gut' => $gut, 'stand' => $stand,
                     'rat' => $rat, 'warn' => $nurWarnung];
}

function bytes(string $name): int {
    $roh = trim((string) ini_get($name));
    if ($roh === '' || $roh === '-1') return PHP_INT_MAX;
    $z = (int) $roh;
    return match (strtolower(substr($roh, -1))) {
        'g' => $z * 1073741824, 'm' => $z * 1048576, 'k' => $z * 1024, default => $z,
    };
}

function lesbar(int $b): string {
    if ($b === PHP_INT_MAX) return 'unbegrenzt';
    return $b >= 1048576 ? round($b / 1048576) . ' MB' : round($b / 1024) . ' kB';
}

/* --- Fassung ---------------------------------------------------------- */

pruef('PHP-Fassung', PHP_VERSION_ID >= 80100, PHP_VERSION,
      'Gebraucht wird mindestens 8.1. Die Vorlagen benutzen match() und '
    . 'named arguments, das kennen ältere Fassungen nicht.');

/* --- Erweiterungen ---------------------------------------------------- */

pruef('GD (Bildverarbeitung)', extension_loaded('gd'),
      extension_loaded('gd') ? 'vorhanden' : 'FEHLT',
      'Ohne GD kann die Mediathek keine Bilder umwandeln. Bei Strato im '
    . 'Kundenlogin unter PHP-Einstellungen einschalten.');

if (extension_loaded('gd')) {
    $gd = gd_info();
    pruef('  … mit WebP', !empty($gd['WebP Support']),
          !empty($gd['WebP Support']) ? 'ja' : 'NEIN',
          'Ohne WebP entstehen nur JPEG-Fassungen. Die Seite läuft, aber die '
        . 'Bilder sind etwa ein Drittel größer.');
    pruef('  … mit JPEG', !empty($gd['JPEG Support']),
          !empty($gd['JPEG Support']) ? 'ja' : 'NEIN',
          'Ohne JPEG geht gar nichts - praktisch jede Kamera liefert JPEG.');
    pruef('  … mit PNG', !empty($gd['PNG Support']),
          !empty($gd['PNG Support']) ? 'ja' : 'NEIN', '', true);
}

pruef('EXIF (Bilddrehung)', extension_loaded('exif'),
      extension_loaded('exif') ? 'vorhanden' : 'FEHLT',
      'Ohne EXIF liegen hochkant aufgenommene Handyfotos quer, und nach dem '
    . 'Umwandeln ist das nicht mehr zu heilen.');

pruef('mbstring (Umlaute)', extension_loaded('mbstring'),
      extension_loaded('mbstring') ? 'vorhanden' : 'FEHLT',
      'Ohne mbstring werden Umlaute in Längenprüfungen falsch gezählt.');

pruef('JSON', extension_loaded('json'), extension_loaded('json') ? 'vorhanden' : 'FEHLT',
      'Die Inhaltsdatei ist JSON. Ohne das läuft die Seite nicht.');

pruef('Sitzungen', function_exists('session_start'), 'vorhanden',
      'Ohne Sitzungen gibt es keine Anmeldung im Backend.');

/* --- Grenzen ---------------------------------------------------------- */

/* Auf der Kommandozeile liest PHP die .user.ini nicht - dort steht
   deshalb immer die Voreinstellung, egal was auf dem Server gilt. Das
   als Fehler zu melden wäre falsch: Es sagt nichts über den Ernstfall. */
$hoch = min(bytes('upload_max_filesize'), bytes('post_max_size'));
pruef('Upload-Grenze', $hoch >= 8 * 1048576, lesbar($hoch),
      $imBrowser
        ? 'Kamerafotos haben 3 bis 10 MB. Die Datei site/.user.ini hebt die '
        . 'Grenze auf 32 MB - wenn sie schon hochgeladen ist, dauert es beim '
        . 'Anbieter einige Minuten, bis sie greift. Sonst hilft der Support.'
        : 'Nur ein Wert der Kommandozeile: Dort liest PHP die .user.ini nicht. '
        . 'Was auf dem Server gilt, zeigt erst der Aufruf im Browser. Lokal '
        . 'hilft: php -d upload_max_filesize=32M -d post_max_size=160M -S …',
      !$imBrowser);

/* Die Bildverarbeitung hebt den Wert selbst an, sobald sie startet
   (siehe bild_speicher_anheben in admin/kern/bild.php). Geprüft wird
   deshalb, ob das gelingt - nicht, was vorher eingestellt war. Sperrt
   der Anbieter ini_set, bleibt es beim alten Wert, und genau das ist
   die Auskunft, die hier zählt. */
$vorher  = bytes('memory_limit');
@ini_set('memory_limit', '512M');
$nachher = bytes('memory_limit');
@ini_set('memory_limit', $vorher === PHP_INT_MAX ? '-1' : (int) ($vorher / 1048576) . 'M');

pruef('Arbeitsspeicher', $nachher >= 256 * 1048576,
      $nachher === $vorher
        ? lesbar($nachher)
        : lesbar($vorher) . ' → ' . lesbar($nachher) . ' (wird angehoben)',
      'Ein Foto mit 8640 x 5760 Pixeln belegt in GD 199 MB. Der Anbieter '
    . 'lässt das Anheben nicht zu - dann helfen nur kleinere Fotos oder '
    . 'der Support.');

$zeit = (int) ini_get('max_execution_time');
pruef('Rechenzeit', $zeit === 0 || $zeit >= 60,
      $zeit === 0 ? 'unbegrenzt' : $zeit . ' s',
      'Fünf Breiten aus einem großen Foto dauern auf einem geteilten Server '
    . 'auch mal eine Minute.', true);

/* --- Schreibrechte ---------------------------------------------------- */

$wurzel = is_dir(__DIR__ . '/../site') ? __DIR__ . '/../site' : __DIR__;
foreach (['inhalt', 'inhalt/sicherungen', 'inhalt/originale', 'assets/img'] as $ordner) {
    $p = "$wurzel/$ordner";
    if (!is_dir($p)) {
        /* Zwei der Ordner entstehen erst beim ersten Speichern - dann muss
           wenigstens der darüber beschreibbar sein. */
        $eltern = dirname($p);
        pruef("Ordner $ordner", is_dir($eltern) && is_writable($eltern),
              is_dir($eltern) && is_writable($eltern) ? 'wird angelegt' : 'nicht anlegbar',
              "Im FTP-Programm die Rechte von " . basename($eltern) . "/ auf 755 setzen.");
        continue;
    }
    pruef("Ordner $ordner", is_writable($p), is_writable($p) ? 'beschreibbar' : 'NUR LESEN',
          "Im FTP-Programm die Rechte von $ordner/ auf 755 setzen. Ohne das "
        . "kann das Backend nichts speichern.");
}

/* --- .user.ini gefunden? ---------------------------------------------- */

$userIni = is_file("$wurzel/.user.ini");
pruef('.user.ini liegt da', $userIni, $userIni ? 'ja' : 'nein',
      'Die Datei beginnt mit einem Punkt und wird von vielen FTP-Programmen '
    . 'ausgeblendet. In FileZilla unter Server → Versteckte Dateien anzeigen '
    . 'einschalten.', true);

/* --- Ausgabe ---------------------------------------------------------- */

$urteil = $fehler === 0
    ? ($warnung === 0 ? 'Alles in Ordnung.' : 'Läuft, mit Einschränkungen.')
    : 'So läuft das Backend nicht.';

if (!$imBrowser) {
    echo "\n  PHP-Prüfung für Nova Works\n";
    echo '  ', str_repeat('-', 62), "\n";
    foreach ($pruefungen as $p) {
        /* mb-bewusst auffüllen: printf zählt Bytes, und das "…" in den
           eingerückten Zeilen belegt drei davon - die Spalte verrutschte. */
        $was = $p['was'] . str_repeat(' ', max(0, 26 - mb_strlen($p['was'])));
        printf("  %-4s %s %s\n",
            $p['gut'] ? 'ok' : ($p['warn'] ? 'warn' : 'FEHL'), $was, $p['stand']);
        if (!$p['gut'] && $p['rat']) {
            foreach (explode("\n", wordwrap($p['rat'], 58)) as $z) echo "       $z\n";
        }
    }
    echo '  ', str_repeat('-', 62), "\n  $urteil\n\n";
    exit($fehler === 0 ? 0 : 1);
}

header('Content-Type: text/html; charset=utf-8');
?><!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>PHP-Prüfung · Nova Works</title>
<style>
 body{margin:0;background:#0f0f11;color:#ececee;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
 main{max-width:760px;margin:0 auto;padding:3rem 1.5rem}
 h1{font-size:1.6rem;margin:0 0 .3rem} .urteil{margin:0 0 2rem;color:rgba(236,236,238,.62)}
 table{width:100%;border-collapse:collapse}
 td{padding:.6rem .5rem;border-bottom:1px solid #2b2b32;vertical-align:top}
 td:first-child{width:3.5rem;font-weight:600} td:last-child{text-align:right;color:rgba(236,236,238,.62);white-space:nowrap}
 .ok{color:#5fd08a} .warn{color:#ffb454} .fehl{color:#ff6b5e}
 .rat{display:block;margin-top:.25rem;color:rgba(236,236,238,.5);font-size:.87rem}
 .hinweis{margin-top:2rem;padding:1rem 1.2rem;border:1px solid #2b2b32;border-left:3px solid #ffb454;border-radius:6px;font-size:.9rem}
 code{font-family:ui-monospace,Menlo,monospace;font-size:.88em}
</style></head><body><main>
<h1>PHP-Prüfung</h1>
<p class="urteil"><?= htmlspecialchars($urteil) ?>
   <?= $fehler ?> Fehler, <?= $warnung ?> Hinweise.</p>
<table>
<?php foreach ($pruefungen as $p):
   $k = $p['gut'] ? 'ok' : ($p['warn'] ? 'warn' : 'fehl'); ?>
 <tr>
  <td class="<?= $k ?>"><?= $p['gut'] ? 'ok' : ($p['warn'] ? 'warn' : 'Fehl') ?></td>
  <td><?= htmlspecialchars($p['was']) ?>
   <?php if (!$p['gut'] && $p['rat']): ?><span class="rat"><?= htmlspecialchars($p['rat']) ?></span><?php endif; ?></td>
  <td><?= htmlspecialchars($p['stand']) ?></td>
 </tr>
<?php endforeach; ?>
</table>
<p class="hinweis"><strong>Danach löschen.</strong> Diese Datei verrät jedem,
 der die Adresse kennt, welche PHP-Fassung und welche Grenzen hier gelten.
 Sie gehört nicht dauerhaft auf den Server.</p>
</main></body></html>
