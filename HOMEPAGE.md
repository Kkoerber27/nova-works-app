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
├─ index.html              Startseite
├─ impressum.html          Rechtstext, 1:1 aus der alten Seite
├─ datenschutz.html        Rechtstext, 1:1 aus der alten Seite
├─ agb.html                Allgemeine Geschäftsbedingungen, §§ 1–36
├─ 404.html
├─ kontakt.php             Formular-Handler (verschickt die E-Mail)
├─ .htaccess               Weiterleitungen, Caching, Sicherheits-Header
├─ robots.txt · sitemap.xml
└─ assets/                 css · js · img · fonts

deploy/netlify.toml        Alternative zu .htaccess, falls Netlify
docs/inhalt.md             Inhaltsinventar der alten Seite
docs/hosting.md            Strato oder Netlify – beide Wege beschrieben
reference/                 Spiegelung der alten Seite + Extraktionsskript
```

## Lokal ansehen

```bash
cd site && php -S 127.0.0.1:4174
```

Dann <http://127.0.0.1:4174> öffnen. `php -S` statt eines reinen Dateiservers,
weil sonst `kontakt.php` nicht läuft.

## Hochladen

Zwei Wege, beide vorbereitet – die Entscheidung steht noch aus. Beschrieben in
[`docs/hosting.md`](docs/hosting.md).

## Etwas ändern

Alles ist Handarbeit an drei Dateien – kein Build, kein npm:

| Was | Wo |
|---|---|
| Texte, Struktur | `site/index.html` |
| Farben, Abstände, Schriftgrößen | `site/assets/css/style.css`, Block `:root` ganz oben |
| Verhalten (Menü, Reveals, Farbwechsel, Formular) | `site/assets/js/main.js` |
| Bilder | `site/assets/img/` |

**Wichtig beim Ändern von CSS oder JS:** `.htaccess` setzt für diese Dateien
ein Jahr Cache-Zeit. Wiederkehrende Besucher sehen sonst die alte Version.
Nach einer Änderung deshalb in allen vier HTML-Dateien die Versionsnummer
hochzählen:

```html
<link rel="stylesheet" href="assets/css/style.css?v=2">
<script src="assets/js/main.js?v=2" defer></script>
```

### Bilder einbauen

Fünf Fotos fehlen noch. Die Seite läuft ohne sie – wo ein Bild fehlt, trägt
ein Verlauf die Fläche, es entsteht kein kaputtes Bildsymbol. Sobald die
Dateien unter diesen Namen in `site/assets/img/` liegen, erscheinen sie von
selbst:

| Datei | Wo | Motiv | Stand |
|---|---|---|---|
| `header.jpg` | Hero, Vollbild | Ehrlich Brothers „NO LIMITS", volle Arena | **eingebaut** |
| `live.jpg` | Karte 1 | „DIE 80er live", Veltins-Arena | **eingebaut** |
| `corporate.jpg` | Karte 2 | offen – bislang kein passendes Motiv | offen |
| `tv.jpg` | Karte 3 | SWR3-Produktion, Regieplatz | **eingebaut** |
| `messe.jpg` | Karte 4 | offen – bislang kein Motiv | offen |

Die eingebauten Fotos wurden aus den Originalen verkleinert – Hero auf 1680 px
Breite bei Qualität 0,62, die Karten auf 800 px kurze Seite bei 0,72 bis 0,74.
Zusammen 673 kB. Das Hero-Motiv zeigt sehr viel Detail (eine volle Arena) und
komprimiert deshalb schlecht; die niedrige Qualitätsstufe fällt nicht auf, weil
das Bild bei 50 % Deckkraft unter einem Verlauf liegt. Die Originale liegen nicht im Repository.

Das Foto vom Open-Air-Festival, das vorher im Hero stand, ist damit frei. Es
steckt noch in der Historie (Commit `4ea472a`, `Live0.jpeg`) und lässt sich
jederzeit wieder hervorholen.

Der Hero braucht mindestens 1600 px Breite, besser 2400. Die vier Karten sind
kleiner, dort reichen 900 px. Alle Motive werden dunkel überblendet, helle
Fotos sind also kein Problem.

Querformat, vor dem Hochladen verkleinern:

```bash
magick original.jpg -resize "2400x>" -strip -quality 82 site/assets/img/header.jpg
```

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
