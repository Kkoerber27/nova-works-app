<?php
/* =========================================================================
   NOVA WORKS - Mediathek
   Fotos hochladen, ersetzen, löschen. Jedes hochgeladene Bild wird sofort
   in WebP umgewandelt und in fünf Breiten abgelegt; das Original bleibt
   unter inhalt/originale/ liegen, damit sich alles jederzeit neu erzeugen
   lässt - etwa wenn später eine Breite dazukommt.
   ========================================================================= */

require __DIR__ . '/kern/start.php';
require __DIR__ . '/kern/felder.php';
require __DIR__ . '/kern/rahmen.php';
anmeldung_pflicht();

const BILD_ORDNER     = SEITEN_WURZEL . '/assets/img';
const ORIGINAL_ORDNER = SEITEN_WURZEL . '/inhalt/originale';
const VERZEICHNIS     = BILD_ORDNER . '/bilder.json';

/* Was der Server wirklich erlaubt.

   Die eigene Grenze nützt nichts, wenn PHP schon vorher abriegelt: Die
   Voreinstellung von upload_max_filesize ist 2 MB, und daran scheitert
   jedes echte Kamerafoto. site/.user.ini hebt das auf 32 MB an - ob das
   beim Anbieter auch greift, steht erst zur Laufzeit fest. Deshalb wird
   der tatsächliche Wert ausgelesen und angezeigt, statt eine Zahl zu
   versprechen, die vielleicht nicht gilt. */
function ini_bytes(string $name): int {
    $roh = trim((string) ini_get($name));
    if ($roh === '') return 0;
    $zahl = (int) $roh;
    return match (strtolower(substr($roh, -1))) {
        'g' => $zahl * 1024 * 1024 * 1024,
        'm' => $zahl * 1024 * 1024,
        'k' => $zahl * 1024,
        default => $zahl,
    };
}

$grenzeServer = min(
    ini_bytes('upload_max_filesize') ?: PHP_INT_MAX,
    ini_bytes('post_max_size') ?: PHP_INT_MAX);
define('MAX_BYTES', min($grenzeServer, 32 * 1024 * 1024));


/* =========================================================================
   Verzeichnis
   ========================================================================= */

function verzeichnis_laden(): array {
    if (!is_file(VERZEICHNIS)) return [];
    return json_decode((string) file_get_contents(VERZEICHNIS), true) ?: [];
}

function verzeichnis_schreiben(array $v): void {
    ksort($v);
    @file_put_contents(VERZEICHNIS,
        json_encode($v, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n", LOCK_EX);
}

/* Wo wird dieses Bild benutzt? Wird vor dem Löschen gefragt - ein Foto
   herauszulöschen, das auf der Startseite steht, hinterlässt dort sonst
   eine Lücke, die niemandem auffällt, bis ein Kunde anruft. */
function verwendung(string $bild, array $inhalt): array {
    $orte = [];
    if (($inhalt['hero']['bild'] ?? '') === $bild) $orte[] = 'Hero-Bereich';

    foreach ($inhalt['leistungen']['karten'] ?? [] as $k) {
        if (($k['bild'] ?? '') === $bild) $orte[] = 'Leistung „' . $k['titel'] . '"';
    }
    foreach ($inhalt['referenzen']['projekte'] ?? [] as $p) {
        foreach ($p['bilder'] ?? [] as $nr => $b) {
            if (($b['bild'] ?? '') === $bild) {
                $orte[] = 'Projekt „' . $p['titel'] . '" (Bild ' . ($nr + 1) . ')';
            }
        }
    }
    return $orte;
}

/* Alle Dateien eines Motivs - die Staffel plus der JPEG-Rückfall. */
function dateien_von(string $name, array $eintrag): array {
    $d = [BILD_ORDNER . "/$name.jpg"];
    foreach ($eintrag['fassungen'] ?? [] as $f) {
        $d[] = BILD_ORDNER . "/$name-{$f['breite']}.webp";
    }
    foreach (glob(ORIGINAL_ORDNER . "/$name.*") ?: [] as $o) $d[] = $o;
    return $d;
}


/* =========================================================================
   Aktionen
   ========================================================================= */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    merkmal_pruefen();
    $was = (string) ($_POST['was'] ?? '');
    $v   = verzeichnis_laden();

    /* --- Hochladen --- */
    if ($was === 'hochladen') {
        $gut = 0; $fehler = [];

        /* Mehrere Dateien auf einmal: PHP liefert sie als Feld von
           Spalten, nicht als Liste von Dateien - deshalb der Umbau. */
        $dateien = $_FILES['bilder'] ?? null;
        $anzahl  = $dateien ? count((array) $dateien['name']) : 0;

        for ($n = 0; $n < $anzahl; $n++) {
            $urname = (string) $dateien['name'][$n];
            $tmp    = (string) $dateien['tmp_name'][$n];
            $code   = (int) $dateien['error'][$n];

            if ($code === UPLOAD_ERR_NO_FILE) continue;

            if ($code !== UPLOAD_ERR_OK) {
                $fehler[] = $urname . ': ' . match ($code) {
                    UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE =>
                        'zu groß für den Server (Grenze: ' . ini_get('upload_max_filesize') . ').',
                    UPLOAD_ERR_PARTIAL  => 'die Übertragung wurde abgebrochen.',
                    UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE =>
                        'der Server konnte die Datei nicht ablegen.',
                    default => 'unbekannter Fehler beim Hochladen.',
                };
                continue;
            }

            /* is_uploaded_file: Nur eine wirklich hochgeladene Datei
               verarbeiten. Ohne diese Prüfung könnte ein manipuliertes
               Formular einen beliebigen Pfad vom Server nennen. */
            if (!is_uploaded_file($tmp)) { $fehler[] = $urname . ': ungültig.'; continue; }

            if (filesize($tmp) > MAX_BYTES) {
                $fehler[] = $urname . ': größer als ' . lesbare_groesse(MAX_BYTES) . '.';
                continue;
            }

            /* Der Dateityp wird am Inhalt erkannt, nicht an der Endung -
               eine .jpg kann alles Mögliche sein. */
            $art = bild_lesbar($tmp);
            if (!$art['ok']) { $fehler[] = $urname . ': ' . $art['fehler']; continue; }

            /* Zielname: aus dem eigenen Feld, sonst aus dem Dateinamen.
               name_saeubern lässt nur Harmloses übrig. */
            $wunsch = trim((string) ($_POST['name'] ?? ''));
            $basis  = name_saeubern($wunsch !== '' && $anzahl === 1
                        ? $wunsch : pathinfo($urname, PATHINFO_FILENAME));
            if ($basis === '') $basis = 'bild';

            $ersetzen = !empty($_POST['ersetzen']) && isset($v[$basis]);
            if (!$ersetzen) {
                $name = $basis; $z = 2;
                while (isset($v[$name])) $name = $basis . '-' . $z++;
            } else {
                $name = $basis;
                /* Beim Ersetzen zuerst die alten Fassungen weg: Das neue
                   Bild kann ein anderes Seitenverhältnis haben, dann
                   blieben sonst Dateien einer Breite liegen, die es nicht
                   mehr gibt, und der Browser lüde sie weiter. */
                foreach (dateien_von($name, $v[$name]) as $alt) @unlink($alt);
            }

            @mkdir(ORIGINAL_ORDNER, 0755, true);
            $endung = $art['typ'] === 'png' ? 'png' : ($art['typ'] === 'webp' ? 'webp' : 'jpg');
            foreach (glob(ORIGINAL_ORDNER . "/$name.*") ?: [] as $o) @unlink($o);
            @move_uploaded_file($tmp, ORIGINAL_ORDNER . "/$name.$endung");

            $ergebnis = bild_staffel(ORIGINAL_ORDNER . "/$name.$endung", BILD_ORDNER, $name);
            if (!$ergebnis['ok']) { $fehler[] = $urname . ': ' . $ergebnis['fehler']; continue; }

            $v[$name] = [
                'quelle'    => $ergebnis['quelle'],
                'fassungen' => array_values(array_map(
                    fn ($f) => ['breite' => $f['breite'], 'hoehe' => $f['hoehe']],
                    $ergebnis['fassungen'])),
            ];
            $gut++;
        }

        verzeichnis_schreiben($v);

        if ($gut)      melden('gut', $gut . ($gut === 1 ? ' Bild' : ' Bilder')
                            . ' hochgeladen und in WebP umgewandelt.');
        if ($fehler)   melden('fehler', implode(' ', $fehler));
        if (!$gut && !$fehler) melden('warn', 'Es wurde keine Datei ausgewählt.');
        weiter('mediathek.php');
    }

    /* --- Löschen --- */
    if ($was === 'loeschen') {
        $name = name_saeubern((string) ($_POST['name'] ?? ''));
        if (!isset($v[$name])) { melden('fehler', 'Dieses Bild gibt es nicht.'); weiter('mediathek.php'); }

        $orte = verwendung($name, inhalt_laden());
        if ($orte && empty($_POST['trotzdem'])) {
            melden('warn', 'Das Bild wird noch benutzt: ' . implode(', ', $orte)
                 . '. Erst dort ein anderes eintragen.');
            weiter('mediathek.php');
        }

        foreach (dateien_von($name, $v[$name]) as $d) @unlink($d);
        unset($v[$name]);
        verzeichnis_schreiben($v);
        melden('gut', 'Bild „' . $name . '" gelöscht.');
        weiter('mediathek.php');
    }

    /* --- Neu erzeugen --- */
    if ($was === 'neu') {
        $name = name_saeubern((string) ($_POST['name'] ?? ''));
        $quellen = glob(ORIGINAL_ORDNER . "/$name.*") ?: [];
        if (!$quellen) {
            melden('fehler', 'Von diesem Bild liegt kein Original mehr vor. '
                 . 'Bitte neu hochladen.');
            weiter('mediathek.php');
        }
        $ergebnis = bild_staffel($quellen[0], BILD_ORDNER, $name);
        if ($ergebnis['ok']) {
            $v[$name]['fassungen'] = array_values(array_map(
                fn ($f) => ['breite' => $f['breite'], 'hoehe' => $f['hoehe']],
                $ergebnis['fassungen']));
            $v[$name]['quelle'] = $ergebnis['quelle'];
            verzeichnis_schreiben($v);
            melden('gut', 'Bild „' . $name . '" neu erzeugt.');
        } else {
            melden('fehler', $ergebnis['fehler']);
        }
        weiter('mediathek.php');
    }
}


/* =========================================================================
   Anzeigen
   ========================================================================= */

$v       = verzeichnis_laden();
$inhalt  = inhalt_laden();
$gesamt  = 0;
foreach (glob(BILD_ORDNER . '/*.webp') ?: [] as $d) $gesamt += filesize($d);

kopf('Mediathek', 'mediathek');
?>

<a class="zurueck" href="index.php">← Übersicht</a>

<div class="titelzeile">
  <div>
    <h1>Mediathek</h1>
    <p><?= count($v) ?> Motive · <?= e(lesbare_groesse($gesamt)) ?> als WebP.
       Jedes Bild liegt in bis zu fünf Breiten vor; der Browser sucht sich
       die passende selbst aus.</p>
  </div>
</div>

<form class="block" method="post" enctype="multipart/form-data" id="hochladen">
  <?= merkmal_feld() ?>
  <input type="hidden" name="was" value="hochladen">
  <h2>Fotos hochladen</h2>
  <p>JPEG, PNG, WebP oder AVIF, bis <?= e(lesbare_groesse(MAX_BYTES)) ?> je Datei.
     Die Umwandlung in WebP passiert automatisch – je größer das Original,
     desto besser das Ergebnis. Am besten die Datei direkt aus der Kamera
     nehmen, nicht die aus WhatsApp.</p>

<?php if (MAX_BYTES < 8 * 1024 * 1024): ?>
  <div class="meldung meldung--warn">
    Der Server nimmt zurzeit nur <?= e(lesbare_groesse(MAX_BYTES)) ?> je Datei an
    (<code>upload_max_filesize</code>). Für Kamerafotos ist das zu wenig. Die Datei
    <code>.user.ini</code> im Wurzelverzeichnis hebt die Grenze auf 32 MB an –
    falls sie schon dort liegt, dauert es beim Anbieter einige Minuten, bis
    sie greift. Sonst hilft der Support des Anbieters.
  </div>
<?php endif; ?>

  <div class="ablage" data-ablage>
    <input class="eingabe" type="file" name="bilder[]" id="dateien"
           accept="image/jpeg,image/png,image/webp,image/avif" multiple
           style="max-width:420px;margin-inline:auto">
    <p>oder Dateien hierher ziehen</p>
  </div>

  <div class="feldpaar">
    <div class="feld">
      <label for="name">Name (nur bei einer einzelnen Datei)</label>
      <p class="feld__hinweis">Leer lassen, dann wird der Dateiname genommen.
         Unter diesem Namen taucht das Bild in den Auswahlfeldern auf.</p>
      <input class="eingabe" type="text" id="name" name="name" placeholder="z. B. rainbow">
    </div>
    <div class="feld">
      <span class="feld__name">Vorhandenes ersetzen</span>
      <p class="feld__hinweis">Angehakt wird ein Bild gleichen Namens
         überschrieben – überall, wo es eingebunden ist. Sonst entsteht ein
         neues mit angehängter Zahl.</p>
      <label style="display:flex;gap:.5rem;align-items:center;font-weight:400">
        <input type="checkbox" name="ersetzen" value="1"> gleichnamiges Bild ersetzen
      </label>
    </div>
  </div>

  <button class="taste taste--stark" type="submit">Hochladen und umwandeln</button>
</form>

<h2 class="gruppentitel">Vorhandene Bilder</h2>

<?php if (!$v): ?>
<div class="block"><p>Noch keine Bilder. Oben die ersten hochladen.</p></div>
<?php else: ?>
<div class="galerie">
<?php foreach ($v as $name => $b):
        $fass   = $b['fassungen'] ?? [];
        $gross  = $fass ? end($fass) : null;
        $orte   = verwendung($name, $inhalt);
        $bytes  = 0;
        foreach ($fass as $f) $bytes += (int) @filesize(BILD_ORDNER . "/$name-{$f['breite']}.webp");
        $knapp  = $gross && $gross['breite'] < 1920;
?>
  <div class="bildkachel">
    <img class="bildkachel__schau" src="../assets/img/<?= e($name) ?>-640.webp"
         alt="" loading="lazy" width="176" height="132">
    <div class="bildkachel__text">
      <div class="bildkachel__name"><?= e($name) ?></div>
      <div class="bildkachel__zahl">
        <?= $gross ? e($gross['breite'] . '×' . $gross['hoehe']) : '–' ?>
        · <?= e(lesbare_groesse($bytes)) ?>
        · <?= count($fass) ?> Breiten
      </div>
<?php if ($knapp): ?>
      <div class="bildkachel__zahl" style="color:var(--warn)">
        Original nur <?= e((string) ($b['quelle']['breite'] ?? '?')) ?> px breit –
        auf großen Schirmen unscharf
      </div>
<?php endif; ?>
      <div class="bildkachel__zahl">
        <?= $orte ? e(implode(', ', array_slice($orte, 0, 2)))
                  . (count($orte) > 2 ? ' +' . (count($orte) - 2) : '')
                  : '<span style="color:var(--schrift-3)">nirgends eingebunden</span>' ?>
      </div>
      <div class="bildkachel__tasten">
        <a class="taste taste--klein taste--still" target="_blank" rel="noopener"
           href="../assets/img/<?= e($name) ?>-<?= e((string) ($gross['breite'] ?? 640)) ?>.webp">Ansehen</a>
        <form method="post" style="display:inline">
          <?= merkmal_feld() ?>
          <input type="hidden" name="was" value="neu">
          <input type="hidden" name="name" value="<?= e($name) ?>">
          <button class="taste taste--klein taste--still" type="submit"
                  title="Aus dem Original neu berechnen">Neu</button>
        </form>
        <form method="post" style="display:inline"
              onsubmit="return confirm('Bild „<?= e($name) ?>“ mit allen Fassungen löschen?')">
          <?= merkmal_feld() ?>
          <input type="hidden" name="was" value="loeschen">
          <input type="hidden" name="name" value="<?= e($name) ?>">
          <button class="taste taste--klein taste--gefahr" type="submit">Löschen</button>
        </form>
      </div>
    </div>
  </div>
<?php endforeach; ?>
</div>
<?php endif; ?>

<script>
/* Dateien per Ziehen ablegen. Das Eingabefeld bleibt daneben stehen -
   Ziehen funktioniert nicht auf jedem Gerät, und ohne das Feld gäbe es
   dann keinen Weg. */
(function () {
  var ablage = document.querySelector('[data-ablage]');
  var feld   = document.getElementById('dateien');
  if (!ablage || !feld) return;

  ['dragenter', 'dragover'].forEach(function (n) {
    ablage.addEventListener(n, function (e) {
      e.preventDefault(); ablage.setAttribute('data-ueber', '');
    });
  });
  ['dragleave', 'drop'].forEach(function (n) {
    ablage.addEventListener(n, function () { ablage.removeAttribute('data-ueber'); });
  });
  ablage.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) feld.files = e.dataTransfer.files;
  });
})();
</script>

<?php fuss();
