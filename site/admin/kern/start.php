<?php
/* =========================================================================
   NOVA WORKS - Backend, gemeinsamer Anfang
   Jede Seite unter /admin bindet diese Datei als Erstes ein. Sie sorgt
   für Sitzung, Anmeldung und den Schutz gegen fremde Formulare.
   ========================================================================= */

declare(strict_types=1);

const ADMIN_WURZEL  = __DIR__ . '/..';
const SEITEN_WURZEL = __DIR__ . '/../..';
const ZUGANG_DATEI  = SEITEN_WURZEL . '/inhalt/zugang.php';

require_once __DIR__ . '/bild.php';
require_once __DIR__ . '/inhalt.php';

/* --- Sitzung ---------------------------------------------------------
   httponly: JavaScript kommt an das Sitzungsmerkmal nicht heran.
   samesite=Strict: Ein Formular auf einer fremden Seite kann die Sitzung
   nicht mitbenutzen.
   secure: nur über HTTPS - lokal über http wäre die Anmeldung sonst
   unmöglich, deshalb hängt es daran, ob die Verbindung verschlüsselt ist. */
if (session_status() === PHP_SESSION_NONE) {
    $ueberHttps = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off')
               || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Strict',
        'secure'   => $ueberHttps,
    ]);
    session_name('novaadmin');
    session_start();
}

/* Kein Zwischenspeichern von Backend-Seiten. Sonst zeigt der Zurück-Knopf
   nach dem Abmelden noch den Inhalt. */
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');


/* =========================================================================
   Zugang
   ========================================================================= */

/* Die Zugangsdatei ist eine PHP-Datei, die ein Feld zurückgibt - keine
   JSON-Datei. Grund: Sollte der Ordnerschutz einmal nicht greifen, liefert
   der Server eine .php-Datei ausgeführt aus, also nichts. Eine .json-Datei
   läge im Klartext offen. */
function zugang_lesen(): array {
    if (!is_file(ZUGANG_DATEI)) return [];
    $d = @include ZUGANG_DATEI;
    return is_array($d) ? $d : [];
}

function zugang_schreiben(array $d): bool {
    $inhalt = "<?php\n"
        . "/* Zugangsdaten des Backends. Nicht von Hand ändern - das Passwort\n"
        . "   steht hier nur als Prüfsumme und lässt sich nicht zurückrechnen.\n"
        . "   Passwort vergessen? Diese Datei löschen; beim nächsten Aufruf\n"
        . "   von /admin wird ein neues vergeben. */\n"
        . 'return ' . var_export($d, true) . ";\n";
    return (bool) @file_put_contents(ZUGANG_DATEI, $inhalt, LOCK_EX);
}

function angemeldet(): bool {
    return !empty($_SESSION['admin']) && !empty(zugang_lesen()['passwort']);
}

/* Ruft jede geschützte Seite als Erstes auf. */
function anmeldung_pflicht(): void {
    if (angemeldet()) return;

    /* Wohin der Benutzer wollte, damit er nach dem Anmelden dort landet
       und nicht immer auf dem Dashboard. Nur Pfade innerhalb des
       Backends - eine vollständige Adresse wäre eine offene
       Weiterleitung auf fremde Seiten. */
    $ziel = $_SERVER['REQUEST_URI'] ?? '';
    $_SESSION['nach_anmeldung'] = (str_starts_with($ziel, '/admin/') && !str_contains($ziel, '//'))
        ? $ziel : '/admin/';

    header('Location: anmelden.php');
    exit;
}


/* =========================================================================
   Schutz gegen fremde Formulare (CSRF)
   ========================================================================= */

/* Ohne diesen Schutz könnte eine beliebige fremde Seite ein Formular an
   das Backend abschicken, solange der Benutzer hier angemeldet ist - und
   damit Inhalte ändern oder löschen. Das Merkmal steht in der Sitzung und
   in jedem Formular; nur wenn beide übereinstimmen, wird gespeichert. */
function merkmal(): string {
    if (empty($_SESSION['merkmal'])) {
        $_SESSION['merkmal'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['merkmal'];
}

function merkmal_feld(): string {
    return '<input type="hidden" name="merkmal" value="' . htmlspecialchars(merkmal(), ENT_QUOTES) . '">';
}

/* hash_equals statt === : vergleicht in konstanter Zeit und verrät damit
   nicht über die Dauer, wie viele Zeichen gestimmt haben. */
function merkmal_pruefen(): void {
    $gesendet = $_POST['merkmal'] ?? '';
    if (!is_string($gesendet) || !hash_equals($_SESSION['merkmal'] ?? '', $gesendet)) {
        http_response_code(400);
        exit('Das Formular ist abgelaufen. Bitte die Seite neu laden und noch einmal versuchen.');
    }
}


/* =========================================================================
   Kleinkram
   ========================================================================= */

function e(?string $s): string {
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/* Meldungen überleben die Weiterleitung nach dem Speichern. Ohne das
   müsste das Formular seine Antwort direkt ausgeben - und ein
   Neuladen der Seite würde erneut speichern. */
function melden(string $art, string $text): void {
    $_SESSION['meldung'] = ['art' => $art, 'text' => $text];
}

function meldung_holen(): ?array {
    $m = $_SESSION['meldung'] ?? null;
    unset($_SESSION['meldung']);
    return $m;
}

function weiter(string $ziel): never {
    header('Location: ' . $ziel);
    exit;
}

/* Dateinamen aus Formularen. Lässt nur Buchstaben, Ziffern, Bindestrich
   und Unterstrich durch - damit kommt niemand mit ../ aus dem Ordner
   heraus, egal was im Feld stand. */
function name_saeubern(string $roh): string {
    $n = strtolower(trim($roh));
    $n = strtr($n, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss', ' ' => '-']);
    $n = preg_replace('~[^a-z0-9_-]~', '', $n) ?? '';
    return trim($n, '-_');
}

function lesbare_groesse(int $b): string {
    if ($b >= 1048576) return round($b / 1048576, 1) . ' MB';
    if ($b >= 1024)    return round($b / 1024) . ' kB';
    return $b . ' B';
}
