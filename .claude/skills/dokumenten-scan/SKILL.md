---
name: dokumenten-scan
description: Erkennt, was für ein Dokument hereingekommen ist — Scan, Foto, Screenshot oder PDF — und übergibt es an den passenden Ablauf. Kennt die Typen Autostrom, Ausgangsrechnung und Scheinwerfer-Meldung. Nutzen, wenn Dateien ohne Erklärung hochgeladen werden, wenn gefragt wird was mit einer Unterlage zu tun ist, oder wenn ein Dokumententyp erkannt, zugeordnet oder ergänzt werden soll.
---

# Dokumenten-Scan

Der Schritt vor allen anderen in Paperwork: Was ist da hereingekommen, und wer
bearbeitet es weiter? Erst wenn der Typ feststeht, greift der zugehörige Ablauf.

## Bekannte Dokumententypen

### Autostrom

Privat geladener Strom, den die Firma dem Inhaber erstattet. Auch „Autostrom
privat" oder „Ladestrom" genannt.

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

- **Autostrom:** nie aus einem einzelnen Screenshot abrechnen. Kommt nur
  einer an, ist das kein vollständiger Monat, sondern der Anfang einer Lieferung.
  Nachfragen, ob noch welche folgen. Trudeln sie über mehrere Nachrichten ein,
  alle zusammen auswerten. Überlappungen nicht selbst wegkürzen — das Skript
  entdoppelt zuverlässiger als das Auge.
- **Scheinwerfer-Meldung:** ebenso — eine Meldung ist kein Protokoll.
- **Ausgangsrechnung:** hier gilt das Gegenteil, jede Datei steht für sich.
  Mehrere PDFs sind mehrere Rechnungen, nicht eine in Teilen.

## Wenn der Typ unklar ist

Nachfragen statt raten. Ein falsch einsortiertes Dokument landet im falschen
Ordner oder auf einem falschen Beleg, und dort fällt es niemandem mehr auf. Ein
Satz genügt: „Ich sehe drei Screenshots einer Ladehistorie — Autostrom für
Juni, oder etwas anderes?"

Ebenso nachfragen, wenn der Typ zwar klar ist, aber etwas dazu fehlt: der Monat
bei Autostrom, die Projektnummer bei einer Rechnung.

## Einen Typ ergänzen

Neue Dokumentarten kommen hierher — ein Abschnitt mit denselben drei Punkten
(woran erkennbar, Umfang, weiter mit) und, falls es einen eigenen Ablauf braucht,
eine Skill dafür. Der Umfang gehört ausdrücklich dazu: ob eine Datei den ganzen
Vorgang trägt oder ob mehrere zusammengehören, ist nichts, was sich aus der Datei
selbst ergibt.
