<?php
require __DIR__ . '/kern/start.php';
require __DIR__ . '/kern/rahmen.php';
anmeldung_pflicht();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    merkmal_pruefen();
    $zugang = zugang_lesen();

    $alt     = (string) ($_POST['alt'] ?? '');
    $neu     = (string) ($_POST['neu'] ?? '');
    $nochmal = (string) ($_POST['nochmal'] ?? '');

    if (!password_verify($alt, $zugang['passwort'] ?? '')) {
        melden('fehler', 'Das bisherige Passwort stimmt nicht.');
    } elseif (mb_strlen($neu) < 12) {
        melden('fehler', 'Das neue Passwort muss mindestens zwölf Zeichen haben.');
    } elseif ($neu !== $nochmal) {
        melden('fehler', 'Die beiden Eingaben stimmen nicht überein.');
    } elseif (!zugang_schreiben(['passwort' => password_hash($neu, PASSWORD_DEFAULT),
                                 'angelegt' => $zugang['angelegt'] ?? date('c'),
                                 'geaendert' => date('c')])) {
        melden('fehler', 'Die Zugangsdatei ließ sich nicht schreiben.');
    } else {
        /* Neue Sitzungs-Kennung: Wer das Passwort ändert, will oft genau
           damit eine mitgelesene Sitzung loswerden. */
        session_regenerate_id(true);
        melden('gut', 'Passwort geändert.');
    }
    weiter('passwort.php');
}

kopf('Passwort ändern', '', true);
?>

<a class="zurueck" href="index.php">← Übersicht</a>

<div class="titelzeile"><div><h1>Passwort ändern</h1></div></div>

<form method="post" class="block" style="max-width:460px">
  <?= merkmal_feld() ?>
  <div class="feld">
    <label for="alt">Bisheriges Passwort</label>
    <input class="eingabe" type="password" id="alt" name="alt" autocomplete="current-password" required>
  </div>
  <div class="feld">
    <label for="neu">Neues Passwort</label>
    <p class="feld__hinweis">Mindestens zwölf Zeichen.</p>
    <input class="eingabe" type="password" id="neu" name="neu" autocomplete="new-password" required>
  </div>
  <div class="feld">
    <label for="nochmal">Noch einmal</label>
    <input class="eingabe" type="password" id="nochmal" name="nochmal" autocomplete="new-password" required>
  </div>
  <button class="taste taste--stark" type="submit">Passwort ändern</button>
</form>

<div class="block">
  <h2>Passwort vergessen?</h2>
  <p>Dann über FTP die Datei <code>inhalt/zugang.php</code> löschen. Beim
     nächsten Aufruf von <code>/admin</code> lässt sich ein neues vergeben.
     Solange die Datei fehlt, kann das jeder, der die Adresse kennt – also
     gleich erledigen.</p>
</div>

<?php fuss();
