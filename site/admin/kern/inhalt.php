<?php
/* =========================================================================
   NOVA WORKS - Inhaltsdatei lesen, sichern, schreiben
   Eine einzige JSON-Datei trägt alle Texte der Startseite. Vor jeder
   Änderung entsteht eine Sicherung; damit ist jeder Schritt umkehrbar.
   ========================================================================= */

const INHALT_DATEI      = __DIR__ . '/../../inhalt/inhalt.json';
const SICHERUNG_ORDNER  = __DIR__ . '/../../inhalt/sicherungen';
const SICHERUNGEN_MAX   = 40;

function inhalt_laden(): array {
    if (!is_file(INHALT_DATEI)) return [];
    $d = json_decode((string) file_get_contents(INHALT_DATEI), true);
    return is_array($d) ? $d : [];
}

/* Speichert und legt vorher eine Sicherung an.

   Geschrieben wird über eine Zwischendatei und rename(): Bricht der
   Vorgang mittendrin ab - Platte voll, Prozess getötet -, läge sonst
   eine halbe JSON-Datei da und die Website wäre leer. rename() ist auf
   demselben Dateisystem unteilbar: Entweder die neue Datei steht ganz,
   oder die alte bleibt unberührt. */
function inhalt_speichern(array $daten, string $anlass = ''): array {
    if (is_file(INHALT_DATEI)) {
        sicherung_anlegen($anlass);
    }

    $json = json_encode($daten,
        JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($json === false) {
        return ['ok' => false, 'fehler' => 'Die Inhalte ließen sich nicht umwandeln: '
                                         . json_last_error_msg()];
    }

    $zwischen = INHALT_DATEI . '.neu';
    if (@file_put_contents($zwischen, $json . "\n", LOCK_EX) === false) {
        return ['ok' => false, 'fehler' => 'Die Inhaltsdatei ist nicht beschreibbar. '
              . 'Im FTP-Programm die Rechte des Ordners inhalt/ auf 755 setzen.'];
    }
    if (!@rename($zwischen, INHALT_DATEI)) {
        @unlink($zwischen);
        return ['ok' => false, 'fehler' => 'Die Inhaltsdatei ließ sich nicht ersetzen.'];
    }

    /* PHP merkt sich kompilierte Dateien; die JSON-Datei ist davon nicht
       betroffen, aber auf manchen Servern hängt ein Dateizwischenspeicher
       davor. Einmal leeren kostet nichts und erspart die Frage, warum die
       Änderung nicht erscheint. */
    if (function_exists('opcache_invalidate')) @opcache_invalidate(INHALT_DATEI, true);
    clearstatcache(true, INHALT_DATEI);

    return ['ok' => true];
}


/* =========================================================================
   Sicherungen
   ========================================================================= */

function sicherung_anlegen(string $anlass = ''): ?string {
    if (!is_dir(SICHERUNG_ORDNER)) @mkdir(SICHERUNG_ORDNER, 0755, true);
    if (!is_dir(SICHERUNG_ORDNER)) return null;

    $name = 'inhalt-' . date('Ymd-His')
          . ($anlass !== '' ? '-' . preg_replace('~[^a-z0-9]~i', '', $anlass) : '')
          . '.json';

    if (!@copy(INHALT_DATEI, SICHERUNG_ORDNER . '/' . $name)) return null;

    sicherungen_aufraeumen();
    return $name;
}

/* Alte Sicherungen wegräumen. Ohne das wächst der Ordner mit jedem
   Speichern - nach einem Jahr Pflege wären das Tausende Dateien. */
function sicherungen_aufraeumen(): void {
    $liste = sicherungen();
    if (count($liste) <= SICHERUNGEN_MAX) return;
    foreach (array_slice($liste, SICHERUNGEN_MAX) as $alt) {
        @unlink(SICHERUNG_ORDNER . '/' . $alt['name']);
    }
}

/* Neueste zuerst. */
function sicherungen(): array {
    if (!is_dir(SICHERUNG_ORDNER)) return [];
    $aus = [];
    foreach (scandir(SICHERUNG_ORDNER) ?: [] as $d) {
        if (!str_ends_with($d, '.json')) continue;
        $p = SICHERUNG_ORDNER . '/' . $d;
        $aus[] = ['name' => $d, 'zeit' => filemtime($p), 'bytes' => filesize($p)];
    }
    usort($aus, fn ($a, $b) => $b['zeit'] <=> $a['zeit']);
    return $aus;
}

function sicherung_zurueck(string $name): array {
    /* basename() gegen ../ im Namen - der kommt aus einem Formular. */
    $p = SICHERUNG_ORDNER . '/' . basename($name);
    if (!is_file($p)) return ['ok' => false, 'fehler' => 'Diese Sicherung gibt es nicht mehr.'];

    $d = json_decode((string) file_get_contents($p), true);
    if (!is_array($d)) return ['ok' => false, 'fehler' => 'Die Sicherung ist unlesbar.'];

    /* Der Stand vor dem Zurückholen wird selbst gesichert - sonst wäre
       genau dieser Schritt der einzige, den man nicht rückgängig machen
       kann. */
    return inhalt_speichern($d, 'vorRueckholung');
}
