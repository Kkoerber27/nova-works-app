---
name: ersatzbeleg
description: Dokumententyp "Ersatzbeleg" — erstellt einen Eigenbeleg als PDF für eine Ausgabe ohne Originalbeleg, etwa einen Kreditkartenumsatz, zu dem der Kassenzettel fehlt. Ein Foto (Ladesäulendisplay, Parkautomat, Ware) kann als Nachweis angehängt werden. Nutzen, wenn nach Ersatzbeleg, Eigenbeleg, einem fehlenden Beleg, einem Kreditkartenumsatz ohne Nachweis oder einem verlorenen Kassenzettel gefragt wird.
---

# Ersatzbeleg (Eigenbeleg)

Für Ausgaben, zu denen kein Originalbeleg vorliegt: Ladesäule ohne Belegdruck,
Parkautomat, Trinkgeld, verlorener Kassenzettel. Häufigster Anlass ist ein
Kreditkartenumsatz, der in der Abrechnung steht, aber ohne Nachweis dasteht.

## Was ein Eigenbeleg kann und was nicht

Er ist als **Betriebsausgabe** anerkannt, wenn er vollständig ist und die
betriebliche Veranlassung erkennbar bleibt.

Er ist **keine Rechnung im Sinne des §14 UStG**. Daraus folgt: **kein
Vorsteuerabzug.** Die Umsatzsteuer ist bei einem Eigenbeleg verloren. Deshalb
steht dieser Hinweis auch auf dem erzeugten PDF — damit ihn in der Buchhaltung
niemand als Rechnung behandelt.

Das ist der Grund für Schritt 1 im Ablauf.

## Ablauf

1. **Erst fragen, ob es doch eine richtige Rechnung gibt.** Bei Ladestrom-
   Anbietern fast immer: In der App des Anbieters liegen Monatsrechnungen oder
   Einzelbelege zum Herunterladen. Dasselbe bei Tankkarten, Hotels, Bahn,
   Paketdiensten. Eine echte Rechnung ist dem Eigenbeleg immer vorzuziehen,
   weil nur sie den Vorsteuerabzug erhält. Lohnt sich schon bei kleinen
   Beträgen — bei 22,45 € brutto sind das rund 3,58 € Vorsteuer.
2. **Angaben zusammentragen.** Die fünf Pflichtangaben stehen unten. Was fehlt,
   erfragen — nicht ausdenken.
3. **Betrag belegen, nicht schätzen.** Er kommt aus der Kreditkartenabrechnung
   oder vom Foto. Steht beides vor, müssen sie übereinstimmen; weichen sie ab,
   nachfragen, statt sich für eine Zahl zu entscheiden.
4. **Skript aufrufen:**
   ```bash
   ./scripts/eigenbeleg.sh --json @/tmp/beleg.json
   ```
   Zielordner ist `EIGENBELEG_BASIS`, oder per `--out` ein anderer.
5. **Ergebnis berichten:** Belegnummer, Empfänger, Betrag, Pfad des PDF — und
   den Hinweis, dass das PDF noch unterschrieben werden muss.

## Pflichtangaben

| Feld | Bedeutung |
|---|---|
| `empfaenger` | Wer hat das Geld bekommen (Name, möglichst mit Ort) |
| `art` | Was wurde bezahlt, mit Menge wenn sinnvoll |
| `datum` | Datum der Aufwendung, `TT.MM.JJJJ` |
| `betrag` | Gezahlter Betrag in Euro |
| `grund` | Warum kein Originalbeleg vorliegt |

Freiwillig, aber hilfreich: `ort`, `zahlungsart` (Standard Firmenkreditkarte),
`karte_letzte4`, `umsatz_datum` (Datum des Kartenumsatzes — stellt die
Verbindung zur Abrechnung her), `zweck` (betriebliche Veranlassung), `projekt`,
`nachweise` (Liste von Bildpfaden).

```json
{
  "empfaenger": "EnBW mobility+ Ladesäule, Autohof Bruchsal",
  "art": "Ladestrom Firmenwagen, 38,2 kWh",
  "datum": "14.09.2026",
  "betrag": "22,45",
  "karte_letzte4": "1234",
  "umsatz_datum": "16.09.2026",
  "grund": "Ladesäule gibt keinen Belegdruck aus, Anbieter stellt für Ad-hoc-Ladungen keine Einzelrechnung.",
  "zweck": "Fahrt zur Veranstaltung 26-0014, Aufbau",
  "projekt": "26-0014",
  "nachweise": ["/pfad/zum/foto.jpg"]
}
```

Der `grund` ist die Angabe, die ein Prüfer zuerst liest. „Beleg verloren" trägt
wenig; „Ladesäule gibt keinen Belegdruck aus" erklärt, warum es keinen gibt.
Konkret formulieren, nicht pauschal.

## Angaben von einem Foto ablesen

Ein Foto des Säulendisplays oder des Automaten ist ein guter Nachweis und kommt
als Anlage ins PDF. Beim Ablesen gilt dasselbe wie überall sonst: Was unscharf
oder abgeschnitten ist, wird erfragt und nicht geraten. Die abgelesenen Werte
vor dem Erzeugen einmal zur Bestätigung zeigen — auf dem Beleg steht später eine
Zahl, die niemand mehr gegenprüft.

## Grenzen

- **Keine Eigenbelege auf Vorrat** und keine für Ausgaben, die sich nicht
  tatsächlich belegen lassen. Der Beleg behauptet, die Ausgabe sei angefallen;
  das muss stimmen.
- **Bei größeren Beträgen zurückfragen.** Ein Eigenbeleg über einige Euro ist
  Alltag, einer über mehrere Hundert zieht Aufmerksamkeit auf sich. Dann lohnt
  der zweite Versuch, eine echte Rechnung zu bekommen.
- **Bewirtungen brauchen mehr.** Für Bewirtungsbelege gelten eigene Angaben
  (Teilnehmer, Anlass); ein einfacher Eigenbeleg genügt dort nicht.
- Das Skript erzeugt ein Dokument, es ersetzt keine steuerliche Beratung. Was im
  Einzelfall anerkannt wird, entscheidet das Finanzamt.
