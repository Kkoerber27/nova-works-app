#!/usr/bin/env python3
"""
Ladestrom-Abrechnung – erzeugt den monatlichen Erstattungsbeleg.

    ./scripts/ladestrom.sh --monat "Juni 2026" --sessions @sessions.json

Die Sessions liest Claude aus den Screenshots der Wallbox-App; dieses Skript
rechnet, entdoppelt und setzt das PDF. Alles Persönliche — Namen, Anschriften,
Erstattungssatz, Datenordner — kommt aus der Umgebung und steht nicht im
Repository, denn das ist öffentlich.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# ── Konfiguration aus der Umgebung ─────────────────────────────────────
def cfg(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()

ABSENDER_NAME    = cfg("LADESTROM_ABSENDER_NAME")
ABSENDER_STRASSE = cfg("LADESTROM_ABSENDER_STRASSE")
ABSENDER_ORT     = cfg("LADESTROM_ABSENDER_ORT")
EMPFAENGER_NAME    = cfg("LADESTROM_EMPFAENGER_NAME")
EMPFAENGER_STRASSE = cfg("LADESTROM_EMPFAENGER_STRASSE")
EMPFAENGER_ORT     = cfg("LADESTROM_EMPFAENGER_ORT")
LADEORT            = cfg("LADESTROM_LADEORT", ABSENDER_STRASSE)
BASIS              = Path(cfg("LADESTROM_BASIS", str(Path.home() / "Stromabrechnung privat")))

MONATE_DE = {
    "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4,
    "mai": 5, "juni": 6, "juli": 7, "august": 8, "september": 9,
    "oktober": 10, "november": 11, "dezember": 12,
}
MONAT_LABEL = {v: k.capitalize() for k, v in MONATE_DE.items() if k != "maerz"}
MONAT_LABEL[3] = "März"


def fehler(text: str):
    print(f"FEHLER {text}", file=sys.stderr)
    sys.exit(1)


def satz() -> float:
    roh = cfg("LADESTROM_SATZ")
    if not roh:
        fehler("LADESTROM_SATZ ist nicht gesetzt — ohne Erstattungssatz kein Beleg.")
    try:
        wert = float(roh.replace(",", "."))
    except ValueError:
        fehler(f"LADESTROM_SATZ ist keine Zahl: {roh}")
    if wert <= 0:
        fehler(f"LADESTROM_SATZ muss größer als 0 sein, war: {roh}")
    return wert


def monatsordner(monat_arg: str) -> Path:
    """Ordner zum Monat finden — 'Juni' trifft auch 'Juni 2026'."""
    needle = monat_arg.strip().lower()
    if not BASIS.is_dir():
        fehler(f"Datenordner nicht gefunden: {BASIS}\n"
               f"       LADESTROM_BASIS setzen oder den Ordner anlegen.")
    treffer = [d for d in sorted(BASIS.iterdir())
               if d.is_dir() and needle in d.name.lower()]
    if not treffer:
        vorhanden = ", ".join(d.name for d in sorted(BASIS.iterdir()) if d.is_dir()) or "keine"
        fehler(f"Kein Monatsordner passt zu '{monat_arg}'. Vorhanden: {vorhanden}")
    if len(treffer) > 1:
        fehler(f"Mehrere Ordner passen zu '{monat_arg}': "
               f"{', '.join(d.name for d in treffer)}. Bitte genauer angeben.")
    return treffer[0]


def screenshots(ordner: Path) -> list[str]:
    endungen = ("*.PNG", "*.png", "*.JPG", "*.jpg", "*.jpeg", "*.JPEG")
    return sorted({str(p) for e in endungen for p in ordner.glob(e)})


def sessions_pruefen(roh: list) -> tuple[list, dict]:
    """
    Sortiert aus, was nicht abgerechnet wird, und entdoppelt.

    Die Screenshots überlappen absichtlich, damit keine Session verloren geht —
    dadurch stehen Einträge doppelt in den Rohdaten. Entdoppelt wird über Datum,
    kWh und Betrag, also genau die Merkmale, die eine Session ausmachen. Das im
    Skript zu tun ist verlässlicher, als es beim Ablesen mitzudenken.
    """
    sauber, gesehen = [], set()
    verworfen = {"doppelt": [], "ohne_betrag": [], "ohne_menge": [], "falscher_ort": []}

    for i, s in enumerate(roh):
        if not isinstance(s, dict):
            fehler(f"Eintrag {i} ist kein Objekt: {s!r}")
        for feld in ("datum", "kwh", "eur"):
            if feld not in s:
                fehler(f"Eintrag {i} hat kein Feld '{feld}': {s!r}")
        try:
            kwh = float(str(s["kwh"]).replace(",", "."))
            eur = float(str(s["eur"]).replace(",", "."))
        except ValueError:
            fehler(f"Eintrag {i} hat keine gültigen Zahlen: {s!r}")
        datum = str(s["datum"]).strip()

        # Abgerechnet wird nur, was an der eigenen Wallbox geladen wurde. Steht
        # der Ort in den Rohdaten, entscheidet das Skript darüber — sonst muss
        # beim Ablesen daran gedacht werden, und das geht irgendwann schief.
        ort = str(s.get("ort", "")).strip()
        if LADEORT and ort and LADEORT.lower() not in ort.lower():
            verworfen["falscher_ort"].append(f"{datum} ({ort})")
            continue

        kennung = (datum, round(kwh, 3), round(eur, 2))
        if kennung in gesehen:
            verworfen["doppelt"].append(datum)
            continue
        if eur <= 0:
            verworfen["ohne_betrag"].append(datum)
            continue
        if kwh <= 0:
            verworfen["ohne_menge"].append(datum)
            continue

        gesehen.add(kennung)
        sauber.append({"datum": datum, "kwh": kwh, "eur": eur})

    return sauber, verworfen


# ── PDF ────────────────────────────────────────────────────────────────
def erstelle_pdf(sessions, monat_label, beleg_nr, ziel, bilder, preis):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                    TableStyle, HRFlowable, PageBreak, Image as RLImage)
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT
    from PIL import Image as PILImage

    doc = SimpleDocTemplate(str(ziel), pagesize=A4,
                            leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=20 * mm, bottomMargin=20 * mm,
                            title=f"Kostenerstattung Ladestrom {monat_label}",
                            author=ABSENDER_NAME)
    W = A4[0] - 40 * mm
    BLAU = colors.HexColor("#003399")
    satz_text = f"{preis:.2f} €/kWh".replace(".", ",")

    def ps(font="Helvetica", size=9, lead=13, align=None, color=None, **kw):
        kw.update(fontName=font, fontSize=size, leading=lead)
        if align is not None:
            kw["alignment"] = align
        if color is not None:
            kw["textColor"] = color
        return ParagraphStyle(f"s{id(kw)}", **kw)

    story = [Paragraph(f"{ABSENDER_NAME} · {ABSENDER_STRASSE} · {ABSENDER_ORT}",
                       ps(size=7, color=colors.HexColor("#888888"), spaceAfter=5)),
             Paragraph(EMPFAENGER_NAME, ps(font="Helvetica-Bold")),
             Paragraph(EMPFAENGER_STRASSE, ps()), Paragraph(EMPFAENGER_ORT, ps()),
             Spacer(1, 8 * mm)]

    kopf = Table([[Paragraph(f"<b>Erstattungsbeleg Nr.:</b> {beleg_nr}", ps()),
                   Paragraph(datetime.today().strftime("%d.%m.%Y"), ps(align=TA_RIGHT))]],
                 colWidths=[W * 0.6, W * 0.4])
    kopf.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story += [kopf, Spacer(1, 5 * mm),
              Paragraph(f"Kostenerstattung Ladestrom – {monat_label}",
                        ps(font="Helvetica-Bold", size=15, lead=20, spaceAfter=2)),
              Paragraph(f"Privat geladener Firmenwagen-Strom (Wallbox: {LADEORT}, {ABSENDER_ORT})",
                        ps(size=10, lead=14, color=colors.HexColor("#444444"))),
              HRFlowable(width="100%", thickness=1, color=BLAU, spaceAfter=4 * mm),
              Table([["", Paragraph(
                  f"<b>Antragsteller</b><br/>{ABSENDER_NAME}<br/>{ABSENDER_STRASSE}<br/>{ABSENDER_ORT}",
                  ps(size=8.5, lead=13, color=colors.HexColor("#333333"), align=TA_RIGHT))]],
                    colWidths=[W * 0.5, W * 0.5]),
              Spacer(1, 5 * mm)]

    def rp(t, bold=False):
        return Paragraph(t, ps(font="Helvetica-Bold" if bold else "Helvetica",
                               size=9, align=TA_RIGHT))

    zeilen = [[Paragraph("<b>Datum</b>", ps(font="Helvetica-Bold", size=9)),
               rp("<b>kWh</b>", True), rp("<b>App-Preis</b>", True),
               rp(f"<b>Erstattung ({satz_text})</b>", True)]]
    kwh_summe = 0.0
    for s in sessions:
        kwh_summe += s["kwh"]
        zeilen.append([Paragraph(s["datum"], ps()),
                       rp(f"{s['kwh']:g}".replace(".", ",")),
                       rp(f"{s['eur']:.2f} €".replace(".", ",")),
                       rp(f"{s['kwh'] * preis:.2f} €".replace(".", ","))])

    tbl = Table(zeilen, colWidths=[W * 0.22, W * 0.12, W * 0.22, W * 0.44], repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BLAU), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#F5F8FF"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CCCCCC")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor("#002288")),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [tbl, Spacer(1, 6 * mm)]

    gesamt = round(kwh_summe * preis, 2)

    def sb(t, sz=9):
        return Paragraph(f"<b>{t}</b>", ps(font="Helvetica-Bold", size=sz))

    def sv(t, sz=9):
        return Paragraph(f"<b>{t}</b>", ps(font="Helvetica-Bold", size=sz, align=TA_RIGHT))

    summe = Table([
        [sb("Summe Ladevorgänge:"), sv(str(len(sessions)))],
        [sb("Summe verbrauchte kWh:"), sv(f"{kwh_summe:g} kWh".replace(".", ","))],
        [sb("Erstattungssatz:"), sv(satz_text)],
        [Paragraph("", ps()), Paragraph("", ps())],
        [sb("Gesamtbetrag zur Erstattung:", 11),
         Paragraph(f"<b>{gesamt:.2f} €</b>".replace(".", ","),
                   ps(font="Helvetica-Bold", size=13, lead=18, align=TA_RIGHT, color=BLAU))],
    ], colWidths=[W * 0.60, W * 0.40])
    summe.setStyle(TableStyle([
        ("LINEABOVE", (0, 4), (-1, 4), 1.2, BLAU), ("LINEBELOW", (0, 4), (-1, 4), 1.2, BLAU),
        ("BACKGROUND", (0, 4), (-1, 4), colors.HexColor("#EEF3FF")),
        ("TEXTCOLOR", (0, 4), (-1, 4), BLAU),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [summe, Spacer(1, 6 * mm),
              Paragraph("Bitte um Erstattung des oben ausgewiesenen Betrags. Die Ladesessions "
                        f"wurden ausschließlich am privaten Wohnsitz (Wallbox {LADEORT}) für den "
                        "Firmenwagen durchgeführt. Nachweise als Screenshots auf den Folgeseiten.",
                        ps(size=7.5, lead=11, color=colors.HexColor("#555555"))),
              Spacer(1, 14 * mm),
              Table([[Paragraph("_______________________<br/>Unterschrift / Datum",
                                ps(size=7.5, lead=11, color=colors.HexColor("#555555"))), ""]],
                    colWidths=[W * 0.45, W * 0.55])]

    if bilder:
        story += [PageBreak(),
                  Paragraph("Anhang – Nachweise Ladehistorie",
                            ps(font="Helvetica-Bold", size=12, spaceAfter=4 * mm, color=BLAU)),
                  HRFlowable(width="100%", thickness=0.5, color=BLAU, spaceAfter=4 * mm)]
        for i, pfad in enumerate(bilder):
            story.append(Paragraph(f"Screenshot {i + 1}: {Path(pfad).name}",
                                   ps(font="Helvetica-Oblique", size=7.5,
                                      color=colors.HexColor("#666666"), spaceAfter=2 * mm)))
            try:
                bw, bh = PILImage.open(pfad).size
                faktor = min(W / bw, 220 * mm / bh)
                story.append(RLImage(pfad, width=bw * faktor, height=bh * faktor))
            except Exception as e:
                story.append(Paragraph(f"[Bild nicht lesbar: {e}]", ps(size=8)))
            if i < len(bilder) - 1:
                story.append(PageBreak())

    doc.build(story)
    return kwh_summe, gesamt


# ── Hauptprogramm ──────────────────────────────────────────────────────
def main():
    args, opt = sys.argv[1:], {}
    for i, a in enumerate(args):
        if a in ("--hilfe", "-h"):
            print(__doc__)
            return
    i = 0
    while i < len(args):
        if not args[i].startswith("--"):
            fehler(f"Unerwartetes Argument: {args[i]}")
        if i + 1 >= len(args):
            fehler(f"{args[i]} ohne Wert")
        opt[args[i][2:]] = args[i + 1]
        i += 2

    monat_arg = opt.get("monat")
    if not monat_arg:
        fehler("--monat fehlt, z. B. --monat \"Juni 2026\"")

    roh = opt.get("sessions")
    if not roh:
        fehler("--sessions fehlt. JSON-Liste oder @dateiname.")
    if roh.startswith("@"):
        pfad = Path(roh[1:])
        if not pfad.is_file():
            fehler(f"Sessiondatei nicht gefunden: {pfad}")
        roh = pfad.read_text(encoding="utf-8")
    try:
        eingelesen = json.loads(roh)
    except json.JSONDecodeError as e:
        fehler(f"Sessions sind kein gültiges JSON: {e}")
    if not isinstance(eingelesen, list) or not eingelesen:
        fehler("Sessions müssen eine nicht leere Liste sein.")

    for pflicht, name in ((ABSENDER_NAME, "LADESTROM_ABSENDER_NAME"),
                          (EMPFAENGER_NAME, "LADESTROM_EMPFAENGER_NAME")):
        if not pflicht:
            fehler(f"{name} ist nicht gesetzt — ohne Beteiligte kein Beleg.")

    preis = satz()
    sessions, verworfen = sessions_pruefen(eingelesen)
    if not sessions:
        fehler("Nach Entdopplung und Prüfung bleibt keine Session übrig.")

    ordner = monatsordner(monat_arg)
    teile = monat_arg.split()
    name = teile[0].lower()
    jahr = teile[1] if len(teile) > 1 else str(datetime.today().year)
    nummer = MONATE_DE.get(name, 0)
    beleg_nr = f"{jahr}-{nummer:02d}" if nummer else monat_arg
    label = f"{MONAT_LABEL.get(nummer, teile[0])} {jahr}"

    bilder = screenshots(ordner)
    ziel = Path(opt.get("out") or ordner / f"Ladestrom_Erstattung_{label.replace(' ', '_')}.pdf")
    kwh_summe, gesamt = erstelle_pdf(sessions, label, beleg_nr, ziel, bilder, preis)

    print(json.dumps({
        "monat": label, "beleg_nr": beleg_nr, "ordner": str(ordner),
        "sessions": len(sessions), "kwh": round(kwh_summe, 3),
        "satz": preis, "betrag": gesamt, "screenshots": len(bilder),
        "verworfen": {k: len(v) for k, v in verworfen.items()},
        "verworfene_daten": verworfen,
        "pdf": str(ziel),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
