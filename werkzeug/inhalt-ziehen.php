<?php
/* =========================================================================
   NOVA WORKS - Inhalte aus index.html herausziehen
   Einmaliger Umbau: Aus der handgeschriebenen index.html entsteht
   site/inhalt/inhalt.json. Ab dann ist die JSON-Datei maßgeblich und
   index.php baut die Seite daraus.

   Liegt im Repo, damit nachvollziehbar bleibt, woher die Inhalte kommen.
   Nach dem Umbau wird es nicht mehr gebraucht.
   ========================================================================= */

$wurzel = dirname(__DIR__);

/* Die Quelle kann auch aus der Git-Historie kommen:
       git show HEAD:site/index.html > /tmp/alt.html
       php werkzeug/inhalt-ziehen.php /tmp/alt.html
   Seit dem Umbau gibt es site/index.html nicht mehr - ohne diesen Weg
   wäre das Werkzeug nach dem ersten Lauf unbrauchbar. */
$quelle = $argv[1] ?? "$wurzel/site/index.html";
if (!is_file($quelle)) {
    fwrite(STDERR, "Quelle nicht gefunden: $quelle\n");
    exit(1);
}
$html = file_get_contents($quelle);

$dok = new DOMDocument();
libxml_use_internal_errors(true);
$dok->loadHTML('<?xml encoding="utf-8" ?>' . $html);
libxml_clear_errors();
$x = new DOMXPath($dok);

/* --- Helfer ---------------------------------------------------------- */

function text(?DOMNode $n): string {
    if (!$n) return '';
    /* Der Quelltext ist eingerückt; im JSON soll der Text in einer Zeile
       stehen. Geschützte Leerzeichen bleiben erhalten - sie sind Absicht
       (etwa "Frankfurt am Main"). */
    $t = $n->textContent;
    $t = str_replace("\xc2\xa0", '@@NBSP@@', $t);
    $t = trim(preg_replace('/\s+/u', ' ', $t));
    return str_replace('@@NBSP@@', "\u{00a0}", $t);
}

/* Innerer HTML-Inhalt, für Stellen mit Verweisen darin. */
function inneres(?DOMNode $n): string {
    if (!$n) return '';
    $s = '';
    foreach ($n->childNodes as $k) $s .= $k->ownerDocument->saveHTML($k);
    $s = str_replace("\xc2\xa0", '@@NBSP@@', $s);
    $s = trim(preg_replace('/\s+/u', ' ', $s));
    return str_replace('@@NBSP@@', "\u{00a0}", $s);
}

function erst(DOMXPath $x, string $pfad, ?DOMNode $ab = null): ?DOMNode {
    $t = $ab ? $x->query($pfad, $ab) : $x->query($pfad);
    return $t->length ? $t->item(0) : null;
}
function alle(DOMXPath $x, string $pfad, ?DOMNode $ab = null): array {
    $t = $ab ? $x->query($pfad, $ab) : $x->query($pfad);
    return iterator_to_array($t);
}
function attr(?DOMNode $n, string $a): string {
    return $n instanceof DOMElement ? $n->getAttribute($a) : '';
}
/* assets/img/live.jpg -> live */
function bildname(string $pfad): string {
    if (preg_match("~assets/img/([^'\"\\)]+)~", $pfad, $t)) {
        return pathinfo($t[1], PATHINFO_FILENAME);
    }
    return '';
}

$inhalt = [];

/* --- Meta & SEO ------------------------------------------------------ */

$inhalt['meta'] = [
    'sprache'     => attr(erst($x, '//html'), 'lang'),
    'titel'       => text(erst($x, '//title')),
    'beschreibung'=> attr(erst($x, '//meta[@name="description"]'), 'content'),
    'kanonisch'   => attr(erst($x, '//link[@rel="canonical"]'), 'href'),
    'themenfarbe' => attr(erst($x, '//meta[@name="theme-color"]'), 'content'),
    'og'          => [
        'titel'        => attr(erst($x, '//meta[@property="og:title"]'), 'content'),
        'beschreibung' => attr(erst($x, '//meta[@property="og:description"]'), 'content'),
        'seitenname'   => attr(erst($x, '//meta[@property="og:site_name"]'), 'content'),
        'url'          => attr(erst($x, '//meta[@property="og:url"]'), 'content'),
    ],
];

/* Die Organisationsangaben stehen als JSON-LD im Kopf. */
$ld = erst($x, '//script[@type="application/ld+json"]');
$inhalt['meta']['organisation'] = $ld ? json_decode($ld->textContent, true) : null;

/* --- Navigation ------------------------------------------------------ */

$inhalt['nav'] = ['punkte' => [], 'knopf' => []];
foreach (alle($x, '//nav[@class="nav"]/a') as $a) {
    $inhalt['nav']['punkte'][] = ['text' => text($a), 'ziel' => attr($a, 'href')];
}
$cta = erst($x, '//a[contains(@class,"masthead__cta")]');
$inhalt['nav']['knopf'] = ['text' => text($cta), 'ziel' => attr($cta, 'href')];

/* --- Hero ------------------------------------------------------------ */

$medium = erst($x, '//div[@class="hero__media"]');
$inhalt['hero'] = [
    'bild'      => bildname(attr($medium, 'style')),
    'zeilen'    => array_map(fn ($s) => text($s), alle($x, '//h1[@class="hero__title"]/span')),
    'vorspann'  => text(erst($x, '//p[@class="hero__lead"]')),
    'knopf'     => [
        'text' => text(erst($x, '//div[@class="hero__foot"]//span[@class="btn__label"]')),
        'ziel' => attr(erst($x, '//div[@class="hero__foot"]/a'), 'href'),
    ],
];

/* --- Über uns -------------------------------------------------------- */

$ueber = erst($x, '//section[@id="ueber-uns"]');
$inhalt['ueberUns'] = [
    'titel'     => text(erst($x, './/h2[@class="section__title"]', $ueber)),
    'absaetze'  => array_map(fn ($p) => inneres($p),
                             alle($x, './/div[@class="about__body"]/p[not(@class)]', $ueber)),
    'knopf'     => [
        'text' => text(erst($x, './/p[@class="about__cta"]//span[@class="btn__label"]', $ueber)),
        'ziel' => attr(erst($x, './/p[@class="about__cta"]/a', $ueber), 'href'),
    ],
    'gewerke'   => [
        'titel'      => text(erst($x, './/dl[contains(@class,"gewerke")]/dt', $ueber)),
        'leistungen' => text(erst($x, './/dl[contains(@class,"gewerke")]/dd', $ueber)),
    ],
];

/* --- Leistungen ------------------------------------------------------ */

$dienste = erst($x, '//section[@id="services"]');
$inhalt['leistungen'] = [
    'titel'  => text(erst($x, './/h2[@class="section__title"]', $dienste)),
    'karten' => [],
];
foreach (alle($x, './/article[@class="card"]', $dienste) as $k) {
    $inhalt['leistungen']['karten'][] = [
        'bild'  => bildname(attr(erst($x, './/div[@class="card__media"]', $k), 'style')),
        'titel' => text(erst($x, './/h3[@class="card__title"]', $k)),
        'text'  => text(erst($x, './/p[@class="card__text"]', $k)),
    ];
}

/* --- Referenzen ------------------------------------------------------ */

$refs = erst($x, '//section[@id="referenzen"]');
$inhalt['referenzen'] = [
    'titel'    => text(erst($x, './/h2[@class="section__title"]', $refs)),
    'projekte' => [],
];
foreach (alle($x, './/article[@class="ref"]', $refs) as $p) {
    $foto = erst($x, './/img[@class="ref__foto"]', $p);

    $bilder = [];
    foreach (alle($x, './/ul[@class="ref__bilder"]/li', $p) as $li) {
        $a = erst($x, './a', $li);
        $n = erst($x, './span[@class="ref__nachweis"]', $li);
        $bilder[] = [
            'bild'         => bildname(attr($a, 'href')),
            'beschreibung' => text($a),
            'nachweis'     => $n ? text($n) : '',
        ];
    }

    $inhalt['referenzen']['projekte'][] = [
        'ort'        => text(erst($x, './/p[@class="eyebrow"]', $p)),
        'titel'      => text(erst($x, './/h3[@class="ref__titel"]', $p)),
        /* object-position steht als style am Bild, wenn der Ausschnitt
           nachjustiert wurde. */
        'ausschnitt' => trim(str_replace('object-position:', '', attr($foto, 'style'))),
        'bilder'     => $bilder,
        'worum'      => array_map(fn ($q) => inneres($q),
                                  alle($x, './/div[@class="ref__worum"]/p', $p)),
        'unser'      => array_map(fn ($q) => inneres($q),
                                  alle($x, './/div[@class="ref__unser"]/p', $p)),
        'gewerke'    => [
            'titel'      => text(erst($x, './/dl[contains(@class,"gewerke")]/dt', $p)),
            'leistungen' => text(erst($x, './/dl[contains(@class,"gewerke")]/dd', $p)),
        ],
    ];
}

/* --- Kontakt --------------------------------------------------------- */

$kon = erst($x, '//section[@id="kontakt"]');
$felder = [];
foreach (alle($x, './/label[@class="field__label"]', $kon) as $l) {
    $felder[attr($l, 'for')] = trim(str_replace('*', '', text($l)));
}
$angaben = [];
foreach (alle($x, './/div[@class="detail"]', $kon) as $d) {
    $angaben[] = [
        'bezeichnung' => text(erst($x, './p[@class="detail__label"]', $d)),
        'wert'        => inneres(erst($x, './p[@class="detail__value"]', $d)),
    ];
}
$inhalt['kontakt'] = [
    'titel'        => text(erst($x, './/h2[@class="section__title"]', $kon)),
    'felder'       => $felder,
    'platzhalter'  => attr(erst($x, './/textarea', $kon), 'placeholder'),
    'kategorien'   => array_map(fn ($c) => attr($c, 'value'),
                                alle($x, './/input[@name="kategorie[]"]', $kon)),
    'einwilligung' => inneres(erst($x, './/label[@class="consent"]/span', $kon)),
    'knopf'        => text(erst($x, './/button[@type="submit"]//span[@class="btn__label"]', $kon)),
    'pflichthinweis' => text(erst($x, './/p[@class="form__hinweis"]', $kon)),
    'angaben'      => $angaben,
];

/* --- Footer ---------------------------------------------------------- */

$fuss = erst($x, '//footer[@class="footer"]');
$inhalt['fuss'] = [
    'copyright' => text(erst($x, './/p[@class="footer__meta"]/span', $fuss)),
    'links'     => array_map(fn ($a) => ['text' => text($a), 'ziel' => attr($a, 'href')],
                             alle($x, './/p[@class="footer__meta"]/a', $fuss)),
];

/* --- Einwilligung ----------------------------------------------------
   Diese Texte standen bisher fest in main.js. Sie wandern mit in die
   Inhaltsdatei, sonst wäre der eine Teil der Seite bearbeitbar und der
   andere nicht. */
$inhalt['einwilligung'] = [
    'titel'        => 'Ihre Entscheidung',
    'text'         => 'Diese Seite kommt ohne Cookies, ohne Analyse und ohne Inhalte von '
                    . 'fremden Servern aus. Es gibt zurzeit also nichts zu messen und nichts '
                    . 'nachzuladen. Sie können das hier trotzdem festlegen – nachzulesen in '
                    . 'der {datenschutz}.',
    'zustimmen'    => 'Zustimmen',
    'ablehnen'     => 'Ablehnen',
    'einstellungen'=> 'Einstellungen ansehen',
];

/* --- Schreiben -------------------------------------------------------
   Erst prüfen, dann schreiben. Ein Lauf gegen die falsche Datei liefert
   ein leeres Gerüst - und das über die gepflegte Inhaltsdatei zu
   schreiben, hat genau einmal gereicht. */
if (!$inhalt['referenzen']['projekte'] || !$inhalt['leistungen']['karten']
    || $inhalt['meta']['titel'] === '') {
    fwrite(STDERR,
        "Abbruch: In $quelle wurden keine Projekte, Leistungen oder kein Titel\n" .
        "gefunden. Die vorhandene inhalt.json bleibt unberührt.\n");
    exit(1);
}

$ziel = "$wurzel/site/inhalt/inhalt.json";
if (is_file($ziel)) {
    copy($ziel, $ziel . '.vorher');
    echo "Bisherige Fassung gesichert als inhalt.json.vorher\n";
}

@mkdir("$wurzel/site/inhalt", 0755, true);
file_put_contents("$wurzel/site/inhalt/inhalt.json",
    json_encode($inhalt, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

printf("inhalt.json geschrieben - %d Abschnitte, %d Projekte, %d Leistungen, %s\n",
    count($inhalt),
    count($inhalt['referenzen']['projekte']),
    count($inhalt['leistungen']['karten']),
    number_format(filesize("$wurzel/site/inhalt/inhalt.json") / 1024, 1) . ' kB');
