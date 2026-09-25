# Prüfungen der Homepage

Die Seite unter `site/` hat keinen Build-Schritt: reines HTML, CSS und
JavaScript, von Hand gepflegt. Dafür hat sie diese Prüfungen. Sie
fahren die echte Seite in einem Browser auf und messen, was dabei
herauskommt — nicht, was im Quelltext steht.

## Aufrufen

```
node pruefung/lauf.mjs              alle Prüfungen
node pruefung/lauf.mjs breite hero  nur diese
```

Der Lauf beendet sich mit 1, sobald etwas fehlschlägt. Er braucht Node,
Playwright und **PHP** – seit dem Umbau ist die Startseite `index.php`,
und der Server der Prüfmappe ist deshalb der eingebaute von PHP. Er wird
mit denselben Grenzen gestartet, die `site/.user.ini` auf dem Server
setzt; eine Prüfung mit anderen Grenzen als der Ernstfall prüft den
falschen Ernstfall.

`13-backend.mjs` verändert echte Dateien – Inhalte, Zugangsdatei, Bilder.
Alles, was er anfasst, legt er vorher weg und stellt es am Ende zurück,
auch wenn eine Prüfung mittendrin fehlschlägt.

**Vor jedem Commit an `site/` einmal laufen lassen.**

## Was geprüft wird

| Datei | Worum es geht |
|---|---|
| `01-projekte.mjs` | Jedes Projekt hat Titel, Ort, Bild oder roten Platzhalter, Gewerke als benannte Liste und zwei Absätze. Fotos laden erst beim Heranscrollen. Ohne JavaScript steht alles im Quelltext. |
| `02-grossansicht.mjs` | Blättern, Zähler, Fotonachweis, Escape, Klick daneben. Ein einzelnes Bild bekommt weder Pfeile noch Zähler. |
| `03-breite.mjs` | Kein seitlicher Überlauf — fünf Seiten, sieben Breiten von 320 bis 1920 px. Hat am meisten gefunden. |
| `04-hero.mjs` | Der Claim wird in seine tatsächlichen Zeilen zerlegt und fährt versetzt herein. Am Handy bricht er anders um und bleibt vollständig. |
| `05-bewegung.mjs` | Bilder fahren beim Scrollen heran — und sonst nichts: Überschriften wechseln unterwegs nicht die Farbe und tragen keinen farbig abgesetzten Halbsatz. Im Ruhe-Modus steht alles still. |
| `06-navigation.mjs` | Navigation und Pflichtangaben auf allen Seiten, klebende Kopfzeile, Laufband mit Tastatur, Menü am Handy. |
| `07-formular.mjs` | Pflichtfelder, Fehlermeldungen, Honigtopf, Erfolg und Misserfolg. Ohne JavaScript ein normales Formular. |
| `08-zustimmung.mjs` | Einwilligung: gleich große und gleich gestaltete Wege, Wegklicken ist keine Zustimmung, kein Cookie, nichts nach draußen. |
| `09-recht.mjs` | Pflichtangaben im Impressum, AGB vollständig und durchnummeriert, Datenschutzerklärung gegen den echten Quelltext. Dazu: Auf keiner der drei Seiten darf sich ein Block mit dem nächsten überlappen – genau das war passiert, als ein negativer Abstand aus einer früheren Fassung die Unterzeile der AGB in den Titel zog. |
| `10-logo.mjs` | Der Trennstrich im Logo ist überall mindestens ein Pixel hoch und hebt sich messbar ab. |
| `11-druck.mjs` | Rechtstexte drucken schwarz auf weiß, ohne Kopf und Fuß. |
| `12-vorschau.mjs` | Die Vorschau ist eine zweite Umgebung und wird auch so geprüft. |
| `13-backend.mjs` | Der ganze Weg durch `/admin`: einrichten, anmelden, ändern, auf der Website wiederfinden, zurückholen, Foto hochladen, löschen. Dazu die Riegel: kein Zugang ohne Anmeldung, kein Formular ohne Merkmal, kein Löschen eines benutzten Bildes, kein `<script>` im Rechtstext. |

Die Prüfungen kommen bewusst ohne feste Zahlen aus: Projekte kommen
dazu, Fotos werden nachgereicht. Geprüft wird die Regel, nicht der
Stand.

## Werkzeuge daneben

```
node pruefung/bau.mjs [ziel.html]     Vorschau als einzelne Datei bauen
node pruefung/bild.mjs <von> <nach>   Kamerabild auf Webgröße bringen
```

`bau.mjs` bettet Stylesheet, Skript, Schrift und alle Bilder ein. Die
Datei steht danach für sich allein und lässt sich verschicken oder als
Artefakt veröffentlichen.

`bild.mjs` rechnet eine Kameravorlage auf höchstens 1600 × 900 px
herunter. Die Vorlage danach aus `site/assets/img/` entfernen — das
Repository soll keine 4-MB-Bilder mit sich schleppen.

## Warum es diesen Ordner gibt

Diese Prüfungen lagen zuerst in einem temporären Verzeichnis. Beim
Neuaufsetzen der Arbeitsumgebung waren sie weg und mussten neu
geschrieben werden. Deshalb liegen sie jetzt im Repository.
