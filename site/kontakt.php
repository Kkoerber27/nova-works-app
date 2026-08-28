<?php
/* =========================================================================
   NOVA WORKS - Kontaktformular-Handler
   Nimmt das Formular von index.html entgegen und verschickt eine E-Mail.
   Läuft auf jedem Webspace mit PHP (Strato, IONOS, All-Inkl, Netcup ...).

   ANPASSEN:
   - $empfaenger : wohin die Anfragen gehen sollen
   - $absender   : MUSS eine Adresse der eigenen Domain sein, sonst
                   stufen Mailserver die Nachricht als Spam ein
   ========================================================================= */

$empfaenger = 'info@nova-works.de';
$absender   = 'website@nova-works.de';
$betreff    = 'Neue Anfrage über nova-works.de';

/* ------------------------------------------------------------------ */

/* Das Formular wird per fetch() abgeschickt und erwartet JSON. Ist im
   Browser kein JavaScript aktiv, kommt ein ganz normaler POST an - dann
   antworten wir mit einer lesbaren Seite statt mit rohem JSON. */
$willJson = isset($_SERVER['HTTP_ACCEPT'])
         && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;

function antwort($ok, $fehler = null, $code = 200) {
    global $willJson;
    http_response_code($code);

    if ($willJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'error' => $fehler], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: text/html; charset=utf-8');
    $titel = $ok ? 'Danke, die Anfrage ist raus.' : 'Das hat nicht geklappt.';
    $text  = $ok
        ? 'Wir melden uns in der Regel innerhalb eines Werktages.'
        : htmlspecialchars((string) $fehler, ENT_QUOTES, 'UTF-8');

    echo '<!doctype html><html lang="de"><head><meta charset="utf-8">'
       . '<meta name="viewport" content="width=device-width, initial-scale=1">'
       . '<title>' . htmlspecialchars($titel, ENT_QUOTES, 'UTF-8') . ' - Nova Works</title>'
       . '<meta name="robots" content="noindex, follow">'
       . '<meta name="theme-color" content="#0b0b0c">'
       . '<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">'
       . '<link rel="stylesheet" href="assets/css/style.css?v=1"></head><body>'
       . '<main id="main"><section class="legal"><div class="shell"><div class="legal__inner">'
       . '<h1>' . htmlspecialchars($titel, ENT_QUOTES, 'UTF-8') . '</h1>'
       . '<p>' . $text . '</p>'
       . '<p style="margin-top:2.5rem;display:flex;flex-wrap:wrap;gap:1rem">'
       . '<a class="btn" href="index.html"><span class="btn__label">Zur Startseite</span></a>'
       . '<a class="btn btn--ghost" href="index.html#kontakt"><span class="btn__label">Zurück zum Formular</span></a>'
       . '</p></div></div></section></main></body></html>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    antwort(false, 'Methode nicht erlaubt.', 405);
}

/* Honeypot: Bots füllen das versteckte Feld aus, Menschen nicht.
   Wir melden absichtlich Erfolg, damit der Bot nicht nachlegt. */
if (!empty($_POST['website'])) {
    antwort(true);
}

function feld($name, $max = 2000) {
    $wert = isset($_POST[$name]) ? (string) $_POST[$name] : '';
    $wert = trim($wert);
    $wert = str_replace(["\r", "\n", "\0"], ' ', $wert);   // Header-Injection
    return mb_substr($wert, 0, $max);
}

$vorname     = feld('vorname', 100);
$nachname    = feld('nachname', 100);
$unternehmen = feld('unternehmen', 150);
$email       = feld('email', 180);
$telefon     = feld('telefon', 60);
$datenschutz = isset($_POST['datenschutz']);

$nachricht = isset($_POST['nachricht']) ? trim((string) $_POST['nachricht']) : '';
$nachricht = str_replace("\0", '', $nachricht);
$nachricht = mb_substr($nachricht, 0, 5000);

$kategorien = [];
if (isset($_POST['kategorie']) && is_array($_POST['kategorie'])) {
    $erlaubt = ['Live', 'Corporate Events', 'TV'];
    foreach ($_POST['kategorie'] as $k) {
        if (in_array($k, $erlaubt, true)) $kategorien[] = $k;
    }
}

/* ---------- Validierung ---------- */

if ($vorname === '' || $nachname === '') {
    antwort(false, 'Bitte Vor- und Nachname angeben.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    antwort(false, 'Bitte eine gültige E-Mail Adresse angeben.', 422);
}
if ($nachricht === '') {
    antwort(false, 'Bitte eine Nachricht schreiben.', 422);
}
if (!$datenschutz) {
    antwort(false, 'Ohne Einwilligung dürfen wir die Anfrage nicht verarbeiten.', 422);
}

/* ---------- Mail bauen ---------- */

$zeilen = [
    'Name:        ' . $vorname . ' ' . $nachname,
    'Unternehmen: ' . ($unternehmen !== '' ? $unternehmen : '-'),
    'E-Mail:      ' . $email,
    'Telefon:     ' . ($telefon !== '' ? $telefon : '-'),
    'Kategorie:   ' . ($kategorien ? implode(', ', $kategorien) : '-'),
    '',
    'Nachricht:',
    $nachricht,
    '',
    str_repeat('-', 52),
    'Gesendet über das Kontaktformular auf nova-works.de',
    'Zeitpunkt: ' . date('d.m.Y H:i') . ' Uhr',
];

$body = implode("\n", $zeilen);

$absenderName = mb_encode_mimeheader($vorname . ' ' . $nachname, 'UTF-8');

$header = [
    'From: Nova Works Website <' . $absender . '>',
    'Reply-To: ' . $absenderName . ' <' . $email . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'MIME-Version: 1.0',
    'X-Mailer: nova-works-form',
];

$erfolg = @mail(
    $empfaenger,
    mb_encode_mimeheader($betreff, 'UTF-8'),
    $body,
    implode("\r\n", $header),
    '-f' . $absender
);

if (!$erfolg) {
    antwort(false, 'Die E-Mail konnte nicht versendet werden.', 500);
}

antwort(true);
