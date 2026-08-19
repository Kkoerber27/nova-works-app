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
| Verhalten (Menü, Reveals, Formular) | `site/assets/js/main.js` |
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
