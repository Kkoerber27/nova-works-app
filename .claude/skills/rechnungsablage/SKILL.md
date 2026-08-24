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
   Treffern denjenigen nehmen, dessen `webUrl` das Muster
   `Documents/Angebote/<projektnummer>_…/Rechnungen/Out` erfüllt.
   Fehlt der Ordner, mit `sharepoint_create_folder` unterhalb von `Rechnungen` anlegen.
4. **Hochladen** mit `sharepoint_upload_file`, danach **`lex_mark_filed`** mit der
   `webUrl` der hochgeladenen Datei als `ablageort`.

`lex_mark_filed` erst nach erfolgreichem Upload aufrufen — sonst gilt eine Rechnung
als abgelegt, die nirgends liegt.

## Wann nicht abgelegt wird

Diese Fälle bleiben liegen und werden am Ende gesammelt gemeldet, statt geraten:

- **`projektnummer` ist `null`** — die Rechnung trägt keine oder mehrere Nummern.
  Der Grund steht in `hinweis`.
- **Mehrere Ordner teilen sich die Nummer.** `26-0007` gibt es viermal
  (80er Live, … Frankfurt, … Hamburg, … Schalke), `26-0021` zweimal. Wenn die Suche
  mehr als einen passenden `Out`-Ordner liefert, ist das Ziel nicht bestimmbar.
- **Eine Datei gleichen Namens liegt schon dort** und stammt erkennbar aus einer
  anderen Rechnung.

Eine falsch abgelegte Rechnung fällt erst bei der Steuerprüfung auf. Im Zweifel
liegen lassen und fragen.

## Rückmeldung

Am Ende einer Runde kurz berichten: wie viele abgelegt wurden, und welche Rechnungen
aus welchem Grund auf eine Entscheidung warten — mit Rechnungsnummer und Kunde, damit
die Entscheidung ohne Nachschlagen möglich ist.

Ist nichts abzulegen und wartet nichts, nichts melden.
