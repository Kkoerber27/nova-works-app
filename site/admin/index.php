<?php
/* =========================================================================
   NOVA WORKS - Übersicht des Backends
   ========================================================================= */

require __DIR__ . '/kern/start.php';
require __DIR__ . '/kern/felder.php';
require __DIR__ . '/kern/rahmen.php';
anmeldung_pflicht();

$inhalt  = inhalt_laden();
$sicher  = sicherungen();
$bilder  = glob(SEITEN_WURZEL . '/assets/img/*.jpg') ?: [];
$staffel = is_file(SEITEN_WURZEL . '/assets/img/bilder.json')
    ? (json_decode((string) file_get_contents(SEITEN_WURZEL . '/assets/img/bilder.json'), true) ?: [])
    : [];

/* Wie viele Einträge hängen an einem Abschnitt? Steht als Zusatzzeile auf
   der Kachel, damit man sieht, wo etwas drinsteckt, ohne hineinzugehen. */
function umfang(string $schluessel, array $inhalt): string {
    $a = $inhalt[$schluessel] ?? [];
    return match ($schluessel) {
        'referenzen'  => count($a['projekte'] ?? []) . ' Projekte',
        'leistungen'  => count($a['karten'] ?? []) . ' Karten',
        'nav'         => count($a['punkte'] ?? []) . ' Punkte',
        'kontakt'     => count($a['angaben'] ?? []) . ' Kontaktdaten',
        'fuss'        => count($a['links'] ?? []) . ' Verweise',
        default       => '',
    };
}

kopf('Übersicht', '');
?>

<div class="titelzeile">
  <div>
    <h1>Willkommen zurück.</h1>
    <p>Hier lassen sich alle Texte und Bilder der Website ändern. Was du
       speicherst, steht sofort auf der Seite.</p>
  </div>
  <div class="titelzeile__tasten">
    <a class="taste" href="../" target="_blank" rel="noopener">Website öffnen</a>
    <a class="taste" href="mediathek.php">Mediathek</a>
  </div>
</div>

<h2 class="gruppentitel">Inhalte der Startseite</h2>

<div class="kacheln">
<?php foreach (abschnitte() as $schluessel => $a):
        $zusatz = umfang($schluessel, $inhalt); ?>
  <a class="kachel" href="abschnitt.php?a=<?= e($schluessel) ?>">
    <span class="kachel__kennung"><?= e($schluessel) ?></span>
    <h3><?= e($a['name']) ?></h3>
    <p><?= e($a['beschreibung']) ?><?= $zusatz ? ' · ' . e($zusatz) : '' ?></p>
    <span class="kachel__fuss">Bearbeiten →</span>
  </a>
<?php endforeach; ?>
</div>

<h2 class="gruppentitel">Bilder</h2>

<div class="block">
  <h2>Mediathek</h2>
  <p>Fotos hochladen und zuweisen. Beim Hochladen wird jedes Bild
     automatisch in WebP umgewandelt und in fünf Breiten abgelegt – der
     Browser lädt dann am Handy eine kleine und am großen Schirm eine
     scharfe Fassung.</p>
  <div class="kacheln">
    <a class="kachel" href="mediathek.php">
      <h3>Bilder</h3>
      <p><?= count($staffel) ?> Motive · hochladen, ersetzen, löschen</p>
      <span class="kachel__fuss">Öffnen →</span>
    </a>
    <a class="kachel" href="mediathek.php#hochladen">
      <h3>Hochladen</h3>
      <p>JPEG, PNG, WebP, AVIF · HEIC vom iPhone geht nicht</p>
      <span class="kachel__fuss">Öffnen →</span>
    </a>
  </div>
</div>

<h2 class="gruppentitel">Rechtsseiten</h2>

<div class="block">
  <p>Impressum, Datenschutz und AGB werden direkt im HTML bearbeitet. Vor
     jedem Speichern entsteht automatisch eine Sicherung.</p>
  <div class="kacheln">
<?php foreach ([
        'impressum'   => ['Impressum',   '§ 5 DDG · Anbieterkennzeichnung'],
        'datenschutz' => ['Datenschutz', 'DSGVO-Erklärung'],
        'agb'         => ['AGB',         'Allgemeine Geschäftsbedingungen'],
      ] as $datei => [$name, $was]): ?>
    <a class="kachel" href="rechtsseiten.php?d=<?= e($datei) ?>">
      <h3><?= e($name) ?></h3>
      <p><?= e($was) ?></p>
      <span class="kachel__fuss">Bearbeiten →</span>
    </a>
<?php endforeach; ?>
  </div>
</div>

<h2 class="gruppentitel">Werkzeuge</h2>

<div class="block">
  <div class="kacheln">
    <a class="kachel" href="sicherungen.php">
      <h3>Sicherungen</h3>
      <p><?= $sicher
            ? 'Letzte: ' . e(date('d.m.Y, H:i', $sicher[0]['zeit'])) . ' Uhr'
            : 'Noch keine – die erste entsteht beim ersten Speichern' ?></p>
      <span class="kachel__fuss">Öffnen →</span>
    </a>
    <a class="kachel" href="passwort.php">
      <h3>Passwort ändern</h3>
      <p>Zugang zur Verwaltung neu setzen</p>
      <span class="kachel__fuss">Öffnen →</span>
    </a>
  </div>
</div>

<?php fuss();
