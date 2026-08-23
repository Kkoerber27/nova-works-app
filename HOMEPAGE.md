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
„Momente, die bleiben, weil alles passt." – einmal kurz nach dem Seitenaufbau,
danach bei jedem Überfahren mit der Maus. Weiß kann nicht heller werden,
deshalb ist der Strahl ein Farbton: Signalgelb läuft über die weiße Zeile,
Weiß über die gelbe.

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

Die vier Felder unter „Services" stehen nicht mehr im Raster, sondern in einem
Laufband: Sie wandern langsam durchs Bild und lassen sich mit Maus, Finger,
Trackpad oder Pfeiltasten schieben. Das ersetzt Flickity von der alten Seite –
dieselben Einstellungen, nur ohne Bibliothek: drei Karten nebeneinander,
darunter zwei, auf dem Handy eine; Endlosschleife; Pause beim Überfahren.

Stellschrauben in `main.js`, ganz oben im Block:

| Was | Wert |
|---|---|
| Tempo | `var TEMPO = 28;` Pixel je Sekunde |
| Laufrichtung | `data-richtung="rechts"` am `.slider` in `index.html`, `"links"` dreht um |

Drei Dinge, die dabei zu wissen sind:

**Endlosschleife.** `main.js` hängt zwei Kopien der Karten an die Reihe und
faltet die Position immer in den mittleren Satz zurück. Die Kopien sind für
Screenreader ausgeblendet, dort erscheinen die vier Felder also genau einmal.

**Warum die Position im Skript liegt.** Browser runden `scrollLeft` auf ganze
Pixel. Ein Schritt von 0,45 px pro Bild verschwindet dadurch spurlos und das
Band stünde still. Die maßgebliche Position wird deshalb als Fließkommazahl im
Skript geführt und `scrollLeft` jedes Mal absolut gesetzt.

**Ohne JavaScript** bleibt eine ganz normale, seitwärts scrollbare Reihe –
Wischen und Trackpad funktionieren dann trotzdem. Bei eingeschaltetem
Ruhe-Modus des Betriebssystems läuft nichts von selbst, schieben geht weiter.

## Referenzen

Der Abschnitt `#referenzen` liegt zwischen Services und Kontakt. Jedes Projekt
ist ein `<article class="ref">` mit Bildspalte und Textspalte; jede zweite Zeile
läuft seitenverkehrt. Unter 960 px stapelt sich alles, Bild immer über dem Text.

**Ein neues Projekt** ist ein kopierter Block. Darin zu ändern:

| Was | Wo im Block |
|---|---|
| Ort, Jahr oder Anlass | `<p class="eyebrow">` |
| Projektname | `<h3 class="ref__titel">` |
| Beschreibung, zwei bis drei Sätze | das `<p>` darunter |
| Gewerke | die `<li>` in der `<ul class="trades">` |
| Bild | `background-image` im `style` des `.ref__bild` |

**Zwei Bilder** statt einem: ein zweites `<div class="ref__bild">` daneben
stellen, das Raster teilt die Spalte von selbst.

**Die Gewerke** nutzen dieselben Farben wie die Liste unter „Über uns" und wie
die interne Crewplanung:

```
Technische Leitung #8a8a8a   Licht #4a7fb5   Ton #5a9e6f
Rigging #c0713a              AV / Video #7c5cbf   Logistik #b5862a
```

Ein Eintrag sieht so aus:

```html
<li class="trades__item"><span class="trades__dot" style="--dot:#4a7fb5" aria-hidden="true"></span>Licht</li>
```

Steht in einem Projekt noch `<li class="trades__item offen">`, ist die Liste
nicht ausgefüllt. Solche Einträge erscheinen rot und gestrichelt – das ist
Absicht, damit sie nicht versehentlich live gehen.

## Farbwechsel beim Scrollen

Die Seite beginnt dunkel und wechselt im Kontaktbereich auf Signalgelb – Schrift,
Rahmen, Formularfelder und das Logo drehen sich mit. Danach endet die Seite in
Gelb. Das ist der Effekt der alten Seite, dort über Salients
`nectar-color-change-bg.js` und Midnight.js gelöst; hier ohne beides.

So funktioniert es:

- Jeder Abschnitt in `index.html` trägt `data-schema="dunkel"` oder `"signal"`.
- `main.js` beobachtet diese Abschnitte über ein schmales Band auf halber
  Fensterhöhe und setzt den Wert auf `<body>`. Kein Scroll-Listener.
- `style.css` definiert unter `body[data-schema="signal"]` dieselben Variablen
  noch einmal mit den hellen Werten. Alle Bausteine greifen unverändert darauf
  zu und invertieren dadurch von selbst.

Ein neuer Abschnitt braucht also nur das Attribut – am Stylesheet ist nichts zu
tun. Und wer die Farben ändern will, ändert die beiden Variablenblöcke, sonst
nichts.

Zwei Eigenheiten sind Absicht: In `body[data-schema="signal"]` trägt `--signal`
nicht Gelb, sondern das Dunkel – auf gelbem Grund ist der Akzent das Gegenteil.
Und das weiße Logo wird per `filter: brightness(0)` schwarz gerechnet, statt
eine zweite Datei zu laden.

Die Fußzeile hat bewusst kein eigenes Schema: Am Seitenende erreicht das
Auslöseband sie nie, die Seite endet deshalb im Gelb des Kontaktbereichs.

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

- **Cookie-Banner.** Die alte Seite lud Borlabs Cookie, hatte aber gar kein
  Tracking. Der Neubau lädt nichts von fremden Servern – die Schrift liegt
  lokal. Ohne einwilligungspflichtige Dienste braucht es kein Banner.
- **Der Blogbeitrag `hallo-welt`.** War der unveränderte
  WordPress-Standardbeitrag.
- **jQuery, Flickity, Fancybox, Superfish, Waypoints, WPBakery.** Zusammen
  795 kB CSS und JS. Der Neubau überträgt für die erste Ansicht 57 kB,
  Schrift und Logo eingerechnet.

## Offene Punkte

Zwei davon sind Rechtstexte. Beide wurden bewusst nicht angefasst – was darin
steht, ist eine Entscheidung, keine Programmierarbeit.

- **Impressum, Absatz „Konzeption, Gestaltung & Betreuung".** Dort steht noch
  die Werbeagentur Lebegern. Ob der Absatz bleibt, ist zu entscheiden.
- **Impressum, Disclaimer.** Der erste Satz nennt „Nova Works GmbH Steuerungs-
  und Informationstechnologie für Logistik". Das ist ein stehengebliebener
  Textbaustein aus einer fremden Vorlage und beschreibt nicht, was die Firma
  tut.
- **Datenschutzerklärung.** Der Abschnitt „Cookies" beschreibt Session- und
  Wiedererkennungs-Cookies, die es auf der neuen Seite nicht mehr gibt.
  Ebenso „Analyse-Tools und Tools von Drittanbietern". Beide Passagen
  beschreiben jetzt mehr Datenverarbeitung als tatsächlich stattfindet. Sollte
  jemand mit juristischem Blick durchgehen, bevor es live geht.
- **Fünf Fotos**, siehe oben.
- **Die Gewerke in den Referenzen.** Bei allen drei Projekten steht dort noch
  der rote Platzhalter. Was Nova Works auf welcher Produktion gemacht hat,
  steht in keiner der Unterlagen – das war nicht zu erraten und wurde deshalb
  offen gelassen. Muss vor dem Livegang ausgefüllt werden.
- **Die Bilder in den Referenzen** sind vorerst dieselben wie im Hero und auf
  den Karten. Sobald es projekteigene Fotos gibt, dort die Pfade tauschen.
- **Die Projektbeschreibungen** stammen von mir und beschreiben nur, was auf
  den Fotos zu sehen ist. Bitte gegenlesen.
