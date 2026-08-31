---
name: scheinwerfer-protokoll
description: Erstellt aus den Fotomeldungen der Crew ein Scheinwerfer-Protokoll als HTML und PDF — aus einem WhatsApp-Chatexport oder aus dem Meldepostfach. Nutzen, wenn nach Scheinwerfer-Protokoll, Lampenprotokoll, Bestandsaufnahme der Scheinwerfer, einem WhatsApp-Export der Technikgruppe oder dem Auswerten der Fotomeldungen gefragt wird.
---

# Scheinwerfer-Protokoll

Die Crew meldet Scheinwerfer mit Foto und drei Angaben — **Standort, Anzahl oder
Gerät, Zustand**. Eine Meldung deckt entweder einen einzelnen Scheinwerfer ab
oder eine Gruppe auf einem Foto. Daraus entsteht ein Protokoll.

## Meldeformat

Drei Angaben, getrennt durch Komma: **Standort, Anzahl oder Gerät, Zustand**.
Die ersten beiden tragen die Position, der Zustand ist die Ergänzung.

```
Halle 3, Traverse Nord, 6, alle ok
Halle 3, Traverse Nord, Feld B4, SW-14, Linse gesprungen
```

In WhatsApp steht das als Bildunterschrift, per Mail in der Betreffzeile.

**Kurzform mit Foto.** In der Gruppe wird tatsächlich so geschrieben:

```
Hauptzelt 4x w600
Nebenzelt 3x litecraft, alle ok
```

Das ist keine schlampige Fassung, sondern die kürzere: Ort, wie viele, was —
und der Gerätetyp landet im Feld `geraetetyp` neben der Stückzahl. Erlaubt ist
sie nur **mit Foto**: ohne Bild wäre „kann 2x nachsehen" nicht von einer Meldung
zu unterscheiden. Ein Zustand gehört auch hier hinter ein Komma; ohne Komma
liesse sich nicht entscheiden, wo der Gerätetyp aufhört.

Ein Foto darf mehrere Lampen zeigen — dann steht vor dem Zustand ihre Anzahl,
und Standort wie Zustand gelten für die ganze Gruppe. Steht dort statt einer Zahl
eine Gerätebezeichnung, betrifft die Meldung genau dieses eine Gerät.

Der Standort steht bewusst **vorn**, nicht die Gerätenummer. Er ist das einzige
Feld, das sich nicht rekonstruieren lässt — die Fotos enthalten keine
Koordinaten. Stünde mal ein Gerät und mal ein Standort an erster Stelle, wäre bei
`Halle 3, …, ok` nicht zu entscheiden, was gemeint ist.

Zwei Wege führen hinein. Sie unterscheiden sich nur darin, woher die Meldungen
kommen; Format, Zerlegung, Status und Ablage sind gleich.

| Weg | Wann | Fotos im PDF |
|---|---|---|
| **WhatsApp-Export** (Regelfall) | Gruppe „Technik", Chat exportieren *mit Medien*, ZIP hierher | ja, ohne Zutun |
| **Meldepostfach** | wenn per Mail gemeldet wird, derzeit `info@nova-works.de` | nur über den Power-Automate-Ordner |

Der Export ist der Regelfall, weil die Bilder darin als echte Dateien liegen.
Aus dem Postfach sind sie nicht herauszuholen: `read_resource` zeigt Anhänge an,
gibt sie aber nicht als Datei heraus.

## Weg 1: WhatsApp-Export

Der Export kommt als ZIP hier in den Chat. Entpacken, einlesen, rendern:

```bash
unzip -q "WhatsApp Chat - Technik.zip" -d /tmp/wa
node scripts/whatsapp-import.mjs /tmp/wa --objekt "Glücksgefühle" --projekt 26-0032
node scripts/protokoll.mjs /tmp/wa/daten.json --pdf --ablegen
```

`whatsapp-import.mjs` macht das Zerlegen, die Dublettenprüfung und den Status selbst — es zerlegt von
hinten nach demselben Muster, erkennt Dubletten und setzt den Status. Was es
meldet, gehört in den Bericht an den Auftraggeber:

- **„Datei fehlt im Export"** — beim Exportieren wurde *Ohne Medien* gewählt.
  Neu exportieren lassen, die Texte allein sind kein Nachweis.
- **„Meldung nicht zerlegbar"** — die Beschriftung passt weder auf die Komma-
  noch auf die Kurzform. Die Zeile steht unvollständig im Protokoll;
  nachfordern, nicht raten.
- **„N Meldung(en) ohne Zustandsangabe"** — nur Ort und Anzahl gemeldet. Als
  Bestandsaufnahme brauchbar, als Schadensnachweis nicht. Ein Sammelhinweis,
  keine Zeile je Meldung.

Nachrichten **ohne Foto und ohne Meldeformat** sind Gruppengeplauder und werden
übergangen, nicht als leere Zeile aufgenommen. Der Lauf sagt, wie viele es
waren.

Nur der gewünschte Tag: `--tag 2026-09-05`. Ohne das steht der ganze Export im
Protokoll, und in einer Gruppe, die über mehrere Tage läuft, sind das mehrere
Jobs in einem Dokument.

**Beschriftung.** Sie darf im Bild stehen oder als eigene Nachricht direkt
danach — das Skript nimmt die nächste Nachricht desselben Absenders innerhalb
von fünf Minuten als Beschriftung, wenn das Foto keine hat. Weiter auseinander
nicht: dann ist nicht mehr sicher, dass sie zusammengehören.

**Was im Export fehlt.** Keine Koordinaten (WhatsApp entfernt sie beim Versand
als Foto) und keine Empfangszeit im Sinne des Postfachs — maßgeblich ist der
Zeitpunkt der Nachricht. Wer den Standort nicht schreibt, hat ihn nicht.

## Weg 2: Meldepostfach

Hier gibt es kein Importskript — diese Schritte macht der Skill selbst.

1. **Zeitraum klären.** Ohne Angabe den laufenden Tag nehmen und das im Bericht
   sagen. Ein Protokoll über „alles im Postfach" mischt sonst mehrere Jobs.

2. **Meldungen holen** mit `outlook_email_search`, dazu `afterDateTime` /
   `beforeDateTime`. Als `mailboxOwnerEmail` das Postfach nehmen, das im Auftrag
   genannt ist; ohne Angabe `info@nova-works.de`.

   Das Postfach ist bewusst kein fester Wert. Eigentlich gehört die Erfassung
   nach `technik@nova-works.de`, getrennt vom Geschäftsverkehr. Das Postfach
   lehnt seit dem 31.08.2026 aber jede Zustellung mit `550 5.6.200
   STOREDRV.Deliver; message is treated as poison` ab — ein Defekt im
   Postfachspeicher, den nur Microsoft beheben kann. Bis dahin läuft es über
   `info@`.

   **Folge für die Auswertung:** In `info@` liegt echter Geschäftsverkehr. Nur
   Nachrichten heranziehen, deren Betreff dem Meldeformat entspricht — drei
   kommagetrennte Angaben mit Stückzahl oder Gerätebezeichnung an vorletzter
   Stelle. Alles andere ist keine Meldung und gehört nicht ins Protokoll, auch
   nicht als unvollständige Zeile.

3. **Jede Nachricht einzeln mit `read_resource` öffnen.** Nicht überspringen und
   nicht aus der Trefferliste arbeiten: iPhone-Mails betten Fotos in den Text ein
   statt sie anzuhängen, und für solche Nachrichten meldet die Suche
   `hasAttachments: false`, obwohl das Foto da ist. Wer der Liste glaubt,
   protokolliert vorhandene Fotos als fehlend.

4. **Betreff von hinten zerlegen.** An Kommas trennen, dann:

   | Feld | Herkunft |
   |---|---|
   | Zustand | letztes Feld |
   | Anzahl oder Gerät | vorletztes Feld |
   | Standort | alles davor, mit Kommas wieder zusammengesetzt |

   **Nicht von vorn zählen.** Der Standort enthält selbst Kommas — „Halle 3,
   Traverse Nord, Feld B4" sind schon drei Felder. Nur von hinten liegen die
   Grenzen fest.

   Das vorletzte Feld entscheidet die Form: eine reine Zahl, auch mit „Stück",
   „St." oder „x" dahinter, ist eine Gruppenmeldung → `anzahl`. Eine
   Gerätebezeichnung — Buchstaben mit Ziffer, etwa `SW-14` oder `BeamX7-03` —
   meint ein einzelnes Gerät → `geraet`, `anzahl` bleibt weg.

   Zahl plus beliebiges Wort ist **keine** Anzahl: „5 ok" ist ein abgeschnittener
   Zustand, keine Stückzahl. Nur die drei genannten Zusätze zählen.

   Passt es auf **keines von beidem**, ist die Zerlegung nicht sicher: dann
   steckt vermutlich ein Komma im Zustand („5 ok, einer flackert"). Nicht raten
   — als `unvollstaendig` mit Hinweis aufnehmen und melden.

   Leere Felder bleiben leer und werden im Protokoll als „nicht angegeben"
   ausgewiesen.

5. **Dubletten markieren.** Gleiches Gerät am gleichen Standort ein zweites Mal,
   typischerweise als Weiterleitung: `status: "dublette"`. Sie bleibt als Zeile
   stehen, zählt aber nicht als eigene Position.

6. **Status setzen** je Meldung:

   | Status | Wann |
   |---|---|
   | `vollstaendig` | Standort **und** Anzahl oder Gerät **und** mindestens ein Foto |
   | `unvollstaendig` | Standort fehlt, Anzahl und Gerät fehlen, oder kein Foto dran |
   | `dublette` | dieselbe Position schon erfasst |

   **Der Zustand gehört nicht dazu.** Er fehlt meistens, weil nichts zu melden
   war — ihn zur Bedingung zu machen färbte ein sauber erfasstes Protokoll
   durchgehend rot, und der Balken „x von y vollständig" sagte nichts mehr aus.
   Fehlt er, steht das an der Zeile und einmal gesammelt in den Prüfhinweisen;
   erfunden wird er nie. Wo er zählt — bei einem Schaden —, ist er ohnehin
   geschrieben.

   Bei einer Gruppenmeldung zählt der Status für alle Lampen der Gruppe: sechs
   Stück ohne Foto sind sechs unvollständige Scheinwerfer, nicht einer.

## Rendern und ablegen

Gilt für beide Wege gleich.

**Daten schreiben** nach dem Muster in `beispiel.json` (gleicher Ordner),
rendern und ablegen:

```bash
node scripts/protokoll.mjs /pfad/daten.json --pdf --ablegen
```

Ohne `--pdf` entsteht nur das HTML. Findet das Skript keinen Chromium-Browser,
sagt es das und das HTML lässt sich von Hand drucken.

**Ablage macht `--ablegen` selbst.** Steht eine `projekt`-Nummer in den Daten,
kopiert das Skript das PDF nach
`Angebote/<projektnummer>_…/Schäden/Scheinwerfer-Protokoll_<Objekt>_<Datum>.pdf`
im lokal synchronisierten OneDrive; der Sync-Client schiebt es nach SharePoint.

**Nicht über `sharepoint_upload_file` gehen.** Das Werkzeug nimmt den Inhalt
nur inline als base64 entgegen — für ein Protokoll sind das über 200.000
Zeichen, die zeichengenau durchgereicht werden müssten. Ein einziges falsches
Zeichen ergibt ein beschädigtes PDF, und ein unlesbarer Nachweis im
Schadensordner ist schlimmer als gar keiner.

Das Skript legt nur ab, wenn genau ein Projektordner zur Nummer passt, und
überschreibt nie: Eine vorhandene Fassung desselben Tages bekommt eine
laufende Nummer. Meldet es `ABLAGE nicht erfolgt` (Rückgabewert 4), den Grund
im Bericht nennen und das PDF liegen lassen.

Der Ordner `Schäden` ist die Ablage, nicht `Technik` oder `Dokumente`: Dort
sucht ihn, wer später einen Schaden belegen muss.

**Lücken melden.** Am Ende in zwei Zeilen: wie viele Geräte vollständig
erfasst sind, und welche Meldungen nachgearbeitet werden müssen — mit Gerät
und Grund. Dazu, wohin das Protokoll abgelegt wurde oder warum nicht.

## Fotos ansehen

`read_resource` auf die Anhang-URI liefert das Bild. Das lohnt sich, um den
**Gerätetyp** zu bestimmen (steht meist lesbar auf dem Gehäuse) und ihn als
`geraetetyp` einzutragen, oder um einen im Betreff behaupteten Zustand
gegenzuprüfen.

Nicht bei jedem Foto machen. Ein Bild in Originalgröße ist rund 5 MB; bei dreißig
Geräten ist das Postfach in einem Durchgang nicht sinnvoll durchzusehen. Ansehen,
wo es etwas entscheidet: unklarer Betreff, gemeldeter Schaden, Stichprobe.

## Fotos ins Protokoll holen

Sollen die Bilder im Dokument stehen — bei Mängeln ist das der eigentliche
Nachweis —, braucht es die Dateien auf der Platte.

**Beim WhatsApp-Export ist das erledigt:** die Bilder liegen im entpackten
Ordner, `whatsapp-import.mjs` trägt ihren Pfad ein. Der Rest dieses Abschnitts
betrifft nur den Weg über das Postfach. Dort führt das Protokoll standardmäßig
nur, *dass* Fotos vorliegen: Anhänge lassen sich mit `read_resource` ansehen,
aber nicht als Datei weiterreichen; sie müssen also von woanders kommen.

**Regelfall: der Power-Automate-Flow.** Ein Flow legt jeden Anhang aus dem
Meldepostfach in einem OneDrive-Ordner ab und benennt ihn nach dem Empfangszeitpunkt:

```
20260831-134756-image0.jpeg
```

Damit die Zuordnung funktioniert, **bei jeder Meldung `empfangen` mitschreiben** —
den Wert von `receivedDateTime` unverändert, so wie Graph ihn liefert:

```json
"empfangen": "2026-08-31T13:47:56.000Z"
```

Beim Rendern den Ordner mitgeben:

```bash
node scripts/protokoll.mjs daten.json --pdf --ablegen --fotos ~/OneDrive…/technik-fotos
```

Das Skript bildet aus `empfangen` denselben Schlüssel wie der Flow aus dem
Dateinamen und ordnet exakt zu — kein Zeitfenster, in dem zwei kurz aufeinander
folgende Meldungen kollidieren. Meldungen mit Foto, für die keine Datei gefunden
wurde, listet es am Ende auf.

**Ausnahmefall: von Hand.** Anhang in Outlook in einen Ordner ziehen und den Pfad
ausdrücklich eintragen — das hat Vorrang vor der Zuordnung über den Ordner:

```json
"fotos": [{ "name": "image0.jpeg", "groesse": 5149962, "datei": "fotos/sw-14.jpg" }]
```

`protokoll.mjs` verkleinert die Bilder beim Rendern selbst auf 900 px längste
Kante und bettet sie unter der jeweiligen Zeile ein. Ein Originalfoto von 5 MB
wird so zu rund 200 KB; ohne das Verkleinern wäre ein Protokoll mit zehn Bildern
über 50 MB groß und ließe sich nicht mehr per Mail verschicken.

**Nicht alle Fotos einbetten.** Bei dreißig Positionen will niemand dreißig
Bilder im PDF. Die Regel: Was einen Mangel zeigt, kommt ins Dokument; der Rest
bleibt im Postfach und ist über den Link erreichbar.

Fehlt eine unter `datei` genannte Datei, wird sie beim Rendern **gemeldet** und
das Bild weggelassen — ein Protokoll, das vollständig aussieht und es nicht ist,
wäre schlimmer als eines mit einer sichtbaren Lücke.

## Was das Protokoll nicht kann

- **Kein Standort aus dem Bild.** Weder Mailversand noch WhatsApp lassen die
  Koordinaten im Foto stehen. Der Standort steht ausschließlich in der Meldung —
  ist er zu vage, ist die Position verloren und muss neu angefahren werden. Das gehört in die
  Prüfhinweise, nicht stillschweigend übergangen.
- **Anhänge lassen sich nicht selbst herunterladen.** `read_resource` zeigt sie,
  gibt sie aber nicht als Datei heraus. Die Bilder müssen über den
  Power-Automate-Flow im Ordner liegen; siehe „Fotos ins Protokoll holen". Ohne
  das bleiben sie im Postfach, und das Protokoll verlinkt über das Feld `mail`
  auf die Nachricht in Outlook. Betrifft nur den Weg über das Postfach — im
  WhatsApp-Export sind die Bilder ohnehin Dateien.

## Wann etwas liegen bleibt

Diese Fälle nicht raten, sondern als `unvollstaendig` mit `hinweis` aufnehmen und
am Ende melden:

- **Weniger als drei Kommafelder** in Betreff oder Bildunterschrift. Kommt vor,
  wenn jemand die Vorlage kopiert statt sie auszufüllen oder Angaben weglässt. Steht der Standort
  erkennbar drin, als Hinweis vermerken — aber nie einen Standort erfinden, der
  nicht dasteht.
- **Komma im Zustand.** Dann steht im vorletzten Feld weder eine Zahl noch eine
  Gerätebezeichnung, und der Standort wäre zu lang geraten. Die Meldung liegen
  lassen und nachfordern — der Zustand gehört ohne Komma in ein Feld.
- **Foto unter 500 KB.** Mailprogramm oder WhatsApp haben es beim Versand
  verkleinert; für einen Schadensnachweis reicht es oft nicht. Das Protokoll markiert solche
  Fotos selbst mit „verkleinert".
- **Gerätenummer doppelt an verschiedenen Standorten.** Entweder ein Tippfehler
  oder ein umgehängtes Gerät — beides muss ein Mensch entscheiden.
- **Gruppenmeldung mit gemischtem Zustand.** „…, 6, 5 ok, einer flackert" lässt
  offen, welcher — und zerlegt sich obendrein falsch. Die Gruppe als unvollständig
  führen und die Einzelmeldung nachfordern; eine Gruppe trägt genau einen Zustand.

Ein Protokoll ist ein Nachweis. Eine geratene Zeile darin ist schlimmer als eine
fehlende, weil niemand mehr nachsieht.
