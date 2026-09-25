<?php
/* =========================================================================
   NOVA WORKS - Rechtsseiten bearbeiten
   Impressum, Datenschutz und AGB sind reine HTML-Dateien. Bearbeitet wird
   nur das, was zwischen den Markierungen im <main> steht - Kopfzeile,
   Fußzeile und Skripte bleiben unberührt.
   ========================================================================= */

require __DIR__ . '/kern/start.php';
require __DIR__ . '/kern/rahmen.php';
anmeldung_pflicht();

/* Feste Liste statt freier Dateiname: Damit kann über den Parameter keine
   andere Datei des Servers geöffnet oder überschrieben werden. */
const RECHTSSEITEN = [
    'impressum'   => ['Impressum',   'impressum.html',   '§ 5 DDG · Anbieterkennzeichnung'],
    'datenschutz' => ['Datenschutz', 'datenschutz.html', 'DSGVO-Erklärung'],
    'agb'         => ['AGB',         'agb.html',         'Allgemeine Geschäftsbedingungen'],
];

const RECHT_SICHERUNG = SEITEN_WURZEL . '/inhalt/sicherungen';

$schluessel = (string) ($_GET['d'] ?? '');
if (!isset(RECHTSSEITEN[$schluessel])) {
    melden('fehler', 'Diese Seite gibt es nicht.');
    weiter('index.php');
}
[$name, $datei, $was] = RECHTSSEITEN[$schluessel];
$pfad = SEITEN_WURZEL . '/' . $datei;

/* Was bearbeitet wird: alles zwischen <main id="main"> und </main>.
   Alles davor und dahinter bleibt, wie es ist - sonst könnte ein
   Tippfehler die Navigation der Seite zerlegen. */
function teile(string $html): ?array {
    $a = strpos($html, '<main id="main">');
    if ($a === false) return null;
    $a += strlen('<main id="main">');
    $b = strrpos($html, '</main>');
    if ($b === false || $b < $a) return null;
    return [substr($html, 0, $a), substr($html, $a, $b - $a), substr($html, $b)];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    merkmal_pruefen();

    $alt   = (string) @file_get_contents($pfad);
    $stuecke = teile($alt);

    if (!$stuecke) {
        melden('fehler', 'In der Datei fehlt die Marke <main id="main">. '
             . 'Sie muss von Hand repariert werden.');
        weiter('rechtsseiten.php?d=' . urlencode($schluessel));
    }

    $neu = str_replace(["\r\n", "\r"], "\n", (string) ($_POST['html'] ?? ''));

    /* Ein grober Schutz vor dem häufigsten Unfall: Ein Skript im
       Rechtstext ist nie beabsichtigt, und ein versehentlich eingefügter
       Einbettungs-Schnipsel aus einem Generator würde die Seite unbemerkt
       an einen fremden Server anbinden - genau das, was die Erklärung
       darunter verneint. */
    if (preg_match('~<\s*(script|iframe|object|embed)\b~i', $neu, $t)) {
        melden('fehler', 'Im Text steht ein <' . strtolower($t[1]) . '>-Element. '
             . 'Rechtstexte dürfen nichts nachladen – bitte entfernen.');
        weiter('rechtsseiten.php?d=' . urlencode($schluessel));
    }

    @mkdir(RECHT_SICHERUNG, 0755, true);
    @copy($pfad, RECHT_SICHERUNG . '/' . $schluessel . '-' . date('Ymd-His') . '.html');

    $zwischen = $pfad . '.neu';
    $ganz = $stuecke[0] . "\n" . trim($neu) . "\n" . $stuecke[2];

    if (@file_put_contents($zwischen, $ganz, LOCK_EX) === false || !@rename($zwischen, $pfad)) {
        @unlink($zwischen);
        melden('fehler', 'Die Datei ließ sich nicht schreiben. Im FTP-Programm '
             . 'die Rechte prüfen.');
    } else {
        melden('gut', $name . ' gespeichert. Eine Sicherung des vorigen Standes liegt bereit.');
    }
    weiter('rechtsseiten.php?d=' . urlencode($schluessel));
}

$html    = (string) @file_get_contents($pfad);
$stuecke = teile($html);
$text    = $stuecke ? trim($stuecke[1]) : '';

kopf($name, 'rechtsseiten', true);
?>

<a class="zurueck" href="index.php">← Übersicht</a>

<div class="titelzeile">
  <div>
    <h1><?= e($name) ?></h1>
    <p><?= e($was) ?> · <?= e($datei) ?></p>
  </div>
  <div class="titelzeile__tasten">
    <a class="taste" href="../<?= e($datei) ?>" target="_blank" rel="noopener">Seite ansehen</a>
  </div>
</div>

<div class="kacheln" style="margin-bottom:1.5rem">
<?php foreach (RECHTSSEITEN as $k => [$n, , ]): ?>
  <a class="kachel" href="rechtsseiten.php?d=<?= e($k) ?>"
     style="<?= $k === $schluessel ? 'border-color:var(--signal)' : '' ?>">
    <h3><?= e($n) ?></h3>
  </a>
<?php endforeach; ?>
</div>

<?php if (!$stuecke): ?>
<div class="meldung meldung--fehler">
  In dieser Datei fehlt die Marke <code>&lt;main id="main"&gt;</code>. Ohne sie
  ist nicht festzustellen, welcher Teil der Text ist. Bitte von Hand ansehen.
</div>
<?php else: ?>

<div class="meldung meldung--warn">
  Das hier ist HTML, und es ist ein Rechtstext. Was hier steht, gilt.
  Überschriften sind <code>&lt;h2&gt;</code>, Absätze <code>&lt;p&gt;</code>,
  Listen <code>&lt;ul&gt;&lt;li&gt;</code>. Wer unsicher ist, ändert nur den
  Text zwischen den spitzen Klammern und lässt die Klammern stehen.
</div>

<form method="post">
  <?= merkmal_feld() ?>
  <div class="feld">
    <label for="html">Inhalt zwischen &lt;main&gt; und &lt;/main&gt;</label>
    <textarea class="eingabe" id="html" name="html" rows="34"
              spellcheck="false"
              style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.86rem;line-height:1.5"><?= e($text) ?></textarea>
  </div>

  <div class="speicherleiste">
    <button class="taste taste--stark" type="submit">Speichern</button>
    <a class="taste taste--still" href="index.php">Abbrechen</a>
    <p><?= number_format(mb_strlen($text), 0, ',', '.') ?> Zeichen ·
       vor dem Speichern wird gesichert</p>
  </div>
</form>
<?php endif; ?>

<?php fuss();
