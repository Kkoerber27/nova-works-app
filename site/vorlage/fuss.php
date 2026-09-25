<?php
/* =========================================================================
   NOVA WORKS - Fuß jeder Seite
   ========================================================================= */

$i = inhalt();
$v = fassung();
$nurLesen = $nurLesen ?? false;
?>
<footer class="footer">
  <div class="shell footer__grid">
    <?= marke('footer__logo', 'klein') ?>
    <p class="footer__meta">
      <span><?= h($i['fuss']['copyright']) ?></span>
<?php foreach ($i['fuss']['links'] as $l): ?>
      <a href="<?= h($l['ziel']) ?>"><?= h($l['text']) ?></a>
<?php endforeach; ?>
    </p>
  </div>
</footer>

<!-- Die Texte des Einwilligungsfensters. Sie standen fest in main.js;
     damit waren sie der einzige Teil der Seite, den das Backend nicht
     erreicht hätte. Als JSON im Markup liest main.js sie aus, ohne dass
     etwas nachgeladen werden muss. -->
<?php
/* Die Adresse der Datenschutzerklärung kommt aus derselben Liste wie die
   Verweise in der Fußzeile. Vorher suchte main.js sie im Markt mit einem
   Selektor, in dem "datenschutz.html" fest stand - beim Umbau auf .php
   fand er nichts mehr und fiel auf die alte, tote Adresse zurück.
   Gefunden hat das die Prüfung, nicht ein Mensch. */
$datenschutzZiel = 'datenschutz.php';
foreach ($i['fuss']['links'] as $l) {
    if (stripos($l['ziel'], 'datenschutz') !== false) { $datenschutzZiel = $l['ziel']; break; }
}
$einwilligung = $i['einwilligung'];
$einwilligung['datenschutzZiel'] = $datenschutzZiel;
?>
<script type="application/json" id="einwilligung-texte"><?=
  json_encode($einwilligung, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP)
?></script>

<script src="/assets/js/main.js?v=<?= h($v) ?>" defer></script>
</body>
</html>
