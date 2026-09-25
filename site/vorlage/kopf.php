<?php
/* =========================================================================
   NOVA WORKS - Kopf jeder Seite
   Kopfbereich, Navigation und Schubfach. Eingebunden von der Startseite
   und von den Rechtsseiten - vorher stand dieses Markup in fünf Dateien
   nebeneinander, und beim Ändern des Logos fiel genau das auf.

   Alle Verweise sind absolut, beginnen also mit einem Schrägstrich.
   Grund ist die Fehlerseite: Sie wird unter jedem beliebigen Pfad
   ausgeliefert - bei /produkte/led-wand landet der Browser sonst bei
   /produkte/assets/css/style.css und bekommt eine Seite ohne Gestaltung,
   ohne Schrift und ohne Skript. Das setzt voraus, dass die Seite im
   Wurzelverzeichnis der Domain liegt; genau so ist sie gedacht (siehe
   docs/hosting.md).

   Erwartet vorher gesetzt:
     $seitenTitel        <title> der Seite
     $seitenText         Beschreibung für Suchmaschinen (optional)
     $nurLesen           true auf Rechtsseiten: kein Vorspann-Auftritt
   ========================================================================= */

require_once __DIR__ . '/helfer.php';

$i = inhalt();
$v = fassung();
$seitenTitel = $seitenTitel ?? ($i['meta']['titel'] ?? 'Nova Works');
$seitenText  = $seitenText  ?? ($i['meta']['beschreibung'] ?? '');
$nurLesen    = $nurLesen    ?? false;
?>
<!doctype html>
<html lang="<?= h($i['meta']['sprache'] ?: 'de') ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title><?= h($seitenTitel) ?></title>
<?php if ($seitenText): ?>
<meta name="description" content="<?= h($seitenText) ?>">
<?php endif; ?>
<?= $kopfExtra ?? '' ?>

<link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/img/favicon.svg">

<link rel="preload" href="/assets/fonts/zalando-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/style.css?v=<?= h($v) ?>">
</head>

<body<?= $nurLesen ? ' class="seite--recht"' : '' ?>>
<a class="skip-link" href="#main">Zum Inhalt springen</a>
<div class="grain" aria-hidden="true"></div>

<header class="masthead" id="masthead">
  <div class="shell masthead__inner">
    <?= marke('masthead__logo', 'gross') ?>

    <nav class="nav" aria-label="Hauptnavigation">
<?php foreach ($i['nav']['punkte'] as $p): ?>
      <a class="nav__link" href="<?= h(zielAufStartseite($p['ziel'], $nurLesen)) ?>"><?= h($p['text']) ?></a>
<?php endforeach; ?>
    </nav>

    <a class="btn masthead__cta" href="<?= h(zielAufStartseite($i['nav']['knopf']['ziel'], $nurLesen)) ?>"><span class="btn__label"><?= h($i['nav']['knopf']['text']) ?></span></a>

    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-drawer">
      <span class="nav-toggle__bars" aria-hidden="true"></span>
      <span class="visually-hidden">Menü öffnen</span>
    </button>
  </div>
</header>

<div class="nav-drawer" id="nav-drawer" hidden>
<?php foreach ($i['nav']['punkte'] as $p): ?>
  <a href="<?= h(zielAufStartseite($p['ziel'], $nurLesen)) ?>"><?= h($p['text']) ?></a>
<?php endforeach; ?>
  <a class="btn" href="<?= h(zielAufStartseite($i['nav']['knopf']['ziel'], $nurLesen)) ?>"><span class="btn__label"><?= h($i['nav']['knopf']['text']) ?></span></a>
</div>
