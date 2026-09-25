<?php
require __DIR__ . '/kern/start.php';
require __DIR__ . '/kern/rahmen.php';

$zugang = zugang_lesen();
$ersteinrichtung = empty($zugang['passwort']);
$fehler = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    merkmal_pruefen();

    if ($ersteinrichtung) {
        /* Erster Aufruf: Es gibt noch kein Passwort, also wird eines
           vergeben. Acht Zeichen sind wenig; zwölf sind die Zahl, ab der
           Raten wirklich aussichtslos wird, ohne dass sich das Passwort
           niemand merken kann. */
        $neu   = (string) ($_POST['passwort'] ?? '');
        $nochmal = (string) ($_POST['nochmal'] ?? '');

        if (mb_strlen($neu) < 12) {
            $fehler = 'Das Passwort muss mindestens zwölf Zeichen haben.';
        } elseif ($neu !== $nochmal) {
            $fehler = 'Die beiden Eingaben stimmen nicht überein.';
        } elseif (!zugang_schreiben(['passwort' => password_hash($neu, PASSWORD_DEFAULT),
                                     'angelegt' => date('c')])) {
            $fehler = 'Die Zugangsdatei ließ sich nicht schreiben. Im FTP-Programm '
                    . 'die Rechte des Ordners inhalt/ auf 755 setzen.';
        } else {
            session_regenerate_id(true);
            $_SESSION['admin'] = true;
            weiter('index.php');
        }

    } else {
        /* Gegen Durchprobieren: Nach fünf Fehlversuchen wird eine Minute
           gesperrt. Gezählt wird in der Sitzung - das hält keinen
           entschlossenen Angreifer auf, der die Sitzung wegwirft, bremst
           aber jedes Skript, das einfach Wörterbücher durchläuft. Die
           eigentliche Sicherheit liegt in password_hash. */
        $sperre = $_SESSION['sperre'] ?? 0;
        if ($sperre > time()) {
            $fehler = 'Zu viele Versuche. Bitte ' . ($sperre - time()) . ' Sekunden warten.';
        } elseif (password_verify((string) ($_POST['passwort'] ?? ''), $zugang['passwort'])) {
            /* Neue Sitzungs-Kennung nach dem Anmelden: Sonst könnte eine
               vorher untergeschobene Kennung weiterbenutzt werden. */
            session_regenerate_id(true);
            $_SESSION['admin']    = true;
            $_SESSION['versuche'] = 0;
            $ziel = $_SESSION['nach_anmeldung'] ?? 'index.php';
            unset($_SESSION['nach_anmeldung']);
            weiter($ziel);
        } else {
            $_SESSION['versuche'] = ($_SESSION['versuche'] ?? 0) + 1;
            if ($_SESSION['versuche'] >= 5) {
                $_SESSION['sperre']   = time() + 60;
                $_SESSION['versuche'] = 0;
            }
            /* Eine kurze Pause kostet den Benutzer nichts und macht
               schnelles Durchprobieren unbrauchbar. */
            usleep(400000);
            $fehler = 'Das Passwort stimmt nicht.';
        }
    }
}

if (angemeldet()) weiter('index.php');
?><!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Anmelden · Nova Works</title>
<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/admin.css?v=<?= e((string) @filemtime(__DIR__ . '/assets/admin.css')) ?>">
</head>
<body>
<div class="anmelden">
  <div class="anmelden__marke">
    <img src="../assets/img/logo-weiss.svg" alt="Nova Works">
    <p><?= $ersteinrichtung ? 'Verwaltung einrichten' : 'Verwaltung' ?></p>
  </div>

<?php if ($fehler): ?>
  <div class="meldung meldung--fehler" role="alert"><?= e($fehler) ?></div>
<?php endif; ?>

<?php if ($ersteinrichtung): ?>
  <div class="meldung meldung--warn">
    Es ist noch kein Passwort vergeben. Wer diese Seite jetzt aufruft, kann
    eines setzen – bitte gleich erledigen.
  </div>
<?php endif; ?>

  <form method="post" class="block">
    <?= merkmal_feld() ?>
    <div class="feld">
      <label for="passwort"><?= $ersteinrichtung ? 'Neues Passwort' : 'Passwort' ?></label>
<?php if ($ersteinrichtung): ?>
      <p class="feld__hinweis">Mindestens zwölf Zeichen. Am besten aus einem
        Passwortspeicher – es wird nur einmal gebraucht und muss nicht zu
        merken sein.</p>
<?php endif; ?>
      <input class="eingabe" type="password" id="passwort" name="passwort"
             autocomplete="<?= $ersteinrichtung ? 'new-password' : 'current-password' ?>"
             required autofocus>
    </div>

<?php if ($ersteinrichtung): ?>
    <div class="feld">
      <label for="nochmal">Noch einmal</label>
      <input class="eingabe" type="password" id="nochmal" name="nochmal"
             autocomplete="new-password" required>
    </div>
<?php endif; ?>

    <button class="taste taste--stark" type="submit">
      <?= $ersteinrichtung ? 'Passwort setzen' : 'Anmelden' ?>
    </button>
  </form>
</div>
</body>
</html>
