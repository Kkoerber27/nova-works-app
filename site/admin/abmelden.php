<?php
require __DIR__ . '/kern/start.php';

/* Erst die Daten leeren, dann das Cookie zurücknehmen, dann die Sitzung
   zerstören - in dieser Reihenfolge, sonst bleibt beim Benutzer ein
   Cookie liegen, das auf eine nicht mehr vorhandene Sitzung zeigt. */
$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
              $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();

header('Location: anmelden.php');
