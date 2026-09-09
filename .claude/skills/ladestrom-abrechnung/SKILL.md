---
name: ladestrom-abrechnung
description: Dokumententyp "Autostrom privat" (Autostrom, Ladestrom) — die monatliche Ladestrom-Abrechnung aus den Screenshots der Wallbox-App als PDF-Erstattungsbeleg. Nutzen, wenn Screenshots einer Ladehistorie hochgeladen werden oder wenn nach Autostrom privat, der Abrechnung für einen Monat, der Ladestrom-Erstattung, dem Stromgeld fürs Privatauto oder dem Auswerten der Ladehistorie-Screenshots gefragt wird. Zu einem Monat gehören immer mehrere Screenshots.
---

# Ladestrom-Abrechnung

Aus den Screenshots der Ladehistorie wird ein Erstattungsbeleg als PDF, abgelegt
im selben Monatsordner wie die Screenshots.

Auslöser ist ein Satz wie „Erstelle die Abrechnung für Juni" — oder schlicht
hochgeladene Screenshots einer Ladehistorie, ohne weiteren Text.

## Dokumententyp „Autostrom privat"

So heißt diese Art Unterlage. Woran sie zu erkennen ist:

- Screenshots aus der Wallbox-App, untereinander eine Liste von Ladevorgängen
- je Zeile ein Datum, eine kWh-Menge, ein Euro-Betrag, meist ein Ladeort
- der Sache nach: privat geladener Strom, den die Firma dem Inhaber erstattet

**Zu einem Monat gehören immer mehrere Screenshots.** Eine Monatsliste passt
nicht auf einen Handy-Bildschirm, deshalb wird sie in Abschnitten abfotografiert,
die sich absichtlich überlappen. Daraus folgen drei Regeln:

- **Nie aus einem einzelnen Screenshot abrechnen.** Kommt nur einer an, ist das
  kein vollständiger Monat, sondern der Anfang einer Lieferung. Nachfragen, ob
  noch welche folgen, statt loszurechnen.
- **Alle Bilder eines Monats zusammen auswerten**, auch wenn sie in mehreren
  Nachrichten nacheinander eintrudeln.
- **Überlappungen nicht selbst wegkürzen.** Sie sind gewollt; das Skript
  entdoppelt (siehe Schritt 4).

Werden Screenshots im Chat hochgeladen statt in den Monatsordner gelegt: erst
den Monat klären, falls er nicht aus den Bildern hervorgeht, dann die Bilder
unter `LADESTROM_BASIS` in den Monatsordner speichern (anlegen, falls er fehlt)
und von dort weiterarbeiten. Der Beleg soll neben seinen Nachweisen liegen —
sonst steht später eine Summe ohne Beleg dafür da.

## Ablauf

1. **Monatsordner finden.** Unter `LADESTROM_BASIS` (Standard
   `~/Stromabrechnung privat`) liegt je Monat ein Ordner, etwa `Juni 2026`.
2. **Alle Bilder darin lesen** — PNG und JPG. Jeder Screenshot zeigt einen
   Ausschnitt der Ladehistorie.
3. **Sessions ablesen.** Je Eintrag: Datum, kWh, der in der App angezeigte
   Euro-Betrag und der Ladeort.
4. **Alles übergeben, auch Doppeltes.** Die Screenshots überlappen absichtlich,
   damit keine Session verloren geht. Nicht selbst aussortieren — das Skript
   entdoppelt über Datum, kWh und Betrag und meldet, was es verworfen hat.
5. **Skript aufrufen:**
   ```bash
   ./scripts/ladestrom.sh --monat "Juni 2026" --sessions @/tmp/sessions.json
   ```
   Die Sessions als JSON-Datei übergeben, nicht als Kommandozeilenargument —
   bei zwanzig Einträgen wird das sonst unleserlich.
6. **Ergebnis berichten:** Anzahl Sessions, kWh, Betrag, Pfad des PDF, und was
   aussortiert wurde.

## Format der Sessions

```json
[
  {"datum": "03.06.2026", "kwh": 41.2, "eur": 12.36, "ort": "Wallbox zuhause"},
  {"datum": "05.06.2026", "kwh": 38.5, "eur": 11.55, "ort": "Wallbox zuhause"}
]
```

`datum` als `TT.MM.JJJJ`, `kwh` und `eur` als Zahlen mit Punkt. `ort` ist
freiwillig, aber hilfreich: Ist er angegeben, verwirft das Skript alles, was
nicht an der eigenen Wallbox geladen wurde.

## Was das Skript selbst aussortiert

- **Doppelte Einträge** aus überlappenden Screenshots (gleiches Datum, gleiche
  kWh, gleicher Betrag)
- **Sessions ohne Euro-Betrag** — kostenlose Ladungen werden nicht erstattet
- **Fremde Ladeorte**, wenn `ort` mitgegeben und `LADESTROM_LADEORT` gesetzt ist

Diese drei Regeln gehören ins Skript und nicht ins Ablesen: Sie sind bei zwanzig
Zeilen mit dem Auge nicht verlässlich einzuhalten.

## Wenn etwas unklar ist

Screenshots sind Bilder, und Ablesen kann danebengehen. Im Zweifel nachfragen
statt schätzen:

- Eine Zahl ist unscharf oder abgeschnitten
- Zwischen zwei Screenshots klafft eine Lücke — der letzte Eintrag des einen
  taucht nicht im nächsten auf, dann fehlt womöglich eine Seite
- Der Monat im Ordnernamen passt nicht zu den Daten auf den Bildern
- Es liegt nur ein einziger Screenshot vor (siehe oben: ein Monat besteht
  immer aus mehreren)

Die Summe steht am Ende auf einem Beleg, der in die Buchhaltung geht. Eine
falsch abgelesene Zahl fällt dort niemandem mehr auf.
