<?php
/* =========================================================================
   NOVA WORKS - Vorlage der Startseite
   Baut die Seite aus site/inhalt/inhalt.json. Wer den Text ändern will,
   ändert die JSON-Datei - von Hand oder über das Backend unter /admin.
   Wer das Markup ändern will, ändert diese Datei.

   Jeder Wert geht durch h() oder hh(), siehe helfer.php.
   ========================================================================= */

require_once __DIR__ . '/helfer.php';

$i = inhalt();
$v = fassung();

/* Wie breit die Bilder auf der Seite tatsächlich gezeigt werden. Diese
   Angaben entscheiden, welche Fassung der Browser lädt - stimmen sie
   nicht, lädt er zu groß oder zu klein. Die Werte kommen aus dem
   Stylesheet: --shell 1320 minus zweimal --gutter 64 ergibt 1192. */
$breitenProjekt  = '(max-width: 960px) 100vw, 1192px';
$breitenKarte    = '(max-width: 620px) calc(100vw - 4rem), (max-width: 960px) 45vw, 400px';
$breitenKopfbild = '100vw';
?>
<!doctype html>
<html lang="<?= h($i['meta']['sprache'] ?: 'de') ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<title><?= h($i['meta']['titel']) ?></title>
<meta name="description" content="<?= h($i['meta']['beschreibung']) ?>">
<link rel="canonical" href="<?= h($i['meta']['kanonisch']) ?>">
<meta name="theme-color" content="<?= h($i['meta']['themenfarbe']) ?>">

<meta property="og:type" content="website">
<meta property="og:locale" content="de_DE">
<meta property="og:site_name" content="<?= h($i['meta']['og']['seitenname']) ?>">
<meta property="og:title" content="<?= h($i['meta']['og']['titel']) ?>">
<meta property="og:description" content="<?= h($i['meta']['og']['beschreibung']) ?>">
<meta property="og:url" content="<?= h($i['meta']['og']['url']) ?>">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/img/favicon.svg">

<link rel="preload" href="assets/fonts/zalando-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/css/style.css?v=<?= h($v) ?>">

<?php if ($i['meta']['organisation']): ?>
<script type="application/ld+json">
<?= json_encode($i['meta']['organisation'],
      JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>

</script>
<?php endif; ?>
</head>

<body>
<a class="skip-link" href="#main">Zum Inhalt springen</a>
<div class="grain" aria-hidden="true"></div>

<header class="masthead" id="masthead">
  <div class="shell masthead__inner">
    <a class="masthead__logo" href="index.php" aria-label="Nova Works, zur Startseite">
      <img src="assets/img/logo-weiss.svg?v=<?= h($v) ?>" alt="Nova Works" width="170" height="57">
    </a>

    <nav class="nav" aria-label="Hauptnavigation">
<?php foreach ($i['nav']['punkte'] as $p): ?>
      <a class="nav__link" href="<?= h($p['ziel']) ?>"><?= h($p['text']) ?></a>
<?php endforeach; ?>
    </nav>

    <a class="btn masthead__cta" href="<?= h($i['nav']['knopf']['ziel']) ?>"><span class="btn__label"><?= h($i['nav']['knopf']['text']) ?></span></a>

    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-drawer">
      <span class="nav-toggle__bars" aria-hidden="true"></span>
      <span class="visually-hidden">Menü öffnen</span>
    </button>
  </div>
</header>

<div class="nav-drawer" id="nav-drawer" hidden>
<?php foreach ($i['nav']['punkte'] as $p): ?>
  <a href="<?= h($p['ziel']) ?>"><?= h($p['text']) ?></a>
<?php endforeach; ?>
  <a class="btn" href="<?= h($i['nav']['knopf']['ziel']) ?>"><span class="btn__label"><?= h($i['nav']['knopf']['text']) ?></span></a>
</div>

<main id="main">

  <!-- ================= Hero ================= -->
  <!-- Das Kopfbild ist ein echtes <img> und kein Hintergrundbild: Nur so
       kann der Browser über srcset die passende Breite wählen. Als
       Hintergrundbild lud er auf jedem Gerät dieselbe Datei. -->
  <section class="hero">
<?= bild($i['hero']['bild'], [
      'klasse' => 'hero__media', 'sizes' => $breitenKopfbild,
      'sofort' => true, 'ariaVersteckt' => true]) ?>

    <div class="shell hero__inner">
      <h1 class="hero__title">
<?php foreach ($i['hero']['zeilen'] as $z): ?>
        <span><?= h($z) ?></span>
<?php endforeach; ?>
      </h1>

      <div class="hero__foot">
        <p class="hero__lead"><?= hh($i['hero']['vorspann']) ?></p>
        <a class="btn btn--solid" href="<?= h($i['hero']['knopf']['ziel']) ?>"><span class="btn__label"><?= h($i['hero']['knopf']['text']) ?></span></a>
      </div>
    </div>
  </section>

  <!-- ================= Über uns ================= -->
  <section class="section" id="ueber-uns">
    <div class="shell">
      <div class="about__grid">
        <div>
          <h2 class="section__title"><?= h($i['ueberUns']['titel']) ?></h2>
        </div>

        <div class="about__body">
<?php foreach ($i['ueberUns']['absaetze'] as $a): ?>
          <p><?= hh($a) ?></p>
<?php endforeach; ?>
          <p class="about__cta">
            <a class="btn" href="<?= h($i['ueberUns']['knopf']['ziel']) ?>"><span class="btn__label"><?= h($i['ueberUns']['knopf']['text']) ?></span></a>
          </p>
        </div>
      </div>

      <dl class="gewerke gewerke--gross">
        <dt><?= h($i['ueberUns']['gewerke']['titel']) ?></dt>
        <dd><?= h($i['ueberUns']['gewerke']['leistungen']) ?></dd>
      </dl>
    </div>
  </section>

  <!-- ================= Leistungen ================= -->
  <section class="section section--raised" id="services">
    <div class="shell">
      <div class="section__head">
        <h2 class="section__title"><?= h($i['leistungen']['titel']) ?></h2>
      </div>

      <!-- Laufband: main.js zählt die Karten selbst und legt die Kopien
           für den Endloslauf an. Eine Karte mehr heißt: ein Eintrag mehr
           in der Inhaltsdatei, sonst nichts. -->
      <div class="slider" data-slider data-richtung="rechts"
           role="region" aria-label="Unsere Leistungsfelder" tabindex="0">
        <div class="slider__spur">
<?php foreach ($i['leistungen']['karten'] as $k): ?>

        <article class="card">
          <div class="card__rahmen">
<?= bild($k['bild'], ['klasse' => 'card__media', 'sizes' => $breitenKarte,
                      'ariaVersteckt' => true]) ?>
          </div>
          <h3 class="card__title"><?= h($k['titel']) ?></h3>
          <p class="card__text"><?= hh($k['text']) ?></p>
        </article>
<?php endforeach; ?>

        </div>
      </div>
    </div>
  </section>

  <!-- ================= Referenzen ================= -->
  <section class="section" id="referenzen">
    <div class="shell">
      <div class="section__head">
        <h2 class="section__title"><?= h($i['referenzen']['titel']) ?></h2>
      </div>

      <div class="refs">
<?php foreach ($i['referenzen']['projekte'] as $p):
        $ersteBilder = array_slice($p['bilder'], 0, 3);
        $rahmenbild  = $ersteBilder[0]['bild'] ?? '';
?>

        <article class="ref">
          <header class="ref__kopf">
            <p class="eyebrow"><?= h($p['ort']) ?></p>
            <h3 class="ref__titel"><?= h($p['titel']) ?></h3>
          </header>

          <div class="ref__media">
            <button class="ref__bild" type="button" data-lupe-auf>
<?= bild($rahmenbild, [
      'klasse' => 'ref__foto', 'sizes' => $breitenProjekt,
      'stil'   => $p['ausschnitt'] ? 'object-position:' . $p['ausschnitt'] : '']) ?>
              <span class="ref__zeichen" aria-hidden="true"></span>
              <span class="visually-hidden">Bilder zu „<?= h($p['titel']) ?>“ ansehen</span>
            </button>

            <!-- Die Galerie: höchstens drei Bilder, das erste ist das
                 sichtbare im Rahmen. main.js blendet die Liste aus und
                 macht das Bild oben zum Schalter; ohne JavaScript bleiben
                 es schlichte Verweise auf die Bilddateien. -->
            <ul class="ref__bilder" data-lupe-titel="<?= h($p['titel']) ?>">
<?php foreach ($ersteBilder as $b): ?>
              <li><a href="<?= h(bild_pfad($b['bild'])) ?>"><?= h($b['beschreibung']) ?></a><?php
                  if ($b['nachweis']): ?> <span class="ref__nachweis"><?= h($b['nachweis']) ?></span><?php
                  endif; ?></li>
<?php endforeach; ?>
            </ul>
          </div>

          <div class="ref__text">
            <div class="ref__worum">
<?php foreach ($p['worum'] as $a): ?>
              <p><?= hh($a) ?></p>
<?php endforeach; ?>
            </div>

            <div class="ref__unser">
<?php foreach ($p['unser'] as $a): ?>
              <p><?= hh($a) ?></p>
<?php endforeach; ?>
            </div>

            <dl class="gewerke">
              <dt><?= h($p['gewerke']['titel']) ?></dt>
              <dd><?= h($p['gewerke']['leistungen']) ?></dd>
            </dl>
          </div>
        </article>
<?php endforeach; ?>

      </div>
    </div>
  </section>

  <!-- ================= Kontakt ================= -->
  <section class="section" id="kontakt">
    <div class="shell">
      <div class="section__head">
        <h2 class="section__title"><?= h($i['kontakt']['titel']) ?></h2>
      </div>

      <div class="contact__grid">

        <!-- Formular. Ohne JavaScript postet es ganz normal an kontakt.php. -->
        <form id="kontaktformular" action="kontakt.php" method="post" novalidate>
<?php
  $f = $i['kontakt']['felder'];
  $pflicht = ' <span class="req" aria-hidden="true">*</span>';
?>
          <div class="form__row">
            <div class="field">
              <label class="field__label" for="vorname"><?= h($f['vorname']) . $pflicht ?></label>
              <input class="field__input" type="text" id="vorname" name="vorname"
                     autocomplete="given-name" required>
              <span class="field__error" id="err-vorname" role="alert"></span>
            </div>

            <div class="field">
              <label class="field__label" for="nachname"><?= h($f['nachname']) . $pflicht ?></label>
              <input class="field__input" type="text" id="nachname" name="nachname"
                     autocomplete="family-name" required>
              <span class="field__error" id="err-nachname" role="alert"></span>
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="unternehmen"><?= h($f['unternehmen']) ?></label>
            <input class="field__input" type="text" id="unternehmen" name="unternehmen"
                   autocomplete="organization">
          </div>

          <div class="form__row">
            <div class="field">
              <label class="field__label" for="email"><?= h($f['email']) . $pflicht ?></label>
              <input class="field__input" type="email" id="email" name="email"
                     autocomplete="email" required>
              <span class="field__error" id="err-email" role="alert"></span>
            </div>

            <div class="field">
              <label class="field__label" for="telefon"><?= h($f['telefon']) ?></label>
              <input class="field__input" type="tel" id="telefon" name="telefon"
                     autocomplete="tel">
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="nachricht"><?= h($f['nachricht']) . $pflicht ?></label>
            <textarea class="field__input" id="nachricht" name="nachricht" rows="6"
                      placeholder="<?= h($i['kontakt']['platzhalter']) ?>"
                      required></textarea>
            <span class="field__error" id="err-nachricht" role="alert"></span>
          </div>

          <fieldset class="field" style="border:0;padding:0;margin-inline:0">
            <legend class="field__label" style="padding:0">Kategorie</legend>
            <div class="chips">
<?php foreach ($i['kontakt']['kategorien'] as $k): ?>
              <label class="chip"><input type="checkbox" name="kategorie[]" value="<?= h($k) ?>"><span><?= h($k) ?></span></label>
<?php endforeach; ?>
            </div>
          </fieldset>

          <!-- Honigtopf gegen Bots. Bleibt für Menschen unsichtbar. -->
          <div class="honeypot" aria-hidden="true">
            <label for="website">Website</label>
            <input type="text" id="website" name="website" tabindex="-1" autocomplete="off">
          </div>

          <label class="consent">
            <input type="checkbox" name="datenschutz" id="datenschutz" value="1" required>
            <span><?= hh($i['kontakt']['einwilligung']) ?></span>
          </label>
          <span class="field__error" id="err-datenschutz" role="alert"></span>

          <button class="btn btn--solid" type="submit"><span class="btn__label"><?= h($i['kontakt']['knopf']) ?></span></button>

          <div class="form__status" id="form-status" role="status" hidden></div>

          <p class="form__note">Felder mit <span aria-hidden="true">*</span> sind Pflichtfelder.</p>
        </form>

        <!-- Kontaktdaten -->
        <div class="contact__details">
<?php foreach ($i['kontakt']['angaben'] as $a): ?>
          <div class="detail">
            <p class="detail__label"><?= h($a['bezeichnung']) ?></p>
            <p class="detail__value"><?= hh($a['wert']) ?></p>
          </div>
<?php endforeach; ?>
        </div>

      </div>
    </div>
  </section>

</main>

<!-- ================= Großansicht der Projektbilder =================
     Ein natives <dialog>. Das bringt drei Dinge mit, die man sonst von
     Hand bauen müsste und dabei leicht falsch baut: Escape schließt, der
     Fokus bleibt drin, und beim Schließen springt er dorthin zurück, wo
     er herkam. main.js füllt Bild, Zeile und Zähler.               -->
<dialog class="lupe" data-lupe aria-label="Bilder zum Projekt">
  <div class="lupe__rahmen">
    <button class="lupe__knopf lupe__zu" type="button" data-lupe-zu>
      <span class="visually-hidden">Schließen</span>
    </button>

    <button class="lupe__knopf lupe__blaettern lupe__zurueck" type="button" data-lupe-schritt="-1">
      <span class="visually-hidden">Vorheriges Bild</span>
    </button>

    <figure class="lupe__figur">
      <img class="lupe__bild" data-lupe-bild alt="">
      <figcaption class="lupe__zeile">
        <span class="lupe__titel" data-lupe-titel></span>
        <span class="lupe__nachweis" data-lupe-nachweis hidden></span>
        <span class="lupe__zaehler" data-lupe-zaehler></span>
      </figcaption>
    </figure>

    <button class="lupe__knopf lupe__blaettern lupe__vor" type="button" data-lupe-schritt="1">
      <span class="visually-hidden">Nächstes Bild</span>
    </button>
  </div>
</dialog>

<footer class="footer">
  <div class="shell footer__grid">
    <a class="footer__logo" href="index.php" aria-label="Nova Works, zur Startseite">
      <img src="assets/img/logo-weiss.svg?v=<?= h($v) ?>" alt="Nova Works" width="140" height="47" loading="lazy">
    </a>
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
<script type="application/json" id="einwilligung-texte"><?=
  json_encode($i['einwilligung'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP)
?></script>

<script src="assets/js/main.js?v=<?= h($v) ?>" defer></script>
</body>
</html>
