#!/usr/bin/env python3
"""
Eigenbeleg (Ersatzbeleg) für eine Ausgabe ohne Originalbeleg.

    ./scripts/eigenbeleg.sh --json @beleg.json

Gedacht für den Fall, dass ein Kreditkartenumsatz ohne Belegnachweis dasteht:
Ladesäule ohne Belegdruck, Parkautomat, Trinkgeld, verlorener Kassenzettel. Ein
Foto (Säulendisplay, Automat, Ware) kann als Nachweis angehängt werden.

Ein Eigenbeleg ist als Betriebsausgabe anerkannt, wenn er vollständig ist und
die betriebliche Veranlassung erkennbar bleibt. Er ist aber keine Rechnung im
Sinne des §14 UStG — aus ihm gibt es keinen Vorsteuerabzug. Das steht deshalb
auch auf dem Dokument, damit es in der Buchhaltung nicht falsch behandelt wird.

Persönliches und Firmendaten kommen aus ~/.nova-works/env, nicht aus dem
Repository — das ist öffentlich.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path


def cfg(name: str, *fallbacks: str, default: str = "") -> str:
    """Erster gesetzter Wert aus name, dann den Ausweichnamen, sonst default."""
    for key in (name, *fallbacks):
        wert = os.environ.get(key, "").strip()
        if wert:
            return wert
    return default


# Die Firmenangaben sind dieselben wie beim Ladestrom-Empfänger. Wer die dort
# schon gesetzt hat, muss sie hier nicht doppelt pflegen.
FIRMA_NAME    = cfg("EIGENBELEG_FIRMA_NAME", "LADESTROM_EMPFAENGER_NAME")
FIRMA_STRASSE = cfg("EIGENBELEG_FIRMA_STRASSE", "LADESTROM_EMPFAENGER_STRASSE")
FIRMA_ORT     = cfg("EIGENBELEG_FIRMA_ORT", "LADESTROM_EMPFAENGER_ORT")
UNTERZEICHNER = cfg("EIGENBELEG_UNTERZEICHNER", "LADESTROM_ABSENDER_NAME")
BASIS         = Path(cfg("EIGENBELEG_BASIS", default=str(Path.home() / "Eigenbelege")))

CENT = Decimal("0.01")


def fehler(text: str):
    print(f"FEHLER {text}", file=sys.stderr)
    sys.exit(1)


def euro(wert) -> Decimal:
    """Auf Cent runden, kaufmännisch — der halbe Cent geht nach oben."""
    return Decimal(str(wert)).quantize(CENT, rounding=ROUND_HALF_UP)


def geld(wert: Decimal) -> str:
    return f"{wert:.2f} €".replace(".", ",")


def datum_pruefen(roh: str, feld: str) -> str:
    """TT.MM.JJJJ erzwingen und auf Gültigkeit prüfen."""
    roh = roh.strip()
    if not re.fullmatch(r"\d{2}\.\d{2}\.\d{4}", roh):
        fehler(f"{feld} muss als TT.MM.JJJJ angegeben werden, war: {roh!r}")
    try:
        datetime.strptime(roh, "%d.%m.%Y")
    except ValueError:
        fehler(f"{feld} ist kein gültiges Datum: {roh}")
    return roh


def beleg_lesen(arg: str) -> dict:
    if arg.startswith("@"):
        pfad = Path(arg[1:]).expanduser()
        if not pfad.is_file():
            fehler(f"Datei nicht gefunden: {pfad}")
        roh = pfad.read_text(encoding="utf-8")
    else:
        roh = arg
    try:
        daten = json.loads(roh)
    except json.JSONDecodeError as e:
        fehler(f"Kein gültiges JSON: {e}")
    if not isinstance(daten, dict):
        fehler("Erwartet wird ein JSON-Objekt mit den Angaben zum Beleg.")
    return daten


def beleg_pruefen(d: dict) -> dict:
    """
    Die Pflichtangaben sind nicht willkürlich: Zahlungsempfänger, Art der
    Aufwendung, Datum und Betrag machen die Ausgabe nachvollziehbar, und der
    Grund erklärt, warum kein Originalbeleg vorliegt. Fehlt einer davon, ist
    der Beleg angreifbar — dann lieber hier abbrechen als später beim Prüfer.
    """
    pflicht = {
        "empfaenger": "Zahlungsempfänger (wer hat das Geld bekommen)",
        "art":        "Art der Aufwendung (was wurde bezahlt)",
        "datum":      "Datum der Aufwendung (TT.MM.JJJJ)",
        "betrag":     "Betrag in Euro",
        "grund":      "Grund, warum kein Originalbeleg vorliegt",
    }
    fehlend = [f"  - {k}: {t}" for k, t in pflicht.items()
               if not str(d.get(k, "")).strip()]
    if fehlend:
        fehler("Dem Beleg fehlen Pflichtangaben:\n" + "\n".join(fehlend))

    try:
        betrag = euro(str(d["betrag"]).replace(",", "."))
    except Exception:
        fehler(f"Betrag ist keine Zahl: {d['betrag']!r}")
    if betrag <= 0:
        fehler(f"Betrag muss größer als 0 sein, war: {geld(betrag)}")

    nachweise = d.get("nachweise") or []
    if isinstance(nachweise, str):
        nachweise = [nachweise]
    bilder = []
    for n in nachweise:
        p = Path(str(n)).expanduser()
        if not p.is_file():
            fehler(f"Nachweis nicht gefunden: {p}")
        bilder.append(str(p))

    return {
        "empfaenger":   str(d["empfaenger"]).strip(),
        "art":          str(d["art"]).strip(),
        "datum":        datum_pruefen(str(d["datum"]), "datum"),
        "betrag":       betrag,
        "grund":        str(d["grund"]).strip(),
        "ort":          str(d.get("ort", "")).strip(),
        "zahlungsart":  str(d.get("zahlungsart", "Firmenkreditkarte")).strip(),
        "karte_letzte4": re.sub(r"\D", "", str(d.get("karte_letzte4", "")))[-4:],
        "umsatz_datum": datum_pruefen(str(d["umsatz_datum"]), "umsatz_datum")
                        if str(d.get("umsatz_datum", "")).strip() else "",
        "zweck":        str(d.get("zweck", "")).strip(),
        "projekt":      str(d.get("projekt", "")).strip(),
        "nachweise":    bilder,
    }


def belegnummer(ziel: Path, datum: str) -> str:
    """
    EB-JJJJMMTT-n, fortlaufend innerhalb eines Tages. Die Nummer ergibt sich
    aus den Dateien, die schon im Ordner liegen — kein Zählerstand, der mit
    dem Ordner auseinanderlaufen kann.
    """
    tag = datetime.strptime(datum, "%d.%m.%Y").strftime("%Y%m%d")
    muster = re.compile(rf"^Eigenbeleg_{tag}_(\d+)_")
    belegt = {int(m.group(1)) for p in ziel.glob(f"Eigenbeleg_{tag}_*")
              if (m := muster.match(p.name))}
    n = 1
    while n in belegt:
        n += 1
    return f"EB-{tag}-{n}", n


def dateiname(tag: str, n: int, empfaenger: str) -> str:
    kurz = re.sub(r"[^\w]+", "-", empfaenger, flags=re.UNICODE).strip("-")[:40]
    return f"Eigenbeleg_{tag}_{n}_{kurz or 'Ausgabe'}.pdf"


# ── PDF ────────────────────────────────────────────────────────────────
def erstelle_pdf(b: dict, nummer: str, ziel: Path) -> None:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                    TableStyle, HRFlowable, PageBreak,
                                    Image as RLImage)
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT
    from PIL import Image as PILImage

    doc = SimpleDocTemplate(str(ziel), pagesize=A4,
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=20 * mm,
                            title=f"Eigenbeleg {nummer}", author=FIRMA_NAME)
    W = A4[0] - 40 * mm
    BLAU = colors.HexColor("#003399")
    GRAU = colors.HexColor("#555555")

    def ps(font="Helvetica", size=9, lead=13, align=None, color=None, **kw):
        kw.update(fontName=font, fontSize=size, leading=lead)
        if align is not None:
            kw["alignment"] = align
        if color is not None:
            kw["textColor"] = color
        return ParagraphStyle(f"s{id(kw)}", **kw)

    def esc(t: str) -> str:
        return (str(t).replace("&", "&amp;").replace("<", "&lt;")
                      .replace(">", "&gt;"))

    story = [
        Paragraph(" · ".join(x for x in (FIRMA_NAME, FIRMA_STRASSE, FIRMA_ORT) if x),
                  ps(size=7, color=colors.HexColor("#888888"), spaceAfter=6)),
        Paragraph("Eigenbeleg", ps(font="Helvetica-Bold", size=17, lead=22, spaceAfter=1)),
        Paragraph("Ersatzbeleg für eine Ausgabe ohne Originalbeleg",
                  ps(size=10, lead=14, color=GRAU)),
        HRFlowable(width="100%", thickness=1, color=BLAU, spaceAfter=4 * mm),
    ]

    kopf = Table([[Paragraph(f"<b>Beleg-Nr.:</b> {esc(nummer)}", ps()),
                   Paragraph("Ausgestellt am " + datetime.today().strftime("%d.%m.%Y"),
                             ps(align=TA_RIGHT))]],
                 colWidths=[W * 0.5, W * 0.5])
    kopf.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [kopf, Spacer(1, 5 * mm)]

    # Angaben, die einen Eigenbeleg tragen. Reihenfolge wie beim Prüfen gelesen.
    felder = [("Zahlungsempfänger", b["empfaenger"]),
              ("Art der Aufwendung", b["art"]),
              ("Datum der Aufwendung", b["datum"])]
    if b["ort"]:
        felder.append(("Ort der Aufwendung", b["ort"]))
    felder.append(("Zahlungsart", b["zahlungsart"]))
    if b["karte_letzte4"]:
        felder.append(("Karte", f"Endziffern {b['karte_letzte4']}"))
    if b["umsatz_datum"]:
        felder.append(("Datum des Kartenumsatzes", b["umsatz_datum"]))
    if b["projekt"]:
        felder.append(("Projekt", b["projekt"]))

    zeilen = [[Paragraph(f"<b>{esc(k)}</b>", ps(font="Helvetica-Bold")),
               Paragraph(esc(v), ps())] for k, v in felder]
    tbl = Table(zeilen, colWidths=[W * 0.34, W * 0.66])
    tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F5F8FF"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CCCCCC")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [tbl, Spacer(1, 5 * mm)]

    summe = Table([[Paragraph("<b>Gezahlter Betrag</b>",
                              ps(font="Helvetica-Bold", size=11)),
                    Paragraph(f"<b>{geld(b['betrag'])}</b>",
                              ps(font="Helvetica-Bold", size=14, lead=19,
                                 align=TA_RIGHT, color=BLAU))]],
                  colWidths=[W * 0.6, W * 0.4])
    summe.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 1.2, BLAU),
        ("LINEBELOW", (0, 0), (-1, 0), 1.2, BLAU),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF3FF")),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [summe, Spacer(1, 6 * mm)]

    def block(titel: str, text: str):
        return [Paragraph(f"<b>{esc(titel)}</b>",
                          ps(font="Helvetica-Bold", size=9.5, spaceAfter=1)),
                Paragraph(esc(text), ps(size=9, lead=13)),
                Spacer(1, 4 * mm)]

    story += block("Grund, warum kein Originalbeleg vorliegt", b["grund"])
    if b["zweck"]:
        story += block("Betriebliche Veranlassung", b["zweck"])

    # Der Hinweis gehört aufs Dokument, nicht in eine Fußnote: Wer den Beleg
    # später bucht, soll nicht erst nachfragen müssen.
    story += [HRFlowable(width="100%", thickness=0.5,
                         color=colors.HexColor("#CCCCCC"), spaceAfter=3 * mm),
              Paragraph(
                  "<b>Kein Vorsteuerabzug.</b> Dieser Eigenbeleg ist keine Rechnung "
                  "im Sinne des §14 UStG. Der Betrag ist als Betriebsausgabe zu "
                  "buchen; ein Vorsteuerabzug ist daraus nicht möglich.",
                  ps(size=7.5, lead=11, color=GRAU)),
              Spacer(1, 2 * mm),
              Paragraph(
                  "Ich bestätige, dass die oben genannte Ausgabe tatsächlich "
                  "angefallen und betrieblich veranlasst ist und dass ein "
                  "Originalbeleg aus dem genannten Grund nicht vorliegt.",
                  ps(size=7.5, lead=11, color=GRAU)),
              Spacer(1, 14 * mm)]

    ort_zeile = f"{FIRMA_ORT.split(' ', 1)[-1] if FIRMA_ORT else ''}, " \
                f"{datetime.today().strftime('%d.%m.%Y')}"
    story.append(Table([[
        Paragraph("_______________________________<br/>" + esc(ort_zeile),
                  ps(size=7.5, lead=11, color=GRAU)),
        Paragraph("_______________________________<br/>"
                  + esc(f"Unterschrift{' – ' + UNTERZEICHNER if UNTERZEICHNER else ''}"),
                  ps(size=7.5, lead=11, color=GRAU)),
    ]], colWidths=[W * 0.45, W * 0.55]))

    if b["nachweise"]:
        story.append(PageBreak())
        story += [Paragraph("Anlage – Nachweise",
                            ps(font="Helvetica-Bold", size=12,
                               spaceAfter=4 * mm, color=BLAU)),
                  HRFlowable(width="100%", thickness=0.5, color=BLAU,
                             spaceAfter=4 * mm)]
        for i, bild in enumerate(b["nachweise"]):
            story.append(Paragraph(f"Nachweis {i + 1}: {esc(Path(bild).name)}",
                                   ps(font="Helvetica-Oblique", size=7.5,
                                      color=colors.HexColor("#666666"),
                                      spaceAfter=2 * mm)))
            try:
                with PILImage.open(bild) as pil:
                    iw, ih = pil.size
                faktor = min(W / iw, 215 * mm / ih)
                story.append(RLImage(bild, width=iw * faktor, height=ih * faktor))
            except Exception as e:
                story.append(Paragraph(f"[Bild nicht darstellbar: {esc(e)}]", ps(size=8)))
            if i < len(b["nachweise"]) - 1:
                story.append(PageBreak())

    doc.build(story)


# ── Hauptprogramm ──────────────────────────────────────────────────────
def main() -> None:
    p = argparse.ArgumentParser(
        description="Eigenbeleg (Ersatzbeleg) als PDF erzeugen.")
    p.add_argument("--json", required=True,
                   help="Angaben als JSON-Objekt oder @dateiname")
    p.add_argument("--out", default="",
                   help="Zielordner (Standard: EIGENBELEG_BASIS)")
    args = p.parse_args()

    for wert, name in ((FIRMA_NAME, "EIGENBELEG_FIRMA_NAME"),
                       (UNTERZEICHNER, "EIGENBELEG_UNTERZEICHNER")):
        if not wert:
            fehler(f"{name} ist nicht gesetzt — ohne Aussteller kein Beleg.\n"
                   f"       In ~/.nova-works/env eintragen.")

    beleg = beleg_pruefen(beleg_lesen(args.json))

    ziel_ordner = Path(args.out).expanduser() if args.out else BASIS
    if not ziel_ordner.is_dir():
        try:
            ziel_ordner.mkdir(parents=True)
        except OSError as e:
            fehler(f"Zielordner lässt sich nicht anlegen: {ziel_ordner} ({e})")

    nummer, n = belegnummer(ziel_ordner, beleg["datum"])
    tag = datetime.strptime(beleg["datum"], "%d.%m.%Y").strftime("%Y%m%d")
    pfad = ziel_ordner / dateiname(tag, n, beleg["empfaenger"])

    erstelle_pdf(beleg, nummer, pfad)

    print(json.dumps({
        "beleg_nr": nummer,
        "empfaenger": beleg["empfaenger"],
        "art": beleg["art"],
        "datum": beleg["datum"],
        "betrag": float(beleg["betrag"]),
        "zahlungsart": beleg["zahlungsart"],
        "karte_letzte4": beleg["karte_letzte4"],
        "umsatz_datum": beleg["umsatz_datum"],
        "projekt": beleg["projekt"],
        "nachweise": len(beleg["nachweise"]),
        "vorsteuerabzug": False,
        "pdf": str(pfad),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
