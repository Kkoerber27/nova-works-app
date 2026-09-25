<?php
/* =========================================================================
   NOVA WORKS - Kopf und Fuß jeder Backend-Seite
   ========================================================================= */

function kopf(string $titel, string $aktiv = '', bool $schmal = false): void {
    $punkte = [
        ''              => ['Übersicht',   'index.php'],
        'mediathek'     => ['Mediathek',   'mediathek.php'],
        'rechtsseiten'  => ['Rechtsseiten','rechtsseiten.php'],
        'sicherungen'   => ['Sicherungen', 'sicherungen.php'],
    ];
    ?><!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= e($titel) ?> · Nova Works</title>
<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/admin.css?v=<?= e((string) @filemtime(ADMIN_WURZEL . '/assets/admin.css')) ?>">
</head>
<body>

<header class="kopf">
  <div class="kopf__innen">
    <a class="kopf__marke" href="index.php">
      <img src="../assets/img/logo-weiss.svg" alt="Nova Works">
      <span>Verwaltung</span>
    </a>
    <nav class="kopf__nav" aria-label="Bereiche">
<?php foreach ($punkte as $k => [$name, $ziel]): ?>
      <a href="<?= e($ziel) ?>"<?= $aktiv === $k ? ' aria-current="page"' : '' ?>><?= e($name) ?></a>
<?php endforeach; ?>
      <a href="../" target="_blank" rel="noopener">Website ansehen</a>
      <a href="abmelden.php">Abmelden</a>
    </nav>
  </div>
</header>

<main class="seite<?= $schmal ? ' seite--schmal' : '' ?>">
<?php
    $m = meldung_holen();
    if ($m) {
        printf('<div class="meldung meldung--%s" role="status">%s</div>',
               e($m['art']), e($m['text']));
    }
}

function fuss(): void {
    ?>
</main>
</body>
</html>
<?php
}
