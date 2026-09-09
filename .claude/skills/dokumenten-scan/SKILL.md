---
name: dokumenten-scan
description: Erkennt, was für ein Dokument hereingekommen ist — Scan, Foto, Screenshot oder PDF — und übergibt es an den passenden Ablauf. Kennt die Typen "Autostrom privat", Ausgangsrechnung und Scheinwerfer-Meldung. Nutzen, wenn Dateien ohne Erklärung hochgeladen werden, wenn gefragt wird was mit einer Unterlage zu tun ist, oder wenn ein Dokumententyp erkannt, zugeordnet oder ergänzt werden soll.
---

# Dokumenten-Scan

Der Schritt vor allen anderen in Paperwork: Was ist da hereingekommen, und wer
bearbeitet es weiter? Erst wenn der Typ feststeht, greift der zugehörige Ablauf.

## Bekannte Dokumententypen

### Autostrom privat

Privat geladener Strom, den die Firma dem Inhaber erstattet. Auch kurz
„Autostrom" oder „Ladestrom" genannt.

- **Woran erkennbar:** Screenshots aus der Wallbox-App — untereinander eine Liste
  von Ladevorgängen, je Zeile Datum, kWh-Menge, Euro-Betrag, meist ein Ladeort.
- **Umfang: zu einem Monat gehören immer mehrere Screenshots.** Eine Monatsliste
  passt nicht auf einen Handy-Bildschirm, deshalb wird sie in Abschnitten
  abfotografiert, die sich absichtlich überlappen.
- **Weiter mit:** Skill `ladestrom-abrechnung`.

### Ausgangsrechnung

- **Woran erkennbar:** PDF aus Lexware Office, Rechnungsnummer der Form `RE…`,
  meist mit Projektnummer im Kopf oder in den Positionszeilen.
- **Umfang:** eine Datei je Rechnung.
- **Weiter mit:** Skill `rechnungsablage`.

### Scheinwerfer-Meldung

- **Woran erkennbar:** Foto eines Scheinwerfers mit drei Angaben dazu —
  Standort, Anzahl oder Gerät, Zustand.
- **Umfang:** viele Meldungen, verteilt über Tage, gehören zu einem Protokoll.
- **Weiter mit:** Skill `scheinwerfer-protokoll`.

## Wie viele Dateien zu einem Vorgang gehören

Das ist der Punkt, an dem ein Scan-Schritt am ehesten danebengreift: Er sieht
eine Datei und hält sie für den ganzen Vorgang.

- **Autostrom privat:** sammeln, nicht sofort abrechnen. Siehe unten.
- **Scheinwerfer-Meldung:** ebenso — eine Meldung ist kein Protokoll.
- **Ausgangsrechnung:** hier gilt das Gegenteil, jede Datei steht für sich.
  Mehrere PDFs sind mehrere Rechnungen, nicht eine in Teilen.

## Autostrom privat: sammeln, dann abrechnen

Der Monat kommt in Portionen. Wer die erste Portion für den Monat hält, schreibt
einen zu niedrigen Beleg — und das fällt später niemandem mehr auf, weil auf dem
PDF ja eine plausible Summe steht.

Deshalb ist die Grundannahme beim ersten Screenshot: **es kommen noch welche.**

1. **Ankommende Bilder dem Monat zuordnen** und beisammenhalten, auch über
   mehrere Nachrichten hinweg. Ein Zwischenstand ist keine Abrechnung.
2. **Kurz rückmelden, was da ist** — etwa „drei Screenshots für Juni, Einträge
   vom 03. bis 19.06." So sieht der Inhaber selbst, ob etwas fehlt.
3. **Nicht rechnen, solange nicht klar ist, dass der Monat vollständig ist.**
   Erst wenn er es sagt („das war's", „alle da") oder wenn die Bilder den Monat
   lückenlos abdecken, geht es an den Beleg.
4. **Überlappungen drinlassen.** Die letzte Session eines Screenshots taucht
   absichtlich oben im nächsten wieder auf — daran hängt, dass nichts verloren
   geht. Nicht selbst kürzen; das Skript entdoppelt über Datum, kWh und Betrag.
5. **Eine Lücke ansprechen.** Endet ein Screenshot am 11. und beginnt der nächste
   am 17., fehlt vermutlich ein Bild. Nachfragen statt weiterrechnen.

Am Ende steht **eine** Abrechnung für den ganzen Monat, wie bisher auch — nicht
mehrere Teilbelege.

## Wenn der Typ unklar ist

Nachfragen statt raten. Ein falsch einsortiertes Dokument landet im falschen
Ordner oder auf einem falschen Beleg, und dort fällt es niemandem mehr auf. Ein
Satz genügt: „Ich sehe drei Screenshots einer Ladehistorie — Autostrom privat für
Juni, oder etwas anderes?"

Ebenso nachfragen, wenn der Typ zwar klar ist, aber etwas dazu fehlt: der Monat
bei Autostrom privat, die Projektnummer bei einer Rechnung.

## Einen Typ ergänzen

Neue Dokumentarten kommen hierher — ein Abschnitt mit denselben drei Punkten
(woran erkennbar, Umfang, weiter mit) und, falls es einen eigenen Ablauf braucht,
eine Skill dafür. Der Umfang gehört ausdrücklich dazu: ob eine Datei den ganzen
Vorgang trägt oder ob mehrere zusammengehören, ist nichts, was sich aus der Datei
selbst ergibt.
