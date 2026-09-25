<?php
/* =========================================================================
   NOVA WORKS - Feldschema des Backends

   Hier steht, welche Abschnitte es gibt und welche Felder darin. Die
   Editorseite baut sich daraus selbst - es gibt also kein Formular pro
   Abschnitt, das man beim Ändern vergessen könnte.

   Das Schema ist zugleich der Filter beim Speichern: Übernommen wird nur,
   was hier steht. Ein Feld, das jemand von Hand ins Formular schmuggelt,
   landet nicht in der Inhaltsdatei.

   Feldarten:
     text        einzeilig
     mehrzeilig  Textfeld über mehrere Zeilen
     html        wie mehrzeilig, erlaubt <a> <strong> <em> <br>
     bild        Auswahl aus der Mediathek
     textliste   beliebig viele einzelne Texte (Absätze, Zeilen)
     gruppe      feste Untergliederung
     liste       beliebig viele gleich gebaute Einträge
   ========================================================================= */

function abschnitte(): array {
    return [

    'meta' => [
        'name'        => 'Meta & SEO',
        'beschreibung'=> 'Seitentitel, Beschreibung, Sprache',
        'felder'      => [
            ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Seitentitel',
             'hinweis' => 'Steht im Browser-Reiter und als Überschrift im Suchergebnis. '
                        . 'Etwa 55 Zeichen werden angezeigt.'],
            ['art' => 'mehrzeilig', 'name' => 'beschreibung', 'bezeichnung' => 'Beschreibung',
             'zeilen' => 3,
             'hinweis' => 'Der Text unter dem Suchergebnis. Etwa 155 Zeichen.'],
            ['art' => 'text', 'name' => 'sprache', 'bezeichnung' => 'Sprache',
             'hinweis' => 'Sprachkürzel der Seite, für Deutsch: de'],
            ['art' => 'text', 'name' => 'kanonisch', 'bezeichnung' => 'Kanonische Adresse',
             'hinweis' => 'Die eine richtige Adresse dieser Seite. Sagt Suchmaschinen, '
                        . 'welche Fassung zählt, wenn es mehrere Wege dorthin gibt.'],
            ['art' => 'text', 'name' => 'themenfarbe', 'bezeichnung' => 'Themenfarbe',
             'hinweis' => 'Färbt die Leiste des Browsers am Handy. Als Hex-Wert, etwa #0b0b0c'],
            ['art' => 'gruppe', 'name' => 'og', 'bezeichnung' => 'Vorschau beim Teilen',
             'hinweis' => 'Was erscheint, wenn jemand den Link in WhatsApp, LinkedIn '
                        . 'oder Facebook einfügt.',
             'felder' => [
                ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Titel'],
                ['art' => 'mehrzeilig', 'name' => 'beschreibung', 'bezeichnung' => 'Beschreibung', 'zeilen' => 2],
                ['art' => 'text', 'name' => 'seitenname', 'bezeichnung' => 'Name der Seite'],
                ['art' => 'text', 'name' => 'url', 'bezeichnung' => 'Adresse'],
             ]],
        ],
    ],

    'nav' => [
        'name'        => 'Navigation',
        'beschreibung'=> 'Menüpunkte und der Knopf oben rechts',
        'felder'      => [
            ['art' => 'liste', 'name' => 'punkte', 'bezeichnung' => 'Menüpunkte',
             'titelFeld' => 'text',
             'hinweis' => 'Ein Ziel, das mit # beginnt, springt zu einem Abschnitt '
                        . 'derselben Seite. Alles andere ist ein Verweis auf eine andere Datei.',
             'felder' => [
                ['art' => 'text', 'name' => 'text', 'bezeichnung' => 'Beschriftung'],
                ['art' => 'text', 'name' => 'ziel', 'bezeichnung' => 'Ziel'],
             ]],
            ['art' => 'gruppe', 'name' => 'knopf', 'bezeichnung' => 'Knopf',
             'felder' => [
                ['art' => 'text', 'name' => 'text', 'bezeichnung' => 'Beschriftung'],
                ['art' => 'text', 'name' => 'ziel', 'bezeichnung' => 'Ziel'],
             ]],
        ],
    ],

    'hero' => [
        'name'        => 'Hero-Bereich',
        'beschreibung'=> 'Kopfbild, Claim und Knopf ganz oben',
        'felder'      => [
            ['art' => 'bild', 'name' => 'bild', 'bezeichnung' => 'Kopfbild',
             'hinweis' => 'Das einzige Bild, das sofort geladen wird. Es sollte quer '
                        . 'und mindestens 2560 Pixel breit sein.'],
            ['art' => 'textliste', 'name' => 'zeilen', 'bezeichnung' => 'Claim, Zeile für Zeile',
             'hinweis' => 'Jede Zeile wird ein eigener Block und fährt beim Aufruf einzeln '
                        . 'herein. Wo genau umbrochen wird, entscheidet die Fensterbreite.'],
            ['art' => 'html', 'name' => 'vorspann', 'bezeichnung' => 'Vorspann', 'zeilen' => 4],
            ['art' => 'gruppe', 'name' => 'knopf', 'bezeichnung' => 'Knopf',
             'felder' => [
                ['art' => 'text', 'name' => 'text', 'bezeichnung' => 'Beschriftung'],
                ['art' => 'text', 'name' => 'ziel', 'bezeichnung' => 'Ziel'],
             ]],
        ],
    ],

    'ueberUns' => [
        'name'        => 'Über uns',
        'beschreibung'=> 'Überschrift, Text und die Gewerke-Zeile',
        'felder'      => [
            ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Überschrift'],
            ['art' => 'textliste', 'name' => 'absaetze', 'bezeichnung' => 'Absätze', 'html' => true],
            ['art' => 'gruppe', 'name' => 'knopf', 'bezeichnung' => 'Knopf', 'felder' => [
                ['art' => 'text', 'name' => 'text', 'bezeichnung' => 'Beschriftung'],
                ['art' => 'text', 'name' => 'ziel', 'bezeichnung' => 'Ziel'],
            ]],
        ],
    ],

    'gewerke' => [
        'name'        => 'Gewerke',
        'beschreibung'=> 'Die Tafel mit den Erläuterungen',
        'felder'      => [
            ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Überschrift'],
            ['art' => 'mehrzeilig', 'name' => 'vorspann', 'bezeichnung' => 'Vorspann', 'zeilen' => 2],
            ['art' => 'liste', 'name' => 'eintraege', 'bezeichnung' => 'Gewerke',
             'titelFeld' => 'name',
             'hinweis' => 'Die Reihenfolge ist die auf der Seite. Sie hängen an einer '
                        . 'durchgehenden Linie – je Reihe drei, am Handy eines unter '
                        . 'dem anderen.',
             'felder' => [
                ['art' => 'text', 'name' => 'name', 'bezeichnung' => 'Gewerk'],
                ['art' => 'mehrzeilig', 'name' => 'was', 'bezeichnung' => 'Was gehört dazu?', 'zeilen' => 3,
                 'hinweis' => 'Zwei Sätze. Was das Gewerk umfasst – nicht, was auf einer '
                            . 'bestimmten Produktion gemacht wurde. Das steht beim Projekt.'],
             ]],
        ],
    ],

    'leistungen' => [
        'name'        => 'Leistungen',
        'beschreibung'=> 'Die Karten im Laufband',
        'felder'      => [
            ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Überschrift'],
            ['art' => 'liste', 'name' => 'karten', 'bezeichnung' => 'Karten', 'titelFeld' => 'titel',
             'felder' => [
                ['art' => 'bild', 'name' => 'bild', 'bezeichnung' => 'Foto'],
                ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Titel'],
                ['art' => 'mehrzeilig', 'name' => 'text', 'bezeichnung' => 'Text', 'zeilen' => 3],
             ]],
        ],
    ],

    'referenzen' => [
        'name'        => 'Referenzen',
        'beschreibung'=> 'Die Projekte mit Fotos, Text und Gewerken',
        'felder'      => [
            ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Überschrift'],
            ['art' => 'liste', 'name' => 'projekte', 'bezeichnung' => 'Projekte', 'titelFeld' => 'titel',
             'felder' => [
                ['art' => 'text', 'name' => 'ort', 'bezeichnung' => 'Ort oder Anlass',
                 'hinweis' => 'Die kleine Zeile über dem Projektnamen.'],
                ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Projektname'],
                ['art' => 'liste', 'name' => 'bilder', 'bezeichnung' => 'Fotos', 'max' => 3,
                 'titelFeld' => 'beschreibung',
                 'hinweis' => 'Höchstens drei. Das erste ist das große im Rahmen, alle '
                            . 'zusammen bilden die Großansicht.',
                 'felder' => [
                    ['art' => 'bild', 'name' => 'bild', 'bezeichnung' => 'Foto'],
                    ['art' => 'mehrzeilig', 'name' => 'beschreibung', 'bezeichnung' => 'Bildbeschreibung', 'zeilen' => 2,
                     'hinweis' => 'Was ist zu sehen? Der Text wird vorgelesen und steht '
                                . 'in der Großansicht unter dem Bild.'],
                    ['art' => 'text', 'name' => 'nachweis', 'bezeichnung' => 'Bildnachweis',
                     'hinweis' => 'Nur ausfüllen, wenn das Foto genannt werden muss.'],
                 ]],
                ['art' => 'text', 'name' => 'ausschnitt', 'bezeichnung' => 'Bildausschnitt',
                 'hinweis' => 'Nur nötig, wenn das große Foto im Rahmen falsch sitzt. '
                            . 'Zum Beispiel: center 28%  – kleinere Prozente zeigen mehr vom oberen Rand.'],
                ['art' => 'textliste', 'name' => 'worum', 'bezeichnung' => 'Worum ging es?', 'html' => true,
                 'hinweis' => 'Die Veranstaltung - was, wo, wann, wer.'],
                ['art' => 'textliste', 'name' => 'unser', 'bezeichnung' => 'Was hat Nova Works gemacht?', 'html' => true],
                ['art' => 'gruppe', 'name' => 'gewerke', 'bezeichnung' => 'Gewerke', 'felder' => [
                    ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Bezeichnung links'],
                    ['art' => 'mehrzeilig', 'name' => 'leistungen', 'bezeichnung' => 'Leistungen', 'zeilen' => 2],
                ]],
             ]],
        ],
    ],

    'kontakt' => [
        'name'        => 'Kontakt',
        'beschreibung'=> 'Formular-Beschriftungen und Kontaktdaten',
        'felder'      => [
            ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Überschrift'],
            ['art' => 'gruppe', 'name' => 'felder', 'bezeichnung' => 'Beschriftungen im Formular',
             'felder' => [
                ['art' => 'text', 'name' => 'vorname',     'bezeichnung' => 'Vorname'],
                ['art' => 'text', 'name' => 'nachname',    'bezeichnung' => 'Nachname'],
                ['art' => 'text', 'name' => 'unternehmen', 'bezeichnung' => 'Unternehmen'],
                ['art' => 'text', 'name' => 'email',       'bezeichnung' => 'E-Mail'],
                ['art' => 'text', 'name' => 'telefon',     'bezeichnung' => 'Telefon'],
                ['art' => 'text', 'name' => 'nachricht',   'bezeichnung' => 'Nachricht'],
             ]],
            ['art' => 'mehrzeilig', 'name' => 'platzhalter', 'bezeichnung' => 'Platzhalter im Nachrichtenfeld', 'zeilen' => 2],
            ['art' => 'textliste', 'name' => 'kategorien', 'bezeichnung' => 'Kategorien zum Ankreuzen'],
            ['art' => 'html', 'name' => 'einwilligung', 'bezeichnung' => 'Einwilligungssatz', 'zeilen' => 4,
             'hinweis' => 'Rechtstext. Hier steht der Verweis auf die Datenschutzerklärung - '
                        . 'bitte nur ändern, wenn klar ist, was geändert wird.'],
            ['art' => 'text', 'name' => 'knopf', 'bezeichnung' => 'Beschriftung des Absende-Knopfs'],
            ['art' => 'liste', 'name' => 'angaben', 'bezeichnung' => 'Kontaktdaten rechts',
             'titelFeld' => 'bezeichnung',
             'felder' => [
                ['art' => 'text', 'name' => 'bezeichnung', 'bezeichnung' => 'Bezeichnung'],
                ['art' => 'html', 'name' => 'wert', 'bezeichnung' => 'Angabe', 'zeilen' => 2,
                 'hinweis' => 'Verweise sind erlaubt, etwa &lt;a href="mailto:..."&gt;.'],
             ]],
        ],
    ],

    'fuss' => [
        'name'        => 'Footer',
        'beschreibung'=> 'Copyright und die Rechts-Links',
        'felder'      => [
            ['art' => 'text', 'name' => 'copyright', 'bezeichnung' => 'Copyright-Zeile'],
            ['art' => 'liste', 'name' => 'links', 'bezeichnung' => 'Verweise', 'titelFeld' => 'text',
             'felder' => [
                ['art' => 'text', 'name' => 'text', 'bezeichnung' => 'Beschriftung'],
                ['art' => 'text', 'name' => 'ziel', 'bezeichnung' => 'Ziel'],
             ]],
        ],
    ],

    'einwilligung' => [
        'name'        => 'Einwilligungs-Fenster',
        'beschreibung'=> 'Text und Knöpfe beim ersten Aufruf',
        'felder'      => [
            ['art' => 'text', 'name' => 'titel', 'bezeichnung' => 'Überschrift'],
            ['art' => 'mehrzeilig', 'name' => 'text', 'bezeichnung' => 'Text', 'zeilen' => 5,
             'hinweis' => 'Die Stelle {datenschutz} wird durch den Verweis auf die '
                        . 'Datenschutzerklärung ersetzt. Bitte stehen lassen.'],
            ['art' => 'text', 'name' => 'zustimmen', 'bezeichnung' => 'Knopf: zustimmen'],
            ['art' => 'text', 'name' => 'ablehnen', 'bezeichnung' => 'Knopf: ablehnen'],
            ['art' => 'text', 'name' => 'einstellungen', 'bezeichnung' => 'Knopf: Einstellungen'],
        ],
    ],

    ];
}


/* =========================================================================
   Formulardaten gegen das Schema einlesen

   Rekursiv über die Felder, nicht über die gesendeten Daten. Das ist der
   Unterschied, auf den es ankommt: Was nicht im Schema steht, wird nie
   angefasst - egal, was jemand ins Formular schreibt.
   ========================================================================= */

function felder_lesen(array $felder, $roh): array {
    $aus = [];
    $roh = is_array($roh) ? $roh : [];

    foreach ($felder as $f) {
        $n    = $f['name'];
        $wert = $roh[$n] ?? null;

        $aus[$n] = match ($f['art']) {

            'text' => zeile_saeubern((string) (is_scalar($wert) ? $wert : '')),

            'mehrzeilig' => absatz_saeubern((string) (is_scalar($wert) ? $wert : '')),

            'html' => absatz_saeubern((string) (is_scalar($wert) ? $wert : '')),

            /* Ein Bild ist der Name ohne Endung und ohne Pfad. Mehr darf
               dort nicht stehen - der Wert landet später in einem Pfad. */
            'bild' => name_saeubern((string) (is_scalar($wert) ? $wert : '')),

            'textliste' => array_values(array_filter(
                array_map(fn ($t) => absatz_saeubern((string) $t),
                          is_array($wert) ? $wert : []),
                fn ($t) => $t !== '')),

            'gruppe' => felder_lesen($f['felder'], $wert),

            'liste' => (function () use ($f, $wert) {
                $zeilen = [];
                foreach (is_array($wert) ? $wert : [] as $z) {
                    $eintrag = felder_lesen($f['felder'], $z);
                    /* Ganz leere Einträge fallen weg. Sonst sammelte sich
                       mit jedem versehentlichen Klick auf "hinzufügen"
                       eine leere Zeile an. */
                    if (nicht_leer($eintrag)) $zeilen[] = $eintrag;
                }
                if (!empty($f['max'])) $zeilen = array_slice($zeilen, 0, (int) $f['max']);
                return $zeilen;
            })(),

            default => null,
        };
    }
    return $aus;
}

function nicht_leer($wert): bool {
    if (is_array($wert)) {
        foreach ($wert as $w) if (nicht_leer($w)) return true;
        return false;
    }
    return trim((string) $wert) !== '';
}

/* Einzeilige Felder: Zeilenumbrüche raus, Ränder weg. */
function zeile_saeubern(string $s): string {
    return trim(preg_replace('~\s+~u', ' ', $s) ?? '');
}

/* Mehrzeilige Felder: Umbrüche bleiben erlaubt, aber nicht drei am Stück.
   Steuerzeichen fliegen raus - die kommen beim Einfügen aus Word mit und
   sind im HTML später nicht zu sehen, aber im Quelltext schon. */
function absatz_saeubern(string $s): string {
    $s = str_replace(["\r\n", "\r"], "\n", $s);
    $s = preg_replace('~[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]~u', '', $s) ?? '';
    $s = preg_replace('~\n{3,}~', "\n\n", $s) ?? '';
    return trim($s);
}
