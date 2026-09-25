<?php
/* =========================================================================
   NOVA WORKS - Bildverarbeitung
   Wandelt Fotos aus der Kamera in das um, was die Website braucht:
   WebP in mehreren Breiten, dazu JPEG als Rückfall für alte Browser.

   Dieselbe Datei bedient zwei Aufrufer:
   - die Mediathek im Backend (Upload durch den Browser)
   - das Werkzeug werkzeug/bilder-neu.php (Stapelverarbeitung auf der
     Kommandozeile)

   Gebaut auf GD, weil das auf jedem Webspace mit PHP vorhanden ist.
   ImageMagick wäre schöner, ist aber bei Strato nicht verlässlich da.
   ========================================================================= */

/* --- Was die Website an Breiten braucht ----------------------------------
   Das größte Bild auf der Seite ist das Projektfoto: 1320 CSS-Pixel breit.
   Auf einem Retina-Schirm sind das 2640 echte Pixel. Genau daran krankte
   die alte Fassung - dort lagen 1600 Pixel, der Browser musste auf das
   1,65-fache hochrechnen, und das sieht man.

   Die Staffel deckt Handy (640), Tablet (960), Laptop (1280), große
   Schirme (1920) und Retina (2560) ab. Der Browser sucht sich über
   srcset selbst aus, was er braucht - und lädt am Handy eben 640 statt
   2560. Die Seite wird dadurch nicht schwerer, sondern leichter. */
const BILD_BREITEN = [640, 960, 1280, 1920, 2560];

/* Qualität, nach Breite gestaffelt.

   Je mehr Pixel auf dieselbe Fläche kommen, desto weniger sieht man von
   der Kompression: Auf einem Retina-Schirm liegen die 2560 Pixel so dicht,
   dass ein Artefakt kleiner ist als das, was das Auge trennen kann. Feste
   82 für alle Breiten hieße deshalb, für die großen Fassungen Bytes zu
   bezahlen, die niemand sieht - das 2560er Bild kam so auf 1,5 MB.

   Die kleinen Breiten bekommen dafür mehr: Sie werden auf kleinen Schirmen
   in echter Größe gezeigt, dort fällt jeder Fehler auf. */
const BILD_GUETE = [640 => 86, 960 => 84, 1280 => 80, 1920 => 74, 2560 => 70];
const BILD_GUETE_JPEG = 82;

/* Wie breit der JPEG-Rückfall ist.

   WebP versteht jeder Browser seit 2020, auch Safari. Der Rückfall ist
   deshalb nur noch für sehr alte Geräte da - und für die genügt eine
   einzige mittlere Breite. Vorher entstand JPEG in jeder Stufe; das war
   die Hälfte aller Dateien, die praktisch nie jemand abruft. */
const BILD_JPEG_BREITE = 1280;

/* Formate, die GD lesen kann. HEIC von iPhones ist NICHT dabei - siehe
   bild_lesbar(). */
const BILD_FORMATE = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'];


/* =========================================================================
   Lesen
   ========================================================================= */

/* Prüft eine Datei, bevor irgendetwas damit passiert. Gibt bei Erfolg
   Angaben zurück, sonst eine Klartext-Meldung - die geht im Backend
   direkt an den Benutzer, deshalb steht dort kein Fachjargon. */
function bild_lesbar(string $pfad): array {
    if (!is_file($pfad)) {
        return ['ok' => false, 'fehler' => 'Die Datei wurde nicht gefunden.'];
    }

    $groesse = @getimagesize($pfad);

    if (!$groesse) {
        /* HEIC ist das Standardformat neuerer iPhones. GD kann es nicht,
           und das ist der mit Abstand häufigste Grund, warum ein Upload
           scheitert. Deshalb wird es eigens erkannt und erklärt, statt
           "unbekanntes Format" zu melden. */
        $kopf = (string) @file_get_contents($pfad, false, null, 0, 32);
        if (strpos($kopf, 'ftypheic') !== false || strpos($kopf, 'ftypheix') !== false
            || strpos($kopf, 'ftypmif1') !== false || strpos($kopf, 'ftyphevc') !== false) {
            return ['ok' => false, 'fehler' =>
                'Das ist ein HEIC-Bild vom iPhone. Dieses Format kann der Server '
              . 'nicht lesen. Stelle am iPhone unter Einstellungen → Kamera → '
              . 'Formate auf „Maximale Kompatibilität" um, oder exportiere das '
              . 'Foto als JPEG.'];
        }
        return ['ok' => false, 'fehler' => 'Die Datei ist kein Bild, das der Server lesen kann.'];
    }

    $typen = [
        IMAGETYPE_JPEG => 'jpeg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp',
        IMAGETYPE_GIF  => 'gif',  IMAGETYPE_BMP => 'bmp',
    ];
    if (defined('IMAGETYPE_AVIF')) $typen[IMAGETYPE_AVIF] = 'avif';

    if (!isset($typen[$groesse[2]])) {
        return ['ok' => false, 'fehler' => 'Dieses Bildformat kann der Server nicht lesen.'];
    }

    return [
        'ok'     => true,
        'breite' => $groesse[0],
        'hoehe'  => $groesse[1],
        'typ'    => $typen[$groesse[2]],
    ];
}

/* Lädt das Bild und dreht es gerade. Das Drehen ist der Grund, warum hier
   nicht einfach imagecreatefromjpeg steht: Handys speichern hochkant
   aufgenommene Fotos quer ab und notieren die Drehung nur als Vermerk im
   EXIF-Block. Wer den ignoriert, bekommt liegende Bilder - und weil beim
   Umwandeln der Vermerk verlorengeht, wäre der Fehler danach nicht mehr
   zu heilen. */
function bild_oeffnen(string $pfad): ?GdImage {
    $art = bild_lesbar($pfad);
    if (!$art['ok']) return null;

    $bild = match ($art['typ']) {
        'jpeg' => @imagecreatefromjpeg($pfad),
        'png'  => @imagecreatefrompng($pfad),
        'webp' => @imagecreatefromwebp($pfad),
        'gif'  => @imagecreatefromgif($pfad),
        'bmp'  => @imagecreatefrombmp($pfad),
        'avif' => function_exists('imagecreatefromavif') ? @imagecreatefromavif($pfad) : false,
        default => false,
    };
    if (!$bild) return null;

    if ($art['typ'] === 'jpeg' && function_exists('exif_read_data')) {
        $exif = @exif_read_data($pfad);
        $drehung = $exif['Orientation'] ?? 1;

        /* 3, 6 und 8 sind die drei Drehungen. 2, 4, 5 und 7 sind zusätzlich
           gespiegelt; die kommen aus Kameras praktisch nie und werden hier
           wie ihre ungespiegelten Geschwister behandelt. */
        $winkel = match ((int) $drehung) { 3 => 180, 6 => -90, 8 => 90, default => 0 };
        if ($winkel !== 0) {
            $gedreht = imagerotate($bild, $winkel, 0);
            if ($gedreht) { imagedestroy($bild); $bild = $gedreht; }
        }
    }

    return $bild;
}


/* =========================================================================
   Verkleinern
   ========================================================================= */

/* Verkleinert auf eine Zielbreite.

   In zwei Schritten, nicht in einem: GD tastet beim Verkleinern nur eine
   feste Zahl von Punkten ab. Wer ein 5712 Pixel breites Foto in einem Zug
   auf 640 bringt, überspringt dabei fast neun von zehn Pixelreihen - feine
   Strukturen wie ein Traversengitter oder die Punkte einer LED-Wand
   zerfallen dann zu Grieß. Deshalb wird erst halbiert, solange mehr als
   das Doppelte der Zielbreite übrig ist, und erst der letzte Schritt geht
   auf das genaue Maß. Jede Halbierung mittelt sauber über vier Pixel.

   Hochgerechnet wird nie: Ist die Quelle kleiner als das Ziel, kommt das
   Bild unverändert zurück. Ein hochgerechnetes Bild sieht schlechter aus
   als ein kleines, und die Website wählt über srcset ohnehin selbst. */
function bild_verkleinern(GdImage $quelle, int $zielBreite): GdImage {
    $breite = imagesx($quelle);
    $hoehe  = imagesy($quelle);

    if ($zielBreite >= $breite) return $quelle;

    $zielHoehe = (int) round($hoehe * $zielBreite / $breite);
    $aktuell   = $quelle;
    $eigen     = false;          // gehört das Zwischenbild uns?

    while (imagesx($aktuell) > $zielBreite * 2) {
        $halbB = (int) max(1, imagesx($aktuell) >> 1);
        $halbH = (int) max(1, imagesy($aktuell) >> 1);
        $halb  = imagecreatetruecolor($halbB, $halbH);
        imagecopyresampled($halb, $aktuell, 0, 0, 0, 0,
                           $halbB, $halbH, imagesx($aktuell), imagesy($aktuell));
        if ($eigen) imagedestroy($aktuell);
        $aktuell = $halb;
        $eigen   = true;
    }

    $ziel = imagecreatetruecolor($zielBreite, $zielHoehe);
    imagecopyresampled($ziel, $aktuell, 0, 0, 0, 0,
                       $zielBreite, $zielHoehe, imagesx($aktuell), imagesy($aktuell));
    if ($eigen) imagedestroy($aktuell);

    bild_nachschaerfen($ziel);
    return $ziel;
}

/* Jedes Verkleinern mittelt Pixel und macht das Bild dadurch minimal
   weicher. Ein milder Schärfefilter holt das zurück. Bewusst mild: Eine
   kräftige Schärfung setzt helle Säume an dunkle Kanten, und genau die
   fallen auf einer dunklen Seite mit Scheinwerfern im Bild sofort auf. */
function bild_nachschaerfen(GdImage $bild): void {
    $kern = [
        [ 0.0, -0.6,  0.0],
        [-0.6,  3.4, -0.6],
        [ 0.0, -0.6,  0.0],
    ];
    @imageconvolution($bild, $kern, 1.0, 0);
}


/* =========================================================================
   Schreiben
   ========================================================================= */

function bild_schreiben(GdImage $bild, string $pfad, string $format, ?int $guete = null): bool {
    $ordner = dirname($pfad);
    if (!is_dir($ordner)) @mkdir($ordner, 0755, true);

    return match ($format) {
        'webp' => @imagewebp($bild, $pfad, $guete ?? 80),
        /* imageinterlace macht ein fortschreitendes JPEG: Der Browser zeigt
           erst eine grobe Fassung und schärft nach, statt das Bild von oben
           nach unten aufzubauen. Bei großen Fotos ist das der angenehmere
           Aufbau. */
        'jpeg' => (function () use ($bild, $pfad) {
            imageinterlace($bild, true);
            return @imagejpeg($bild, $pfad, BILD_GUETE_JPEG);
        })(),
        default => false,
    };
}


/* Die Güte zur Breite. Zwischen den Stufen wird nicht gerechnet - es gibt
   nur die Breiten aus BILD_BREITEN, plus die auf die Quellbreite
   gedeckelte oberste Stufe. Für die gilt der Wert der Stufe, aus der sie
   entstanden ist. */
function bild_guete(int $breite): int {
    $beste = 80;
    foreach (BILD_GUETE as $b => $g) { if ($breite >= $b) $beste = $g; }
    return $beste;
}


/* =========================================================================
   Die ganze Staffel auf einmal
   ========================================================================= */

/* Erzeugt aus einer Quelldatei alle Breiten in WebP und JPEG.

   Zurück kommt ein Verzeichnis dessen, was entstanden ist - genau das,
   was die Vorlage braucht, um srcset zu schreiben, und was die Mediathek
   anzeigt.

   $name ist der Dateiname ohne Endung, also etwa "live". Daraus werden
   live-640.webp, live-640.jpg, live-960.webp und so weiter. Zusätzlich
   entsteht live.jpg in der größten sinnvollen Breite als Rückfall für
   alles, was mit srcset nichts anfangen kann. */
function bild_staffel(string $quelle, string $zielOrdner, string $name,
                      ?array $breiten = null): array {
    $art = bild_lesbar($quelle);
    if (!$art['ok']) return ['ok' => false, 'fehler' => $art['fehler']];

    $bild = bild_oeffnen($quelle);
    if (!$bild) return ['ok' => false, 'fehler' => 'Das Bild konnte nicht geöffnet werden.'];

    $breiten   = $breiten ?? BILD_BREITEN;
    $quellBr   = imagesx($bild);
    $quellHo   = imagesy($bild);
    $fassungen = [];
    $rueckfall = [];

    foreach ($breiten as $br) {
        /* Nur Breiten, die die Quelle hergibt. Die nächstgrößere Stufe wird
           noch mitgenommen und dabei auf die Quellbreite gedeckelt - sonst
           fehlte bei einem 1800 Pixel breiten Foto die 1920er Stufe ganz
           und der Browser nähme die 1280er. */
        if ($br > $quellBr) {
            if (!$fassungen || max(array_keys($fassungen)) >= $quellBr) break;
            $br = $quellBr;
        }

        $klein = bild_verkleinern($bild, $br);
        $hoehe = imagesy($klein);

        $webp = "$zielOrdner/$name-$br.webp";
        bild_schreiben($klein, $webp, 'webp', bild_guete($br));

        $fassungen[$br] = [
            'breite' => $br,
            'hoehe'  => $hoehe,
            'webp'   => basename($webp),
            'bytes'  => ['webp' => (int) @filesize($webp)],
        ];

        $rueckfall[$br] = $klein;      // für den JPEG-Rückfall, siehe unten
        if ($br >= $quellBr) break;
    }

    /* Der JPEG-Rückfall: genau einer, in der Breite, die der Zielbreite am
       nächsten kommt. Er heißt name.jpg ohne Zahl - so bleibt er auch dann
       gültig, wenn sich die Staffel später ändert. */
    if ($fassungen) {
        $breitenDa = array_keys($fassungen);
        usort($breitenDa, fn ($a, $b) =>
            abs($a - BILD_JPEG_BREITE) <=> abs($b - BILD_JPEG_BREITE));
        $rb = $breitenDa[0];
        bild_schreiben($rueckfall[$rb], "$zielOrdner/$name.jpg", 'jpeg');
        $fassungen[$rb]['bytes']['jpeg'] = (int) @filesize("$zielOrdner/$name.jpg");
    }

    foreach ($rueckfall as $r) { if ($r !== $bild) imagedestroy($r); }

    imagedestroy($bild);

    return [
        'ok'        => true,
        'name'      => $name,
        'quelle'    => ['breite' => $quellBr, 'hoehe' => $quellHo, 'typ' => $art['typ']],
        'fassungen' => $fassungen,
        'seiten'    => $quellBr . ':' . $quellHo,
    ];
}
