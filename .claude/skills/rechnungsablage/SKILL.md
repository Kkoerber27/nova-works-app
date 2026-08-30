---
name: rechnungsablage
description: Legt offene Rechnungen aus Lexware Office als PDF im passenden Projektordner unter Rechnungen/Out in SharePoint ab. Nutzen, wenn nach Rechnungsablage, offenen Rechnungen, Lexware-Rechnungen oder dem Ablegen von Rechnungs-PDFs gefragt wird, und für den regelmäßigen Ablauf alle 10–15 Minuten.
---

# Rechnungsablage

Offene Rechnungen aus Lexware Office landen als PDF im Projektordner. Eine Runde
besteht aus vier Schritten pro Rechnung.

## Ablauf

1. **`lex_list_open_invoices`** — liefert alle offenen Rechnungen, die noch nicht
   abgelegt sind, samt gefundener Projektnummer.
2. Für jede Rechnung mit eindeutiger `projektnummer`:
   **`lex_download_invoice_pdf`** mit der `id` → gibt `pfad` und `dateiname` zurück.
3. **Zielordner suchen** mit `sharepoint_folder_search` nach `Out`, und aus den
   Treffern alle behalten, deren `webUrl` das Muster
   `Documents/Angebote/<projektnummer>_…/Rechnungen/Out` erfüllt.
   Fehlt der Ordner, mit `sharepoint_create_folder` unterhalb von `Rechnungen` anlegen.

   Bleibt **mehr als einer** übrig — bei `26-0007` sind es vier —, dann
   **`lex_match_project_folder`** mit der `invoice_id` und den gefundenen `webUrl`s
   aufrufen. Es vergleicht die übrigen Wörter des Rechnungstextes mit den
   Ordnernamen. Nur wenn `treffer` gesetzt ist, wird abgelegt; bei `null` bleibt die
   Rechnung liegen. Nicht selbst den ersten Kandidaten nehmen.
4. **Erst nachsehen, ob sie schon da ist.** Mit `sharepoint_search` nach der
   Rechnungsnummer suchen. Liegt bereits eine Datei zu dieser Nummer im Zielordner,
   **nicht hochladen** — stattdessen `lex_mark_filed` mit deren `webUrl` und
   `quelle: "vorhanden"` aufrufen und im Bericht erwähnen.

   Das Protokoll kennt nur, was diese Automatik selbst getan hat. Von Hand abgelegte
   Rechnungen sind ihm unbekannt, und ohne diese Prüfung würde sie beim ersten Lauf
   allesamt überschreiben.

5. **Hochladen** mit `sharepoint_upload_file`, danach **`lex_mark_filed`** mit der
   `webUrl` der hochgeladenen Datei als `ablageort`.

`lex_mark_filed` erst nach erfolgreichem Upload aufrufen — sonst gilt eine Rechnung
als abgelegt, die nirgends liegt.

## Wann nicht abgelegt wird

Diese Fälle bleiben liegen und werden am Ende gesammelt gemeldet, statt geraten:

- **`projektnummer` ist `null`** — die Rechnung trägt keine oder mehrere Nummern.
  Der Grund steht in `hinweis`.
- **Mehrere Ordner teilen sich die Nummer** und `lex_match_project_folder` liefert
  `treffer: null` — weil kein Wort des Rechnungstextes die Ordner unterscheidet oder
  mehrere gleich gut passen. Der `hinweis` sagt, welcher Fall vorliegt.
- **Eine Datei gleichen Namens liegt schon dort** und stammt erkennbar aus einer
  anderen Rechnung.
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
