<?php
/* =========================================================================
   NOVA WORKS - Helfer für die Vorlagen
   Alles, was beim Bauen der Seite mehrfach gebraucht wird. Kein Framework,
   keine Bibliothek - die Seite hat neun Abschnitte, da wäre eines mehr
   Aufwand als Nutzen.
   ========================================================================= */

/* Alles, was aus der Inhaltsdatei kommt, geht durch eine dieser beiden
   Funktionen, bevor es im HTML landet. Wer eine neue Stelle in der
   Vorlage anlegt und das vergisst, öffnet ein Loch: Ein Text mit einem
   < darin würde das Markup zerreißen, und im Backend kann jeder Text
   geändert werden. */

/* Für reinen Text. */
function h(?string $s): string {
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/* Für Felder, in denen Verweise erlaubt sind - etwa der Einwilligungssatz
   im Formular oder ein Absatz mit einem Link darin. Erlaubt ist eine
   kurze Liste; alles andere fliegt raus. Bewusst kein "Rich Text": Je
   mehr erlaubt ist, desto mehr kann eine Seite kaputtgehen, ohne dass
   es jemand merkt. */
function hh(?string $s): string {
    $erlaubt = '<a><strong><em><br><span>';
    $rein = strip_tags((string) $s, $erlaubt);

    /* strip_tags lässt Attribute stehen - auch onclick. Deshalb werden
       alle Attribute entfernt und nur href/class wieder eingesetzt. */
    $rein = preg_replace_callback('~<a\s+([^>]*)>~i', function ($t) {
        preg_match('~href\s*=\s*"([^"]*)"~i', $t[1], $hr);
        $ziel = $hr[1] ?? '';
        /* javascript: und data: sind die beiden Wege, über einen Verweis
           Code auszuführen. */
        if (preg_match('~^\s*(javascript|data|vbscript):~i', $ziel)) $ziel = '';
        return '<a href="' . h($ziel) . '">';
    }, $rein);
    $rein = preg_replace('~<(strong|em|br|span)\s+[^>]*>~i', '<$1>', $rein);

    return $rein;
}


/* =========================================================================
   Bilder
   ========================================================================= */

/* Das Verzeichnis, das werkzeug/bilder-neu.php schreibt: je Bild alle
   erzeugten Breiten. Einmal geladen, nicht je Aufruf. */
function bild_verzeichnis(): array {
    static $v = null;
    if ($v === null) {
        $p = __DIR__ . '/../assets/img/bilder.json';
        $v = is_file($p) ? (json_decode(file_get_contents($p), true) ?: []) : [];
    }
    return $v;
}

/* Baut ein <picture> mit allen WebP-Breiten und einem JPEG darunter.

   Warum <picture> und nicht nur <img srcset>: Der JPEG-Rückfall ist eine
   Frage des Formats, nicht der Größe. In einem <source type="image/webp">
   steht die ganze Staffel; kann ein Browser kein WebP, überspringt er die
   Quelle und nimmt das <img>. Mit srcset am <img> allein ginge das nicht.

   $sizes sagt dem Browser, wie breit das Bild auf der Seite sein wird -
   ohne diese Angabe nimmt er 100vw an und lädt am Laptop die 2560er
   Fassung für ein Bild, das 420 Pixel breit gezeigt wird.

   Fehlt das Bild im Verzeichnis, kommt nichts zurück statt eines kaputten
   Verweises. Ein fehlendes Foto soll eine Lücke sein, kein Bildsymbol. */
function bild(string $name, array $opt = []): string {
    $v = bild_verzeichnis();
    if ($name === '' || !isset($v[$name]['fassungen'])) return '';

    $fassungen = $v[$name]['fassungen'];
    if (!$fassungen) return '';

    $quellen = [];
    foreach ($fassungen as $f) {
        $quellen[] = "assets/img/$name-{$f['breite']}.webp {$f['breite']}w";
    }
    $groesste = end($fassungen);

    $attribute = [
        'src'      => "assets/img/$name.jpg",
        'width'    => $groesste['breite'],
        'height'   => $groesste['hoehe'],
        'alt'      => $opt['alt'] ?? '',
        'decoding' => 'async',
    ];
    if (!empty($opt['klasse'])) $attribute['class'] = $opt['klasse'];
    if (!empty($opt['stil']))   $attribute['style'] = $opt['stil'];

    /* Das Kopfbild ist das Erste, was man sieht - es darf nicht warten.
       Alles andere lädt erst beim Heranscrollen. */
    if (empty($opt['sofort'])) {
        $attribute['loading'] = 'lazy';
    } else {
        $attribute['fetchpriority'] = 'high';
    }
    if (!empty($opt['ariaVersteckt'])) $attribute['aria-hidden'] = 'true';

    $a = '';
    foreach ($attribute as $k => $w) $a .= ' ' . $k . '="' . h((string) $w) . '"';

    $sizes = $opt['sizes'] ?? '100vw';

    return '<picture>'
         . '<source type="image/webp" srcset="' . h(implode(', ', $quellen)) . '"'
         . ' sizes="' . h($sizes) . '">'
         . '<img' . $a . '>'
         . '</picture>';
}

/* Nur der Pfad, für Stellen ohne <picture> - etwa die Galerie-Liste, die
   ohne JavaScript ein schlichter Verweis auf die Bilddatei bleibt. */
function bild_pfad(string $name, int $breite = 2560): string {
    $v = bild_verzeichnis();
    if (!isset($v[$name]['fassungen'])) return '';
    $beste = null;
    foreach ($v[$name]['fassungen'] as $f) {
        if ($beste === null || abs($f['breite'] - $breite) < abs($beste - $breite)) {
            $beste = $f['breite'];
        }
    }
    return $beste ? "assets/img/$name-$beste.webp" : '';
}


/* =========================================================================
   Inhalt laden
   ========================================================================= */

function inhalt(): array {
    static $i = null;
    if ($i === null) {
        $p = __DIR__ . '/../inhalt/inhalt.json';
        $i = is_file($p) ? (json_decode(file_get_contents($p), true) ?: []) : [];
    }
    return $i;
}

/* Greift mit Punktschreibweise in den Inhalt: feld('hero.vorspann').
   Fehlt der Pfad, kommt der Ersatzwert - die Seite soll an einer Lücke
   nicht mit einem PHP-Fehler stehenbleiben. */
function feld(string $pfad, $ersatz = '') {
    $wert = inhalt();
    foreach (explode('.', $pfad) as $teil) {
        if (!is_array($wert) || !array_key_exists($teil, $wert)) return $ersatz;
        $wert = $wert[$teil];
    }
    return $wert;
}

/* Die Fassung für die Adresszeile hinter CSS, JS und Logo. Sie steigt mit
   jeder Änderung an einer der Dateien, damit Browser und Zwischenspeicher
   die neue Fassung holen, statt die alte zu behalten. Berechnet aus dem
   Änderungsdatum - so kann niemand vergessen, sie hochzuzählen. */
function fassung(): string {
    static $f = null;
    if ($f === null) {
        $zeiten = [0];
        foreach (['/../assets/css/style.css', '/../assets/js/main.js'] as $d) {
            if (is_file(__DIR__ . $d)) $zeiten[] = filemtime(__DIR__ . $d);
        }
        $f = (string) max($zeiten);
    }
    return $f;
}
