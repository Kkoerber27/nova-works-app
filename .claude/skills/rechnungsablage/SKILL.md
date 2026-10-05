---
name: rechnungsablage
description: Legt offene Rechnungen aus Lexware Office als PDF im passenden Projektordner unter Rechnungen/Out im synchronisierten OneDrive ab (von dort synchronisiert OneDrive nach SharePoint). Nutzen, wenn nach Rechnungsablage, offenen Rechnungen, Lexware-Rechnungen oder dem Ablegen von Rechnungs-PDFs gefragt wird, und für den regelmäßigen Ablauf alle 10–15 Minuten.
---

# Rechnungsablage

Offene Rechnungen aus Lexware Office landen als PDF im Projektordner. Eine Runde
besteht aus fünf Schritten pro Rechnung.

## Ablauf

1. **`lex_list_open_invoices`** — liefert alle offenen Rechnungen, die noch nicht
   abgelegt sind, samt gefundener Projektnummer.

2. **Zielordner bestimmen.** Die Projektordner liegen lokal im synchronisierten
   OneDrive:

   ```
   $PROJEKT_ABLAGE_ROOT                                  (falls gesetzt)
   ~/Library/CloudStorage/OneDrive-NovaWorksGmbH/Angebote (sonst)
     └── <projektnummer>_<Projektname>/Rechnungen/Out
   ```

   Passende Ordner über das Muster `<projektnummer>_*` suchen. Fehlt
   `Rechnungen/Out` in einem sonst passenden Projektordner, bleibt die Rechnung
   liegen — einen Projektordner legt diese Automatik nicht an.

   Bleibt **mehr als einer** übrig, zuerst in **Feste Zuordnungen** (unten)
   nachsehen. Steht die Projektnummer dort, gilt der dort genannte Ordner.

   Steht sie dort nicht, **`lex_match_project_folder`** mit der `invoice_id` und
   den gefundenen Pfaden aufrufen. Es vergleicht die übrigen Wörter des
   Rechnungstextes mit den Ordnernamen. Nur wenn `treffer` gesetzt ist, wird
   abgelegt; bei `null` bleibt die Rechnung liegen. Nicht selbst den ersten
   Kandidaten nehmen.

3. **Erst nachsehen, ob sie schon da ist.** Im Zielordner nach der
   Rechnungsnummer sehen. Liegt dort bereits eine Datei zu dieser Nummer,
   **nicht herunterladen** — stattdessen `lex_mark_filed` mit deren Pfad und
   `quelle: "vorhanden"` aufrufen und im Bericht erwähnen.

   Das Protokoll kennt nur, was diese Automatik selbst getan hat. Von Hand
   abgelegte Rechnungen sind ihm unbekannt, und ohne diese Prüfung würde sie
   beim ersten Lauf allesamt überschreiben.

4. **`lex_download_invoice_pdf`** mit der `id` **und `target_dir` = dem
   Zielordner**. Das PDF entsteht damit direkt an seinem Platz; OneDrive
   synchronisiert es nach SharePoint.

   Der Dateiname ist deterministisch (`RE_<Nummer>_<Datum>_<Kunde>.pdf`), eine
   zweimal abgelegte Rechnung überschreibt sich also selbst, statt sich zu
   verdoppeln.

5. **`lex_mark_filed`** mit `ablageort` = dem vollen Pfad aus der Antwort
   (`pfad`), damit die nächste Runde sie überspringt.

`lex_mark_filed` erst aufrufen, wenn die Datei wirklich im Zielordner liegt —
sonst gilt eine Rechnung als abgelegt, die nirgends liegt.

## Warum nicht über SharePoint hochladen

Weil `sharepoint_upload_file` die Datei als Base64-Text entgegennimmt. Ein PDF
von 140 kB sind rund 190.000 Zeichen, die durch das Modell laufen müssten. Das
ist nicht nur langsam, sondern unzuverlässig — und ein einzelnes verrutschtes
Zeichen fällt nicht auf: Die Datei läge im Projektordner und wäre unlesbar.

Der Umweg über die lokale OneDrive-Spiegelung vermeidet das: Die Bytes gehen von
Lexware direkt auf die Platte, und was sie von dort nach SharePoint trägt, ist
die Synchronisation von Microsoft — nicht ein Sprachmodell.

## Feste Zuordnungen

Wo mehrere Ordner zu einer Projektnummer gehören, der Rechnungstext aber nie
zwischen ihnen entscheidet, hilft kein Vergleichen — dann ist es eine
Festlegung des Inhabers. Diese hier gelten ohne weitere Prüfung:

| Projektnummer | Ordner | Festgelegt am |
|---|---|---|
| `26-0007` | `26-0007_80er Live` (ohne Zusatz) | 05.10.2026 |

Zu `26-0007` gibt es vier Ordner — `80er Live`, `80er Live Frankfurt`,
`80er Live Hamburg`, `80er Live Schalke`. **Alle** Rechnungen und Dokumente mit
dieser Nummer gehören in den ohne Zusatz; die drei Städte-Ordner bekommen aus
der Rechnungsablage nichts. `lex_match_project_folder` wird für `26-0007` gar
nicht erst aufgerufen.

## Wann nicht abgelegt wird

Diese Fälle bleiben liegen und werden am Ende gesammelt gemeldet, statt geraten:

- **`projektnummer` ist `null`** — die Rechnung trägt keine oder mehrere Nummern.
  Der Grund steht in `hinweis`.
- **Mehrere Ordner teilen sich die Nummer** und `lex_match_project_folder` liefert
  `treffer: null` — weil kein Wort des Rechnungstextes die Ordner unterscheidet oder
  mehrere gleich gut passen. Der `hinweis` sagt, welcher Fall vorliegt.
- **Eine Datei gleichen Namens liegt schon dort** und stammt erkennbar aus einer
  anderen Rechnung.
- **Der Projektordner oder sein `Rechnungen/Out` fehlt** — dann ist entweder die
  Nummer falsch oder der Ordner noch nicht angelegt. Beides ist nichts, was diese
  Automatik entscheiden sollte.
- **OneDrive synchronisiert gerade nicht.** Liegt die Datei nach dem Herunterladen
  zwar lokal, meldet OneDrive aber einen Fehler, ist sie trotzdem abgelegt — die
  Synchronisation holt das nach. Nicht erneut herunterladen.
- **Die Projektnummer stammt aus den Positionen** (`projektnummer_quelle:
  "positionen"`) und der Betrag ist erheblich. Der Kopf schweigt dann, und ein
  Positionstext wie „laut Angebot 26-0014" kann sich auch auf eine Vorleistung
  beziehen. Im Bericht erwähnen und einmal bestätigen lassen.

Eine falsch abgelegte Rechnung fällt erst bei der Steuerprüfung auf. Im Zweifel
liegen lassen und fragen.

## Rückmeldung

Am Ende einer Runde kurz berichten: wie viele abgelegt wurden, und welche Rechnungen
aus welchem Grund auf eine Entscheidung warten — mit Rechnungsnummer und Kunde, damit
die Entscheidung ohne Nachschlagen möglich ist.

Ist nichts abzulegen und wartet nichts, nichts melden.
