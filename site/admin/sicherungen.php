<?php
/* =========================================================================
   NOVA WORKS - Sicherungen
   Vor jedem Speichern entsteht eine Kopie. Hier lässt sie sich ansehen,
   herunterladen und zurückholen.
   ========================================================================= */

require __DIR__ . '/kern/start.php';
require __DIR__ . '/kern/rahmen.php';
anmeldung_pflicht();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    merkmal_pruefen();
    $name = basename((string) ($_POST['name'] ?? ''));

    if (($_POST['was'] ?? '') === 'zurueck') {
        $e = sicherung_zurueck($name);
        melden($e['ok'] ? 'gut' : 'fehler',
               $e['ok'] ? 'Stand vom ' . e($name) . ' zurückgeholt. '
                        . 'Der Stand davor wurde vorher gesichert.'
                        : $e['fehler']);
    }
    weiter('sicherungen.php');
}

/* Herunterladen. readfile statt Weiterleitung: Der Ordner ist für den
   Browser gesperrt, und das soll er auch bleiben. */
if (isset($_GET['holen'])) {
    $name = basename((string) $_GET['holen']);
    $p    = SICHERUNG_ORDNER . '/' . $name;
    if (is_file($p) && str_ends_with($name, '.json')) {
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $name . '"');
        header('Content-Length: ' . filesize($p));
        readfile($p);
        exit;
    }
    http_response_code(404);
    exit('Nicht gefunden.');
}

$liste = sicherungen();

kopf('Sicherungen', 'sicherungen', true);
?>

<a class="zurueck" href="index.php">← Übersicht</a>

<div class="titelzeile">
  <div>
    <h1>Sicherungen</h1>
    <p>Vor jedem Speichern wird der bisherige Stand kopiert. Die letzten
       <?= SICHERUNGEN_MAX ?> bleiben liegen, ältere räumt das System selbst weg.</p>
  </div>
</div>

<?php if (!$liste): ?>
<div class="block"><p>Noch keine Sicherungen. Die erste entsteht, sobald
  zum ersten Mal etwas gespeichert wird.</p></div>
<?php else: ?>
<div class="block">
  <table class="tabelle">
    <thead>
      <tr><th>Zeitpunkt</th><th>Anlass</th><th>Größe</th><th></th></tr>
    </thead>
    <tbody>
<?php foreach ($liste as $nr => $s):
        /* inhalt-20260925-104500-hero.json -> hero */
        $anlass = '';
        if (preg_match('~^inhalt-\d{8}-\d{6}-(.+)\.json$~', $s['name'], $t)) $anlass = $t[1];
        elseif (preg_match('~^([a-z]+)-\d{8}-\d{6}\.html$~', $s['name'], $t)) $anlass = $t[1] . ' (HTML)';
?>
      <tr>
        <td class="zahl"><?= e(date('d.m.Y  H:i:s', $s['zeit'])) ?><?php
            if ($nr === 0): ?> <span style="color:var(--gut)">· neueste</span><?php endif; ?></td>
        <td><?= $anlass ? e($anlass) : '<span style="color:var(--schrift-3)">–</span>' ?></td>
        <td class="zahl"><?= e(lesbare_groesse($s['bytes'])) ?></td>
        <td style="text-align:right;white-space:nowrap">
          <a class="taste taste--klein taste--still"
             href="?holen=<?= e(rawurlencode($s['name'])) ?>">Herunterladen</a>
<?php if (str_ends_with($s['name'], '.json') && str_starts_with($s['name'], 'inhalt-')): ?>
          <form method="post" style="display:inline"
                onsubmit="return confirm('Den Stand vom <?= e(date('d.m.Y H:i', $s['zeit'])) ?> zurückholen? Der jetzige Stand wird vorher gesichert.')">
            <?= merkmal_feld() ?>
            <input type="hidden" name="was" value="zurueck">
            <input type="hidden" name="name" value="<?= e($s['name']) ?>">
            <button class="taste taste--klein" type="submit">Zurückholen</button>
          </form>
<?php endif; ?>
        </td>
      </tr>
<?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php endif; ?>

<?php fuss();
