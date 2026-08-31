---
name: scheinwerfer-protokoll
description: Erstellt aus den Fotomeldungen im Postfach technik@nova-works.de ein Scheinwerfer-Protokoll als HTML und PDF. Nutzen, wenn nach Scheinwerfer-Protokoll, Lampenprotokoll, Bestandsaufnahme der Scheinwerfer oder dem Auswerten der Fotos aus technik@ gefragt wird.
---

# Scheinwerfer-Protokoll

Die Crew schickt pro Scheinwerfer eine Mail an `technik@nova-works.de`: Gerät,
Standort und Zustand in der Betreffzeile, Fotos im Anhang. Daraus entsteht ein
Protokoll.

## Meldeformat

```
Betreff: SW-14 | Halle 3, Traverse Nord, Feld B4 | Linse gesprungen
```

Drei Felder, getrennt durch `|`: **Gerät | Standort | Zustand**. Mehrere Fotos in
einer Mail gehören alle zu diesem einen Gerät.

## Ablauf

1. **Zeitraum klären.** Ohne Angabe den laufenden Tag nehmen und das im Bericht
   sagen. Ein Protokoll über „alles im Postfach" mischt sonst mehrere Jobs.

2. **Meldungen holen** mit `outlook_email_search`, `mailboxOwnerEmail:
   "technik@nova-works.de"`, dazu `afterDateTime` / `beforeDateTime`.

3. **Jede Nachricht einzeln mit `read_resource` öffnen.** Nicht überspringen und
   nicht aus der Trefferliste arbeiten: iPhone-Mails betten Fotos in den Text ein
   statt sie anzuhängen, und für solche Nachrichten meldet die Suche
   `hasAttachments: false`, obwohl das Foto da ist. Wer der Liste glaubt,
   protokolliert vorhandene Fotos als fehlend.

4. **Betreff zerlegen** an `|` in Gerät, Standort, Zustand. Leere Felder bleiben
   leer — sie werden im Protokoll als „nicht angegeben" ausgewiesen, nicht geraten.

5. **Dubletten markieren.** Gleiches Gerät am gleichen Standort ein zweites Mal,
   typischerweise als Weiterleitung: `status: "dublette"`. Sie bleibt als Zeile
   stehen, zählt aber nicht als eigene Position.

6. **Status setzen** je Meldung:

   | Status | Wann |
   |---|---|
   | `vollstaendig` | alle drei Betreff-Felder gefüllt **und** mindestens ein Foto |
   | `unvollstaendig` | ein Feld fehlt oder kein Foto dran |
   | `dublette` | dasselbe Gerät schon erfasst |

7. **Daten schreiben** nach dem Muster in `beispiel.json` (gleicher Ordner) und
   rendern:

   ```bash
   node scripts/protokoll.mjs /pfad/daten.json --pdf
   ```

   Ohne `--pdf` entsteht nur das HTML. Findet das Skript keinen Chromium-Browser,
   sagt es das und das HTML lässt sich von Hand drucken.

8. **Lücken melden.** Am Ende in zwei Zeilen: wie viele Geräte vollständig
   erfasst sind, und welche Meldungen nachgearbeitet werden müssen — mit Gerät
   und Grund.

## Fotos ansehen

`read_resource` auf die Anhang-URI liefert das Bild. Das lohnt sich, um den
**Gerätetyp** zu bestimmen (steht meist lesbar auf dem Gehäuse) und ihn als
`geraetetyp` einzutragen, oder um einen im Betreff behaupteten Zustand
gegenzuprüfen.

Nicht bei jedem Foto machen. Ein Bild in Originalgröße ist rund 5 MB; bei dreißig
Geräten ist das Postfach in einem Durchgang nicht sinnvoll durchzusehen. Ansehen,
wo es etwas entscheidet: unklarer Betreff, gemeldeter Schaden, Stichprobe.

## Was das Protokoll nicht kann

- **Kein Standort aus dem Bild.** Fotos aus dem Mailversand enthalten keine
  Koordinaten. Der Standort steht ausschließlich im Betreff — ist er zu vage,
  ist die Position verloren und muss neu angefahren werden. Das gehört in die
  Prüfhinweise, nicht stillschweigend übergangen.
- **Keine Ablage in SharePoint.** Die Anhänge lassen sich lesen, aber nicht
  weiterreichen. Die Fotos bleiben im Postfach; das Protokoll verlinkt über das
  Feld `mail` auf die Nachricht in Outlook.

## Wann etwas liegen bleibt

Diese Fälle nicht raten, sondern als `unvollstaendig` mit `hinweis` aufnehmen und
am Ende melden:

- **Betreff ohne `|`.** Kommt vor, wenn jemand die Vorlage kopiert statt sie
  auszufüllen. Steht die Gerätenummer erkennbar drin, als Hinweis vermerken —
  aber nie einen Standort erfinden, der nicht dasteht.
- **Foto unter 500 KB.** Das Mailprogramm hat es beim Versand verkleinert; für
  einen Schadensnachweis reicht es oft nicht. Das Protokoll markiert solche
  Fotos selbst mit „verkleinert".
- **Gerätenummer doppelt an verschiedenen Standorten.** Entweder ein Tippfehler
  oder ein umgehängtes Gerät — beides muss ein Mensch entscheiden.

Ein Protokoll ist ein Nachweis. Eine geratene Zeile darin ist schlimmer als eine
fehlende, weil niemand mehr nachsieht.
