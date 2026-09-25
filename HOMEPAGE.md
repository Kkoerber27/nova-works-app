# Nova Works – Homepage

Statischer Neubau der Seite nova-works.de. Ersetzt die bisherige
WordPress-Installation (Salient + WPBakery) – ohne CMS, ohne Datenbank, ohne
Plugins, ohne Build-Schritt.

Liegt im selben Repository wie die interne App (Crewplanung, Schichtplan,
Funkgeräte …), berührt sie aber an keiner Stelle. Die App bleibt im
Wurzelverzeichnis, die Homepage lebt vollständig in `site/`.

## Ordner

```
site/                      ← das, was auf den Server kommt
├─ index.php               Startseite, baut sich aus inhalt/ und vorlage/
├─ impressum.html          Rechtstext
├─ datenschutz.html        Rechtstext
├─ agb.html                Allgemeine Geschäftsbedingungen, §§ 1–36
├─ 404.html
├─ kontakt.php             Formular-Handler (verschickt die E-Mail)
├─ .htaccess               Weiterleitungen, Caching, Sicherheits-Header
├─ .user.ini               PHP-Grenzen (Upload 32 MB, Speicher 512 MB)
├─ robots.txt · sitemap.xml
├─ admin/                  das Backend
│  ├─ index.php            Übersicht
│  ├─ abschnitt.php        Editor für alle neun Abschnitte
│  ├─ mediathek.php        Upload und WebP-Umwandlung
│  ├─ rechtsseiten.php     HTML-Editor für die drei Rechtstexte
│  ├─ sicherungen.php      ansehen, herunterladen, zurückholen
│  ├─ passwort.php · anmelden.php · abmelden.php
│  └─ kern/                bild.php · inhalt.php · felder.php · start.php
├─ inhalt/                 GESPERRT für den Abruf
│  ├─ inhalt.json          alle Texte der Startseite
│  ├─ zugang.php           Passwort-Prüfsumme des Backends
│  ├─ sicherungen/         vor jedem Speichern eine Kopie
│  └─ originale/           die Kamerafotos, Quelle aller Fassungen
├─ vorlage/                GESPERRT – startseite.php und helfer.php
└─ assets/                 css · js · img · fonts

werkzeug/bilder-neu.php    alle Bilder neu erzeugen
werkzeug/inhalt-ziehen.php einmaliger Umbau von HTML auf inhalt.json
pruefung/                  Prüfmappe, siehe unten
deploy/netlify.toml        Alternative zu .htaccess, falls Netlify
docs/inhalt.md             Inhaltsinventar der alten Seite
docs/hosting.md            Strato oder Netlify – beide Wege beschrieben
reference/                 Spiegelung der alten Seite + Extraktionsskript
```

**`site/inhalt/originale/` ist 74 MB groß und wird nie ausgeliefert.** Die
Seite läuft auch ohne den Ordner; gebraucht wird er nur, um Bildfassungen
neu zu erzeugen. Wer beim ersten Hochladen per FTP Zeit sparen will, kann
ihn weglassen und später nachreichen.

## Lokal ansehen

```bash
cd site && php -S 127.0.0.1:4174
```

Dann <http://127.0.0.1:4174> öffnen, das Backend unter
<http://127.0.0.1:4174/admin/>. `php -S` ist zwingend: Die Startseite ist
`index.php`, ein reiner Dateiserver lieferte den Quelltext aus.

**macOS liefert seit Monterey kein PHP mehr mit.** `php -v` sagt dann
`command not found`. Nachinstallieren über Homebrew:

```bash
brew install php
```

Ob die Installation taugt, sagt:

```bash
php werkzeug/pruefe-php.php
```

Dasselbe Skript lässt sich auch auf dem Webspace aufrufen – siehe
[`docs/hosting.md`](docs/hosting.md).

Der eingebaute Server von PHP liest `.user.ini` **nicht**. Für Uploads
größerer Fotos deshalb lokal:

```bash
cd site && php -d upload_max_filesize=32M -d post_max_size=160M \
                -d memory_limit=512M -S 127.0.0.1:4174
```

## Hochladen

Die Seite braucht **PHP** – das Backend und `index.php` laufen auf Netlify
nicht. Der Weg über Strato ist in [`docs/hosting.md`](docs/hosting.md)
beschrieben.

Nach dem ersten Hochladen: <https://nova-works.de/admin/> aufrufen und ein
Passwort vergeben. Solange das nicht geschehen ist, kann es jeder tun, der
die Adresse kennt.

## Etwas ändern

Seit dem Umbau gibt es dafür ein Backend: **`/admin`** auf der eigenen
Domain. Dort lassen sich alle Texte, alle Bilder und die drei Rechtsseiten
bearbeiten, ohne eine Datei anzufassen.

Beim ersten Aufruf ist noch kein Passwort vergeben – wer die Adresse kennt,
kann dann eines setzen. **Das gehört als Erstes erledigt, sobald die Seite
online ist.**

Von Hand geht weiterhin alles:

| Was | Wo |
|---|---|
| Texte der Startseite | `site/inhalt/inhalt.json` – oder im Backend |
| Markup der Startseite | `site/vorlage/startseite.php` |
| Farben, Abstände, Schriftgrößen | `site/assets/css/style.css`, Block `:root` |
| Verhalten (Menü, Laufband, Einwilligung, Formular) | `site/assets/js/main.js` |
| Rechtsseiten | `site/impressum.html`, `datenschutz.html`, `agb.html` |
| Bilder | Backend → Mediathek, oder `werkzeug/bilder-neu.php` |

Die Versionsnummer hinter `style.css` und `main.js` muss **nicht mehr** von
Hand hochgezählt werden – `index.php` setzt sie aus dem Änderungsdatum der
Dateien. Genau das wurde vorher regelmäßig vergessen.

### Wie die Startseite entsteht

```
site/inhalt/inhalt.json   die Texte
        +
site/vorlage/startseite.php   das Markup
        +
site/assets/img/bilder.json   welche Bildbreiten es gibt
        ↓
site/index.php   gibt die fertige Seite aus
```

`inhalt.json` ist die einzige Wahrheit. Das Backend schreibt hinein, die
Vorlage liest daraus. Vor jedem Schreiben entsteht eine Sicherung unter
`site/inhalt/sicherungen/`.

Zwei Ordner sind gegen Abruf gesperrt (`inhalt/`, `vorlage/`, dazu
`admin/kern/`), jeder über eine eigene `.htaccess` plus eine Regel in der
`.htaccess` im Wurzelverzeichnis. Doppelt, weil viele FTP-Programme
Punkt-Dateien ausblenden und eine davon beim Hochladen leicht fehlt.

## Bilder

### Warum die Fotos vorher unscharf waren

Alle Bilder lagen auf höchstens 1600 px Breite. Das Projektfoto wird aber
bis 1192 CSS-Pixel breit gezeigt – auf einem Retina-Schirm sind das 2384
echte Pixel. Der Browser musste also um das Anderthalbfache hochrechnen,
und genau das sieht man: Konfetti wird zum Schleier, ein Traversengitter
zu Grieß.

### Wie es jetzt läuft

Jedes Bild liegt in bis zu fünf Breiten als WebP vor – 640, 960, 1280, 1920
und 2560 – dazu ein einziges JPEG als Rückfall für sehr alte Browser. Die
Vorlage schreibt daraus ein `<picture>` mit `srcset` und `sizes`; der
Browser lädt am Handy die 640er und am großen Schirm die 2560er Fassung.

Im Schnitt lädt ein Besucher 102 kB am Handy, 243 kB am Laptop und 501 kB
auf einem Retina-Schirm.

### Ein neues Foto einbauen

Im Backend unter **Mediathek** hochladen. Die Umwandlung in WebP passiert
dabei automatisch. Danach im passenden Abschnitt (Hero, Leistungen,
Referenzen) aus der Liste auswählen.

Vier Dinge sind zu wissen:

1. **Je größer das Original, desto besser.** Die Datei direkt aus der
   Kamera, nicht die aus WhatsApp – die hat meist nur 1200 px.
2. **HEIC vom iPhone geht nicht.** Der Server kann das Format nicht lesen.
   Am iPhone unter *Einstellungen → Kamera → Formate* auf „Maximale
   Kompatibilität" stellen, dann kommen JPEGs heraus.
3. **Das Original bleibt liegen**, unter `site/inhalt/originale/`. Dadurch
   lässt sich jede Fassung später neu erzeugen – etwa wenn eine Breite
   dazukommt. Der Ordner wird nie ausgeliefert.
4. **Hochkant aufgenommene Fotos** werden anhand ihres EXIF-Vermerks
   geradegedreht. Sitzt der Ausschnitt im 16:9-Rahmen trotzdem falsch,
   hilft das Feld *Bildausschnitt* beim Projekt (`center 28%`).

### Alle Bilder auf einmal neu erzeugen

```bash
php werkzeug/bilder-neu.php              # alle
php werkzeug/bilder-neu.php live header  # nur diese
```

Nötig, wenn in `site/admin/kern/bild.php` an den Reglern gedreht wurde –
etwa an den Breiten oder an der Güte.

### Was noch fehlt

Von fünf Bildern gibt es kein hochauflösendes Original mehr; sie bleiben
auf großen Schirmen weich. Die Mediathek markiert sie orange:

| Bild | hat | Projekt |
|---|---|---|
| `rainbow` | 900 px | Rainbow Festival, Titelbild |
| `csd` | 1206 px | CSD München 2026, Titelbild |
| `sven` | 1080 px | Kreuzer Open Air, Titelbild |
| `sven-2` | 1536 px | Kreuzer Open Air, Bild 2 |
| `live-2` | 900 px | DIE 80er live, Bild 2 |

Wer die Originale noch hat: in der Mediathek hochladen, Haken bei
*gleichnamiges Bild ersetzen*. Alles andere passiert von selbst.

Außerdem fehlt `corporate.jpg` ganz – die mittlere Karte unter „Services"
zeigt deshalb einen leeren Rahmen.

## Bewegung im Hero

Zwei zurückhaltende Effekte, beide an der Marke entlang gedacht: Ihr macht
Licht, also bewegt sich Licht.

**Ein Lichtstrahl über dem Claim.** Ein schmales Band wandert schräg über
„Momente, die bleiben, weil alles passt." – alle 9,5 Sekunden ein Durchgang,
dazu einer auf Zuruf beim Überfahren mit der Maus. Ein Durchgang dauert rund
1,4 Sekunden, in der Spitze färbt er etwa jeden zehnten Pixel der Zeile.
Außerhalb des Bildes ruht er.

Der Strahl besteht aus drei Lagen, die zusammen erst als Licht lesbar werden –
einzeln tut es keine:

1. **Farbwechsel auf den Buchstaben.** Weiß kann nicht heller werden, deshalb
   ist der Strahl dort ein Farbton: Signalgelb läuft über die weiße Zeile,
   Weiß über die gelbe.
2. **Die Lichtbahn selbst**, eine schmale helle Spur im Aufhell-Modus
   (`mix-blend-mode: screen`) über der Überschrift. Sie hellt auf, was sie
   streift, und macht sichtbar, woher der Farbwechsel kommt.
3. **Ein Lichthof um die Buchstaben** (`text-shadow`), der anschwillt, während
   die Bahn die Zeile quert. Das ist der eigentliche Glanz: Auf weißen
   Buchstaben liest sich nicht die Aufhellung als Licht, sondern der Schein
   ringsherum. Die Radien stehen in `em`, damit der Hof auf kleinen Schirmen
   mitschrumpft.

Umgesetzt über einen Verlauf, der auf die Buchstaben zugeschnitten wird
(`background-clip: text`). Drei Dinge daran sind nicht offensichtlich:

- Unter dem Verlauf liegt eine **Grundfarbe**. Der Verlauf ist breiter als die
  Zeile und deckt sie beim Durchlaufen nicht überall ab – ohne Grundfarbe
  wären die Buchstaben dort durchsichtig, also weg.
- Die Randstopps tragen **dieselbe Farbe mit Alpha 0** statt `transparent`,
  sonst mischt manche Rechnung über Grau.
- Es gibt den Ablauf **zweimal unter zwei Namen**. Bleibt der Name gleich,
  startet der Browser die Animation nicht neu, sondern rechnet nur die Zeiten
  um – die abgelaufene Einstiegs-Animation bliebe abgelaufen und beim
  Überfahren passierte nichts.
- Die Lichtbahn braucht eine **Maske**, sonst schneidet ihr Kasten sie an
  allen vier Seiten hart ab: senkrecht läge eine helle Platte über der Zeile,
  waagerecht risse der Strahl hinter dem Komma abrupt ab. Eine Ellipse löst
  beides in einem Zug und braucht kein `mask-composite`, dessen Schreibweise
  sich zwischen den Browsern unterscheidet. Ihr Mittelpunkt sitzt links, weil
  der Text links steht – über den Buchstaben trägt die Bahn voll, dahinter
  fällt sie weich ab.
- Die Bahn ist **waagerecht exakt so breit wie die Zeilen**. Ist sie breiter,
  landen dieselben Prozentwerte an anderer Stelle, und Glanz und Farbwechsel
  laufen auseinander.
- Die Zeitkurve ist **linear**, und der Weg reicht genau von knapp links neben
  der Zeile bis knapp rechts daneben. Mit einer Ease-out-Kurve schoss der
  Strahl in 270 Millisekunden durch die Zeile und kroch danach 1,4 Sekunden
  im Unsichtbaren nach – sichtbar war er 17 Bilder lang, also gar nicht.
  Ein Scheinwerfer wandert gleichmäßig.

Der ganze Block steckt in einem `@supports`-Rahmen. Kann ein Browser
`background-clip: text` nicht, bleibt der Claim schlicht weiß und gelb.

**Das Bild fährt beim Scrollen heran** und tritt dabei zurück – von Maßstab
1,04 auf 1,13 und von 50 auf 32 Prozent Deckkraft über die erste Bildschirmhöhe.
Bevorzugt über eine scrollgebundene CSS-Animation, die außerhalb des
Hauptstrangs läuft. Kann der Browser das nicht, übernimmt `main.js` dieselbe
Bewegung – gesteuert von einem IntersectionObserver, der die Rechnung
abschaltet, sobald der Hero aus dem Bild ist. Beide Wege liefern dieselben
Werte.

Im Ruhe-Modus des Betriebssystems passiert nichts davon.

## Laufband der Leistungsfelder

Die drei Felder unter „Services" stehen nicht im Raster, sondern in einem
Laufband: Sie wandern langsam durchs Bild und lassen sich mit Maus, Finger,
Trackpad oder Pfeiltasten schieben. Das ersetzt Flickity von der alten Seite –
dieselben Einstellungen, nur ohne Bibliothek: drei Karten nebeneinander,
darunter zwei, auf dem Handy eine; Endlosschleife; Pause, sobald der
Abschnitt aus dem Bild ist oder jemand mit dem Trackpad dagegenscrollt.

Eine Karte ist ein Foto im Rahmen, darunter Titel und zwei Zeilen Text:

```html
<article class="card">
  <div class="card__rahmen">
    <div class="card__media" style="background-image:url('assets/img/live.jpg')" aria-hidden="true"></div>
  </div>
  <h3 class="card__title">Festival &amp; Touring</h3>
  <p class="card__text">…</p>
</article>
```

Fehlt die Bilddatei, bleibt der Rahmen als leere Fläche stehen – kein Loch
und kein kaputtes Bildsymbol. Genau das ist bei `corporate.jpg` gerade der
Fall.

Stellschrauben in `main.js`, ganz oben im Block:

| Was | Wert |
|---|---|
| Tempo | `var TEMPO = 28;` Pixel je Sekunde |
| Laufrichtung | `data-richtung="rechts"` am `.slider` in `index.html`, `"links"` dreht um |

Drei Dinge, die dabei zu wissen sind:

**Endlosschleife.** `main.js` hängt zwei Kopien der Karten an die Reihe und
faltet die Position immer in den mittleren Satz zurück. Die Kopien sind für
Screenreader ausgeblendet, dort erscheinen die drei Felder also genau einmal.

**Warum die Position im Skript liegt.** Browser runden `scrollLeft` auf ganze
Pixel. Ein Schritt von 0,45 px pro Bild verschwindet dadurch spurlos und das
Band stünde still. Die maßgebliche Position wird deshalb als Fließkommazahl im
Skript geführt und `scrollLeft` jedes Mal absolut gesetzt.

**Ohne JavaScript** bleibt eine ganz normale, seitwärts scrollbare Reihe –
Wischen und Trackpad funktionieren dann trotzdem. Bei eingeschaltetem
Ruhe-Modus des Betriebssystems läuft nichts von selbst, schieben geht weiter.

## Referenzen

Der Abschnitt `#referenzen` liegt zwischen Services und Kontakt. Jedes Projekt
steht gestapelt: Ort und Projektname sitzen unten links **im** Bild, darunter
läuft der Text in zwei Spalten, darunter die Gewerke. So trägt das Foto die
volle Breite – das ist der Beweis, um den es hier geht. Unter 960 px rutscht
der Kopf über das Bild und die Textspalten werden zu einer.

**Ein neues Projekt** ist ein kopierter Block:

```html
<article class="ref">
  <header class="ref__kopf">
    <p class="eyebrow">Ort, Anlass oder Datum</p>
    <h3 class="ref__titel">Projektname</h3>
  </header>

  <div class="ref__media">
    <button class="ref__bild" type="button" data-lupe-auf>
      <img class="ref__foto" src="assets/img/beispiel.jpg" alt="" loading="lazy" decoding="async">
      <span class="ref__zeichen" aria-hidden="true"></span>
      <span class="visually-hidden">Bilder zu „Projektname" ansehen</span>
    </button>
    <ul class="ref__bilder" data-lupe-titel="Projektname">
      <li><a href="assets/img/beispiel.jpg">Beschreibung des Bildes, ein Satz</a></li>
      <li><a href="assets/img/beispiel-2.jpg">…</a></li>
    </ul>
  </div>

  <div class="ref__text">
    <div class="ref__worum"><p>Worum ging es bei der Veranstaltung?</p></div>
    <div class="ref__unser"><p>Was hat Nova Works gemacht?</p></div>
    <dl class="gewerke">
      <dt>Gewerke</dt>
      <dd>Licht, Ton, Rigging</dd>
    </dl>
  </div>
</article>
```

Dazu drei Regeln:

**Höchstens drei Bilder** pro Projekt. Das erste in der `<ul>` ist zugleich
das sichtbare im Rahmen; die Großansicht blättert durch alle. Jedes `<li>`
braucht eine Beschreibung – die liest der Screenreader vor, und ohne
JavaScript ist die Liste eine ganz normale Linkliste.

**`alt` bleibt leer.** Der Schalter drumherum sagt bereits, worum es geht.
Zweimal dasselbe vorgelesen zu bekommen hilft niemandem.

**Die Gewerke** stehen als Fließtext, durch Komma getrennt, in der Reihenfolge
Licht, Ton, Rigging, LED/Video, Logistik, dann alles Weitere. Ist noch nicht
bekannt, was Nova Works auf einer Produktion gemacht hat, wird nicht geraten:

```html
<dd class="offen">noch offen</dd>
```

Solche Einträge erscheinen rot und gestrichelt – das ist Absicht, damit sie
nicht versehentlich live gehen.

**Steht ein Foto hoch statt quer,** sitzt der Ausschnitt im 16:9-Rahmen oft
falsch. Dafür gibt es `style="object-position:center 28%"` am `<img>`; der
Wert verschiebt den Ausschnitt nach oben oder unten.

## AGB

`site/agb.html` steht bereit, ist aber **noch ohne Inhalt**. Die Seite ist
angelegt, gestaltet und aus der Fußzeile aller fünf Seiten verlinkt – es fehlt
nur der Text.

Zum Einsetzen: in `agb.html` den rot gestrichelten Block
`<p class="offen offen--block">` durch den AGB-Text ersetzen. Die Auszeichnung
ist dieselbe wie in Impressum und Datenschutz, mehr als diese fünf Elemente
braucht es nicht:

```html
<h2>1. Geltungsbereich</h2>     <!-- Hauptabschnitte -->
<h3>Unterpunkt</h3>
<p>Absatz</p>
<ul><li>Aufzählung</li></ul>
<strong>Hervorhebung</strong>
```

Danach zwei Handgriffe, die leicht vergessen werden:

- In `agb.html` `<meta name="robots" content="noindex, follow">` auf
  `index, follow` ändern.
- In `sitemap.xml` einen Eintrag für `https://nova-works.de/agb.html`
  ergänzen, `changefreq yearly`, `priority 0.2` wie bei den anderen
  Rechtstexten.

Solange kein Text drinsteht, bleibt beides bewusst so: Eine leere Seite soll
weder im Index noch in der Sitemap auftauchen.

## Wo Gelb steht – und wo nicht mehr

Ein früherer Entwurf ließ die ganze Seite im Kontaktbereich auf Signalgelb
umschlagen, so wie es die alte Seite macht. Das war zu viel: Die Fläche
dominierte alles andere. Die Umschaltung über `data-schema` ist vollständig
entfernt – aus dem Stylesheet, aus `main.js` und aus dem Markup. Wer sie
zurückholen will, findet sie in der Historie bis Commit `c72dbac`.

Danach blieben vier Zierstücke in Gelb übrig, die alle vier inzwischen
ebenfalls weg sind:

- der warme Schein hinter der Kontakt-Überschrift (`.kontakt__schein`),
- die schmale gelbe Marke links daneben,
- die beiden gelben Waschungen über dem Kopfbild,
- der Farbtausch der Abschnitts-Überschriften beim Scrollen.

Gelb steht jetzt nur noch dort, wo es etwas heißt: auf dem Schalter „Projekt
starten", im Fokusrahmen, an den Pflichtfeld-Sternchen des Formulars, in der
Auswahlmarkierung, am Geltungshinweis der AGB und am Zähler der Großansicht.

## Überarbeitung des Entwurfs

Ein Durchgang mit der Frage, was auf der Seite nach Baukasten aussieht statt
nach dieser Firma. Geändert wurde:

- **Die Gewerke** standen als gleichförmige Pillen mit farbigen Punkten
  davor – 44 Stück über zehn Projekte. Die Punkte verschlüsselten eine
  Einteilung, die nirgends erklärt war. Jetzt steht eine
  Definitionsliste `<dl class="gewerke">`: links das Wort „Gewerke", rechts
  die Leistungen im Fließtext. Das liest sich wie ein Leistungsverzeichnis,
  und ein neues Projekt braucht keine Farbwahl mehr.
- **Das Einblenden beim Scrollen** lag auf 21 Stellen der Seite: Jeder
  Abschnitt verblasste herein und fuhr ein Stück nach oben. Das ist die
  verbreitetste Bewegung überhaupt und sagt nichts über den Inhalt.
  Ersatzlos entfallen – `data-reveal`, die CSS-Regeln und der
  IntersectionObserver in `main.js`.
- **Bewegung ohne Zutun** gibt es jetzt noch an zwei Stellen, und beide
  haben einen Grund: der Auftritt des Claims beim Ankommen auf der Seite,
  und die Bilder, die beim Scrollen langsam heranfahren – die tragen den
  Beweis, um den es auf dieser Seite geht. Dazu kommt das Laufband, das
  aber die Bedienung des Abschnitts ist, nicht sein Schmuck.
- **Die Karten unter „Services"** waren gerahmte Kästen mit runden Ecken,
  einem Verlauf darunter, einem zweiten darüber, und beim Überfahren hoben
  sie sich an und das Foto zoomte. Auf eine Karte, die man nicht anklicken
  kann, antwortet eine Bewegung auf nichts. Jetzt steht das Foto im eigenen
  Rahmen und die Zeile darunter – dieselbe Ordnung wie bei den Projekten.
- **Die Etiketten über den Überschriften** („Services", „Kontakt", „Live",
  „TV" …) sind weg, ebenso die gesperrte Großschrift und die Nummern
  01/02/03. Genummert wird, was eine Reihenfolge hat; drei Leistungsfelder
  haben keine.
- **Das farbig abgesetzte Wort in jeder Überschrift** ist weg. „Ausgewählte /
  Produktionen." ist ein Begriff, kein Gegensatz – die Farbe trennte
  Wörter, die zusammengehören.
- **Zwei Radien statt einem für alles:** `--radius` (4 px) für alles, was auf
  der Seite liegt – Bildrahmen, Eingabefelder, Hinweise. `--radius-lg`
  (10 px) für das, was über der Seite schwebt: das Einwilligungsfenster und
  seine Einstellungen. Die Rundung sagt damit etwas über die Ebene.
- **Die zwei englischen Eckzeilen im Kopfbild** („Based in Germany",
  „Established 2026") sind weg. Auf einer deutschsprachigen Seite zwei
  Etiketten, die nichts sagen, was nicht ohnehin im Impressum, im
  Kontaktteil und in der Fußzeile steht.

Großschrift steht jetzt an genau einer Stelle: im Claim über dem Kopfbild.
Der soll wuchten, alles andere darf still sein.

## Marke

- Claim: *systems creating moments*
- Signalgelb `#f8f808` auf Fast-Schwarz `#0b0b0c`
- Schrift: Zalando Sans, variabler Schnitt, liegt lokal (38 kB)
- Logo: `site/assets/img/logo-weiss.svg` (heller Grund: `logo-schwarz.svg`)
  Aus dem Original `reference/logo/novaworks_logo.eps` gewonnen – echte
  Montserrat-Konturen, keine Nachzeichnung. Die Wortmarke steht in Montserrat
  Light, der Claim in Montserrat Regular. Die Trennlinie liegt im Original als
  Verlaufsbild vor; im SVG ist sie ein Rechteck mit Verlauf, das an den Enden
  auf Transparenz statt auf Weiß ausläuft – so trägt sie auf hellem wie auf
  dunklem Grund. Grauwert der dunklen Fassung: `#393736`.

## Was bewusst weggefallen ist

- **Borlabs Cookie.** Die alte Seite lud das Plugin, hatte aber gar kein
  Tracking. Der Neubau lädt nichts von fremden Servern – die Schrift liegt
  lokal. Die Einwilligung wird trotzdem abgefragt, aber selbst gebaut und
  ohne Cookie: Die Entscheidung liegt unter `nova-einwilligung` im
  localStorage. Siehe den Abschnitt „Ihre Entscheidung zur Einwilligung" in
  `datenschutz.html`.
- **Der Blogbeitrag `hallo-welt`.** War der unveränderte
  WordPress-Standardbeitrag.
- **jQuery, Flickity, Fancybox, Superfish, Waypoints, WPBakery.** Zusammen
  795 kB CSS und JS. Der Neubau überträgt für die erste Ansicht 57 kB,
  Schrift und Logo eingerechnet.

## Offene Punkte

- **Datenschutzerklärung.** Zwei Stellen sind noch rot markiert: der Hoster
  (hängt an der Entscheidung Strato oder Netlify) und die Profile in den
  sozialen Netzwerken. Unabhängig davon: Der Text sollte vor dem Livegang
  jemand mit juristischem Blick durchgehen – wer dafür haftet, sollte ihn
  freigeben.
- **`corporate.jpg` fehlt.** Die mittlere Karte unter „Services" zeigt
  deshalb einen leeren Rahmen. Gesucht ist ein Foto aus dem Bereich
  Industrie und Business.
- **`Header1.jpeg` (6,6 MB)** liegt noch im Wurzelverzeichnis des Repos und
  wird öffentlich ausgeliefert. Kann raus, sobald das jemand bestätigt.
- **Die Projektbeschreibungen** stammen von mir und beschreiben, was auf den
  Fotos zu sehen ist und was aus öffentlichen Quellen hervorgeht. Bitte
  gegenlesen – besonders, welche Gewerke Nova Works auf welcher Produktion
  tatsächlich verantwortet hat.
- ~~Impressum, Absatz „Konzeption, Gestaltung & Betreuung".~~ Entfernt – die
  Seite wird neu aufgesetzt, die Agentur ist daran nicht beteiligt. Eine
  Pflichtangabe war der Absatz nie; § 5 DDG verlangt Betreiber, Vertretung,
  Kontakt, Register und Umsatzsteuer-ID, nicht den Gestalter.
- ~~Impressum, Disclaimer.~~ Der stehengebliebene Textbaustein „Steuerungs-
  und Informationstechnologie für Logistik" ist raus, der Satz nennt jetzt
  die NovaWorks GmbH. Schreibweise im ganzen Dokument einheitlich.
- ~~Der AGB-Text.~~ Steht vollständig in `agb.html`, Teil I bis VI, §§ 1–36.
- ~~Die Gewerke in den Referenzen.~~ Alle zehn Projekte sind ausgefüllt.
- ~~Die Bilder in den Referenzen.~~ Alle zehn Projekte haben eigene Fotos.

## Prüfungen

`pruefung/` enthält eine Prüfmappe ohne npm und ohne Abhängigkeiten im Repo –
sie braucht nur Node und ein Playwright in der Umgebung:

```bash
node pruefung/lauf.mjs              # alles
node pruefung/lauf.mjs projekte     # nur passende Dateien
```

Zwölf Dateien, zurzeit 431 Prüfungen. Was jede abdeckt, steht in
`pruefung/README.md`.
