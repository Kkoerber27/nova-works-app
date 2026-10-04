# Hosting – zwei Wege

Die Entscheidung ist offen. Die Seite ist so gebaut, dass beide Wege ohne
Umbau funktionieren: HTML, CSS, JavaScript und Bilder sind in beiden Fällen
identisch. Unterschiedlich ist nur, **wie das Kontaktformular verschickt wird**
und **wo Weiterleitungen und Header stehen**.

| | Strato (PHP) | Netlify |
|---|---|---|
| Upload | FTP, Handarbeit | `git push`, automatisch |
| Formular | `kontakt.php` | Netlify Forms (siehe unten) |
| Weiterleitungen, Header | `.htaccess` | `netlify.toml` |
| Kosten | im bestehenden Paket | kostenloses Kontingent reicht |
| Domain umziehen | nein | ja, Nameserver oder DNS |

Beides ist vorbereitet. Nichts davon muss jetzt entschieden werden.

---

## Weg 1: Strato

So ist die Seite gebaut. Die Reihenfolge unten ist nicht beliebig – jeder
Schritt setzt den vorigen voraus.

### 0. Abnahme

```bash
php werkzeug/vor-dem-livegang.php
```

Geht alles durch, was stimmen muss: Rechtstexte ohne rote Lücken, alle
Pflichtangaben im Impressum, die Punkt-Dateien, jedes eingebundene Bild,
Empfänger und Absender des Formulars, die Adressen in `sitemap.xml` und
den Meta-Angaben. Beendet sich mit 1, sobald etwas fehlt.

**`FEHLT` heißt: nicht hochladen.** `PRUEFEN` heißt: kein Fehler, aber
jemand muss es wissen.

### 1. Sichern – vorher, nicht nachher

Das ist der einzige Schritt, der sich nicht nachholen lässt.

1. Im Strato-Kundenlogin unter **Hosting → FTP** einen Zugang anlegen oder
   den bestehenden nutzen.
2. Den **kompletten Inhalt** des Webspace-Wurzelverzeichnisses
   herunterladen. In FileZilla vorher *Server → Versteckte Dateien
   anzeigen* einschalten, sonst fehlt die alte `.htaccess`.
3. Zusätzlich ein **Datenbank-Backup** der WordPress-Installation ziehen
   (Strato-Kundenlogin → Datenbanken → Export).

Solange beides liegt, ist der Umstieg umkehrbar.

### 2. Paket bauen

```bash
./werkzeug/paket-bauen.sh
```

Legt eine ZIP-Datei an, deren **Inhalt** eins zu eins ins
Wurzelverzeichnis gehört. Das Skript läuft die Abnahme aus Schritt 0 von
selbst und baut nichts, solange etwas fehlt.

Nicht enthalten:

| Was | Warum |
|---|---|
| `inhalt/zugang.php` | Prüfsumme des lokalen Passworts. Auf dem Server wird ein eigenes vergeben. |
| `inhalt/sicherungen/` | lokale Sicherungen; auf dem Server entstehen eigene |
| `inhalt/originale/` | 74 MB Kamerafotos, die nie ausgeliefert werden. `--alles` nimmt sie mit. |

Die Originale lassen sich jederzeit nachreichen. Ohne sie läuft die Seite;
gebraucht werden sie nur, um Bildfassungen neu zu erzeugen.

### 3. Hochladen

Den **Inhalt** des Archivs ins Wurzelverzeichnis laden (meist `/` oder
`/htdocs`) – nicht den Ordner selbst, und keinen Ordner darum. Das ist der
häufigste Fehler: Die Seite liegt dann eine Ebene zu tief.

**`.htaccess` und `.user.ini` beginnen mit einem Punkt.** Viele
FTP-Programme blenden solche Dateien aus. Ohne sie fehlen alle
Weiterleitungen, die Upload-Grenze von 32 MB und der Schutz der Ordner
`inhalt/`, `vorlage/` und `admin/kern/`. Das Paket-Skript listet nach dem
Bauen auf, welche Punkt-Dateien drin sind – diese fünf müssen ankommen:

```
.htaccess   .user.ini   admin/kern/.htaccess   inhalt/.htaccess   vorlage/.htaccess
```

Die alten WordPress-Dateien (`wp-admin/`, `wp-content/`, `wp-includes/`,
`wp-*.php`) **erst löschen, wenn die neue Seite läuft und geprüft ist.**

### 4. Rechte setzen

Der Ordner `inhalt/` muss beschreibbar sein (**755**), sonst kann das
Backend nichts speichern. In FileZilla: Rechtsklick → Dateiberechtigungen.

### 5. Prüfen, ob der Server mitspielt

`werkzeug/pruefe-php.php` ins Wurzelverzeichnis legen und aufrufen:

```
https://nova-works.de/pruefe-php.php
```

Prüft PHP-Fassung, GD mit WebP, EXIF, Upload-Grenze, Arbeitsspeicher und
die Schreibrechte – also genau das, woran das Backend sonst scheitert,
ohne dass man den Grund sieht.

**Danach wieder löschen.** Die Datei verrät jedem, der die Adresse kennt,
welche PHP-Fassung und welche Grenzen dort gelten.

### 6. Passwort setzen – sofort

```
https://nova-works.de/admin/
```

Beim ersten Aufruf ist keines vergeben. **Solange das so ist, kann jeder
eines setzen, der die Adresse kennt.** Das ist der erste Schritt nach dem
Upload, nicht der letzte.

### 7. Durchklicken

- Startseite, alle zehn Projekte, Großansicht der Bilder
- Impressum, Datenschutz, AGB über die Fußzeile
- Eine Adresse, die es nicht gibt (`/gibtsnicht`) → die 404-Seite muss
  mit Gestaltung erscheinen, nicht nackt
- `/impressum.html` → muss auf `/impressum.php` weiterleiten
- Das Kontaktformular **einmal wirklich abschicken** und nachsehen, ob die
  Mail ankommt

### 8. E-Mail

`kontakt.php` verschickt mit Absender `website@nova-works.de`. Diese
Adresse **muss bei Strato als Postfach oder Weiterleitung existieren** –
sie wird nie ausgelesen, aber Mailserver prüfen, ob der Absender zur
Domain gehört. Fehlt sie, landet jede Anfrage im Spam oder wird abgewiesen.

### 9. Danach

- **HSTS einschalten**, sobald HTTPS sicher läuft: die auskommentierte
  Zeile `Strict-Transport-Security` in `.htaccess`. Vorher nicht – wer sie
  zu früh setzt, sperrt sich bei einem HTTPS-Problem selbst aus.
- **Zusätzlicher Schutz für `/admin`**: Strato kann Verzeichnisse per
  `.htpasswd` schützen. Das ist eine zweite Hürde vor dem Login und
  kostet nichts.
- Die alten WordPress-Dateien löschen, wenn alles läuft.

### Zwei Werte in `kontakt.php`

```php
$empfaenger = 'info@nova-works.de';
$absender   = 'website@nova-works.de';
```

`$absender` **muss** eine Adresse der eigenen Domain sein, sonst stufen
Mailserver die Nachricht als Spam ein. Die Adresse muss in Strato als
Postfach oder Weiterleitung existieren – sie wird nie ausgelesen, nur zum
Versenden benutzt.

---

## Weg 2: Netlify

**Seit dem Umbau auf das Backend ist dieser Weg nicht mehr gangbar.** Die
Startseite ist `index.php` und das Backend ist eine PHP-Anwendung; Netlify
führt kein PHP aus. Der folgende Abschnitt beschreibt den Stand davor und
bleibt nur als Notiz stehen.

Netlify führt **kein PHP** aus. `kontakt.php` läuft dort nicht.

Eine fertige Konfiguration liegt in `deploy/netlify.toml`. Sie gehört ins
Wurzelverzeichnis des Repositories – dort liegt aber schon die `netlify.toml`
der internen App. Zwei Seiten aus einem Repository heißt: **zwei
Netlify-Projekte**, beide auf dasselbe Repository, mit unterschiedlichem
Publish-Verzeichnis (`.` für die App, `site` für die Homepage).

### Formular ohne PHP

Netlify hat einen eigenen Formular-Dienst. Nötig sind drei Änderungen in
`site/index.html`:

```html
<!-- vorher -->
<form id="kontaktformular" action="kontakt.php" method="post" novalidate>

<!-- nachher -->
<form id="kontaktformular" action="/danke.html" method="post" novalidate
      name="kontakt" data-netlify="true" netlify-honeypot="website">
  <input type="hidden" name="form-name" value="kontakt">
```

Dazu in `site/assets/js/main.js` das `fetch(form.action, …)` auf
`fetch('/', …)` ändern – Netlify nimmt Formulare an der Wurzel entgegen –
und eine schlichte `site/danke.html` anlegen.

Das Honeypot-Feld `website` bleibt wie es ist, Netlify wertet es über
`netlify-honeypot` selbst aus.

---

## Was in beiden Fällen gilt

Die Seite lädt **nichts von fremden Servern**. Die Schrift (Zalando Sans)
liegt als `woff2` lokal in `site/assets/fonts/`. Deshalb braucht es kein
Cookie-Banner und die Content-Security-Policy kann so eng sein, wie sie ist.

Wird später etwas eingebunden – eine Karte, ein eingebettetes Video, ein
Analyse-Werkzeug – ändert sich beides: Die Quelle muss in die CSP aufgenommen
werden, und je nach Dienst wird eine Einwilligung nötig.
