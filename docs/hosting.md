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

So ist die Seite aktuell gebaut. `.htaccess` und `kontakt.php` liegen fertig
in `site/`.

1. Im Strato-Kundenlogin unter **Hosting → FTP** einen Zugang anlegen oder den
   bestehenden nutzen.
2. **Vorher sichern:** den kompletten Inhalt des Webspace-Wurzelverzeichnisses
   herunterladen und zusätzlich ein Datenbank-Backup ziehen. Solange beides
   liegt, ist der Schritt umkehrbar.
3. Den **Inhalt** von `site/` in das Wurzelverzeichnis laden (meist `/` oder
   `/htdocs`). Nicht den Ordner `site` selbst hochladen, sondern das, was
   darin liegt.
4. Die alten WordPress-Dateien (`wp-admin/`, `wp-content/`, `wp-includes/`,
   `wp-*.php`) erst löschen, wenn die neue Seite läuft und geprüft ist.

`.htaccess` beginnt mit einem Punkt und wird von vielen FTP-Programmen als
versteckte Datei ausgeblendet. In FileZilla unter *Server → Versteckte Dateien
anzeigen* aktivieren, sonst fehlt sie oben – und damit alle Weiterleitungen.

### Zwei Werte in `kontakt.php`

```php
$empfaenger = 'info@nova-works.de';
$absender   = 'website@nova-works.de';
```

`$absender` **muss** eine Adresse der eigenen Domain sein, sonst stufen
Mailserver die Nachricht als Spam ein. Die Adresse muss in Strato als Postfach
oder Weiterleitung existieren – sie wird nie ausgelesen, nur zum Versenden
benutzt.

---

## Weg 2: Netlify

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
