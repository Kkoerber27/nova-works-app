<?php
/* =========================================================================
   NOVA WORKS - Abschnitt bearbeiten
   Ein Formular für alle neun Abschnitte. Was darin steht, sagt das Schema
   in kern/felder.php - diese Datei weiß von keinem einzelnen Feld etwas.
   ========================================================================= */

require __DIR__ . '/kern/start.php';
require __DIR__ . '/kern/felder.php';
require __DIR__ . '/kern/rahmen.php';
anmeldung_pflicht();

$alle    = abschnitte();
$name    = (string) ($_GET['a'] ?? '');
if (!isset($alle[$name])) { melden('fehler', 'Diesen Abschnitt gibt es nicht.'); weiter('index.php'); }
$schema  = $alle[$name];

$inhalt  = inhalt_laden();

/* --- Speichern ------------------------------------------------------- */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    merkmal_pruefen();

    $inhalt[$name] = felder_lesen($schema['felder'], $_POST['d'] ?? []);
    $ergebnis = inhalt_speichern($inhalt, $name);

    if ($ergebnis['ok']) {
        melden('gut', $schema['name'] . ' gespeichert. Die Änderung steht auf der Website.');
    } else {
        melden('fehler', $ergebnis['fehler']);
    }
    weiter('abschnitt.php?a=' . urlencode($name));
}

$wert = $inhalt[$name] ?? [];

/* --- Verfügbare Bilder für die Auswahlfelder ------------------------- */

$bildliste = [];
$verz = SEITEN_WURZEL . '/assets/img/bilder.json';
if (is_file($verz)) {
    foreach (json_decode((string) file_get_contents($verz), true) ?: [] as $bn => $b) {
        $gross = end($b['fassungen']);
        $bildliste[$bn] = $gross ? $gross['breite'] . '×' . $gross['hoehe'] : '';
    }
    ksort($bildliste);
}


/* =========================================================================
   Zeichnen
   ========================================================================= */

/* $pfad ist der Name im Formular, also etwa d[projekte][0][titel]. PHP
   baut daraus beim Empfangen von selbst ein verschachteltes Feld - genau
   die Form, die felder_lesen() erwartet. */
function zeichne(array $f, string $pfad, $wert, int $tiefe = 0): void {
    global $bildliste;
    $pf  = $pfad . '[' . $f['name'] . ']';
    $w   = $wert[$f['name']] ?? null;
    $id  = 'f' . substr(md5($pf), 0, 8);
    $hin = !empty($f['hinweis'])
        ? '<p class="feld__hinweis">' . $f['hinweis'] . '</p>' : '';

    switch ($f['art']) {

    case 'text':
        echo '<div class="feld"><label for="', $id, '">', e($f['bezeichnung']), '</label>', $hin,
             '<input class="eingabe" type="text" id="', $id, '" name="', e($pf), '"',
             ' value="', e((string) $w), '"></div>';
        break;

    case 'mehrzeilig':
    case 'html':
        echo '<div class="feld"><label for="', $id, '">', e($f['bezeichnung']), '</label>', $hin,
             '<textarea class="eingabe" id="', $id, '" name="', e($pf), '" rows="',
             (int) ($f['zeilen'] ?? 3), '">', e((string) $w), '</textarea></div>';
        break;

    case 'bild':
        $vorschau = $w ? '../assets/img/' . rawurlencode((string) $w) . '.jpg' : '';
        echo '<div class="feld"><span class="feld__name">', e($f['bezeichnung']), '</span>', $hin,
             '<div class="bildwahl">',
             '<span class="bildwahl__schau" data-schau', $vorschau
                ? ' style="background-image:url(\'' . e($vorschau) . '\')"></span>'
                : '>kein Bild</span>',
             '<span class="bildwahl__rest">',
             '<select class="eingabe" name="', e($pf), '" data-bildwahl>',
             '<option value="">– kein Bild –</option>';
        foreach ($bildliste as $bn => $masse) {
            echo '<option value="', e($bn), '"', $bn === $w ? ' selected' : '', '>',
                 e($bn), ' (', e($masse), ')</option>';
        }
        echo '</select>',
             '<p class="feld__hinweis">Fehlt ein Foto? In der ',
             '<a href="mediathek.php" target="_blank" rel="noopener">Mediathek</a> hochladen.</p>',
             '</span></div></div>';
        break;

    case 'textliste':
        $zeilen = is_array($w) ? $w : [];
        echo '<div class="feld" data-liste data-tiefe="', $tiefe, '">',
             '<span class="feld__name">', e($f['bezeichnung']), '</span>', $hin,
             '<div data-reihen>';
        foreach ($zeilen as $nr => $z) textzeile($pf, $nr, $z, $f);
        echo '</div>',
             '<template data-vorlage>'; textzeile($pf, '__I' . $tiefe . '__', '', $f); echo '</template>',
             '<p class="liste__zufuegen"><button class="taste taste--klein" type="button" data-zufuegen>',
             '+ hinzufügen</button></p></div>';
        break;

    case 'gruppe':
        echo '<div class="unterblock"><span class="feld__name">', e($f['bezeichnung']), '</span>', $hin;
        foreach ($f['felder'] as $u) zeichne($u, $pf, is_array($w) ? $w : [], $tiefe);
        echo '</div>';
        break;

    case 'liste':
        $zeilen = is_array($w) ? $w : [];
        $max    = $f['max'] ?? 0;
        echo '<div class="feld" data-liste data-tiefe="', $tiefe, '"',
             $max ? ' data-max="' . (int) $max . '"' : '', '>',
             '<span class="feld__name">', e($f['bezeichnung']),
             $max ? ' <span style="font-weight:400;color:var(--schrift-3)">(höchstens ' . (int) $max . ')</span>' : '',
             '</span>', $hin,
             '<div data-reihen>';
        foreach ($zeilen as $nr => $z) listenreihe($f, $pf, (string) $nr, $z, $tiefe);
        echo '</div>',
             '<template data-vorlage>';
             listenreihe($f, $pf, '__I' . $tiefe . '__', [], $tiefe);
        echo '</template>',
             '<p class="liste__zufuegen"><button class="taste taste--klein" type="button" data-zufuegen>',
             '+ ', e($f['bezeichnung']), ' hinzufügen</button></p></div>';
        break;
    }
}

function textzeile(string $pf, $nr, $wert, array $f): void {
    $mehr = !empty($f['html']) || mb_strlen((string) $wert) > 90;
    echo '<div class="reihe" data-reihe><div class="reihe__kopf">',
         '<span class="reihe__nr" data-nr></span>',
         '<span class="reihe__werkzeug">',
         '<button class="taste taste--klein taste--still" type="button" data-hoch>↑</button>',
         '<button class="taste taste--klein taste--still" type="button" data-runter>↓</button>',
         '<button class="taste taste--klein taste--gefahr" type="button" data-weg>Löschen</button>',
         '</span></div>';
    if ($mehr) {
        echo '<div class="feld"><textarea class="eingabe" name="', e($pf), '[', e((string) $nr), ']"',
             ' rows="4">', e((string) $wert), '</textarea></div>';
    } else {
        echo '<div class="feld"><input class="eingabe" type="text" name="', e($pf), '[', e((string) $nr), ']"',
             ' value="', e((string) $wert), '"></div>';
    }
    echo '</div>';
}

function listenreihe(array $f, string $pf, string $nr, $wert, int $tiefe): void {
    $titel = '';
    if (!empty($f['titelFeld']) && is_array($wert)) {
        $titel = mb_substr((string) ($wert[$f['titelFeld']] ?? ''), 0, 60);
    }
    echo '<div class="reihe" data-reihe><div class="reihe__kopf">',
         '<span class="reihe__nr" data-nr></span>',
         '<span class="reihe__titel">', e($titel), '</span>',
         '<span class="reihe__werkzeug">',
         '<button class="taste taste--klein taste--still" type="button" data-hoch>↑</button>',
         '<button class="taste taste--klein taste--still" type="button" data-runter>↓</button>',
         '<button class="taste taste--klein taste--gefahr" type="button" data-weg>Löschen</button>',
         '</span></div>';
    foreach ($f['felder'] as $u) {
        zeichne($u, $pf . '[' . $nr . ']', is_array($wert) ? $wert : [], $tiefe + 1);
    }
    echo '</div>';
}

kopf($schema['name'], '', true);
?>

<a class="zurueck" href="index.php">← Übersicht</a>

<div class="titelzeile">
  <div>
    <h1><?= e($schema['name']) ?></h1>
    <p><?= e($schema['beschreibung']) ?></p>
  </div>
  <div class="titelzeile__tasten">
    <a class="taste" href="../" target="_blank" rel="noopener">Website ansehen</a>
  </div>
</div>

<form method="post" id="formular">
  <?= merkmal_feld() ?>
  <div class="block">
<?php foreach ($schema['felder'] as $f) zeichne($f, 'd', $wert); ?>
  </div>

  <div class="speicherleiste">
    <button class="taste taste--stark" type="submit">Speichern</button>
    <a class="taste taste--still" href="index.php">Abbrechen</a>
    <p>Vor dem Speichern wird der bisherige Stand gesichert.</p>
  </div>
</form>

<script>
/* Listen: hinzufügen, löschen, verschieben.

   Die Feldnamen tragen ihre Nummer im Namen (…[projekte][2][titel]). Nach
   jeder Änderung werden alle Nummern neu durchgezählt - sonst entstünden
   nach dem Löschen Lücken, und PHP machte daraus ein Feld mit Schlüsseln
   statt einer Liste.

   Die Vorlage für eine neue Zeile steht als <template> im Markup. Der
   Platzhalter __I0__ / __I1__ trägt die Verschachtelungstiefe, damit eine
   Liste in einer Liste nicht die Nummern der äußeren überschreibt.        */
(function () {
  'use strict';

  function reihenVon(liste) {
    /* Nur die eigenen Reihen, nicht die der verschachtelten Listen. */
    return Array.prototype.filter.call(
      liste.querySelector('[data-reihen]').children,
      function (k) { return k.hasAttribute('data-reihe'); });
  }

  function neuZaehlen(liste) {
    var tiefe = liste.getAttribute('data-tiefe') || '0';
    /* Die Klammer dieser Liste: entweder eine Nummer oder der Platzhalter
       der eigenen Tiefe. In einer Zeichenkette braucht der Rückstrich
       genau eine Verdopplung - mit zweien traf das Muster einen echten
       Rückstrich im Namen, den es nie gibt, und der Platzhalter blieb
       stehen. Beim Speichern wäre daraus ein Eintrag namens "__I0__"
       geworden statt einer Liste. */
    var muster = new RegExp('\\[(\\d+|__I' + tiefe + '__)\\]');
    reihenVon(liste).forEach(function (reihe, nr) {
      var zaehler = reihe.querySelector('[data-nr]');
      if (zaehler) zaehler.textContent = String(nr + 1).padStart(2, '0');

      reihe.querySelectorAll('[name]').forEach(function (feld) {
        /* Nur die erste passende Klammer ersetzen - die gehört dieser
           Liste. Alles dahinter gehört einer inneren. */
        feld.name = feld.name.replace(muster, '[' + nr + ']');
      });
    });
    var knopf = liste.querySelector('[data-zufuegen]');
    var max = parseInt(liste.getAttribute('data-max') || '0', 10);
    if (knopf && max) knopf.disabled = reihenVon(liste).length >= max;
  }

  function naechsteListe(el) {
    return el.closest('[data-liste]');
  }

  document.addEventListener('click', function (e) {
    var ziel = e.target;

    if (ziel.matches('[data-zufuegen]')) {
      var liste = naechsteListe(ziel);
      var max = parseInt(liste.getAttribute('data-max') || '0', 10);
      if (max && reihenVon(liste).length >= max) return;
      var vorlage = liste.querySelector(':scope > [data-vorlage]');
      var neu = vorlage.content.cloneNode(true);
      liste.querySelector('[data-reihen]').appendChild(neu);
      neuZaehlen(liste);
      return;
    }

    if (ziel.matches('[data-weg]')) {
      var reihe = ziel.closest('[data-reihe]');
      var l = naechsteListe(reihe.parentNode);
      /* Nachfragen nur, wenn wirklich etwas drinsteht. */
      var gefuellt = Array.prototype.some.call(
        reihe.querySelectorAll('input, textarea, select'),
        function (f) { return f.value.trim() !== ''; });
      if (gefuellt && !confirm('Diesen Eintrag löschen?')) return;
      reihe.remove();
      neuZaehlen(l);
      return;
    }

    if (ziel.matches('[data-hoch], [data-runter]')) {
      var r = ziel.closest('[data-reihe]');
      var li = naechsteListe(r.parentNode);
      var nachbar = ziel.hasAttribute('data-hoch')
        ? r.previousElementSibling : r.nextElementSibling;
      if (!nachbar || !nachbar.hasAttribute('data-reihe')) return;
      if (ziel.hasAttribute('data-hoch')) nachbar.before(r); else nachbar.after(r);
      neuZaehlen(li);
      return;
    }
  });

  /* Die Bildvorschau folgt der Auswahl. */
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-bildwahl]')) return;
    var schau = e.target.closest('.bildwahl').querySelector('[data-schau]');
    if (!schau) return;
    if (e.target.value) {
      schau.style.backgroundImage = "url('../assets/img/" + encodeURIComponent(e.target.value) + ".jpg')";
      schau.textContent = '';
    } else {
      schau.style.backgroundImage = '';
      schau.textContent = 'kein Bild';
    }
  });

  document.querySelectorAll('[data-liste]').forEach(neuZaehlen);

  /* Warnen, wenn jemand mit ungespeicherten Änderungen weggeht. Das
     passiert leicht: Die Seite ist lang, und der Speichern-Knopf klebt
     zwar unten, aber der Zurück-Knopf des Browsers liegt näher. */
  var geaendert = false;
  var form = document.getElementById('formular');
  form.addEventListener('input', function () { geaendert = true; });
  form.addEventListener('submit', function () { geaendert = false; });
  window.addEventListener('beforeunload', function (e) {
    if (geaendert) { e.preventDefault(); e.returnValue = ''; }
  });
})();
</script>

<?php fuss();
