<?php
/* =========================================================================
   NOVA WORKS - Seite nicht gefunden
   ========================================================================= */

$seitenTitel = 'Seite nicht gefunden · Nova Works';
$seitenText  = '';
$nurLesen    = true;
http_response_code(404);
require __DIR__ . '/vorlage/kopf.php';
?>
<main id="main">
  <section class="legal">
    <div class="shell">
      <div class="legal__inner">
        <h1>Diese Seite gibt es nicht.</h1>
        <p>
          Der Link ist veraltet oder enthält einen Tippfehler. Von hier kommen Sie zurück
          auf die Startseite oder direkt zum Kontakt.
        </p>
        <p style="margin-top:2.5rem;display:flex;flex-wrap:wrap;gap:1rem">
          <a class="btn" href="/"><span class="btn__label">Zur Startseite</span></a>
          <a class="btn btn--ghost" href="/#kontakt"><span class="btn__label">Kontakt</span></a>
        </p>
      </div>
    </div>
  </section>
</main>
<?php require __DIR__ . '/vorlage/fuss.php';
