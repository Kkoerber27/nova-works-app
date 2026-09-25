<?php
/* =========================================================================
   NOVA WORKS - Startseite
   Lädt die Inhalte und gibt die Vorlage aus. Mehr steht hier nicht;
   wer etwas ändern will, findet den Text in inhalt/inhalt.json und das
   Markup in vorlage/startseite.php.
   ========================================================================= */

/* Die Seite ändert sich nur, wenn jemand im Backend speichert. Browser
   und Zwischenspeicher sollen sie deshalb kurz behalten dürfen, aber
   jedes Mal nachfragen - so ist eine Änderung sofort draußen, ohne dass
   die Seite bei jedem Aufruf neu übertragen wird. */
/* Die Marke aus dem Inhalt selbst, nicht aus seinem Änderungsdatum:
   Dateizeiten haben nur Sekundenauflösung. Wer zweimal in derselben
   Sekunde speichert - beim Zurückholen einer Sicherung passiert genau
   das -, bekäme sonst zweimal dieselbe Marke, und ein Browser, der die
   erste Fassung hat, bliebe bei ihr. Eine Prüfsumme über 27 kB kostet
   nichts und ist eindeutig. */
$marke = '"' . md5(
      (string) @md5_file(__DIR__ . '/inhalt/inhalt.json')
    . (string) @filemtime(__DIR__ . '/vorlage/startseite.php')
    . (string) @filemtime(__DIR__ . '/assets/img/bilder.json')
  ) . '"';

header('ETag: ' . $marke);
header('Cache-Control: no-cache, must-revalidate');

if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $marke) {
    http_response_code(304);
    exit;
}

require __DIR__ . '/vorlage/startseite.php';
