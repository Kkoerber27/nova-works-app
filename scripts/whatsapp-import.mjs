#!/usr/bin/env node
/**
 * Macht aus einem WhatsApp-Chatexport den Datensatz für protokoll.mjs.
 *
 *   node scripts/whatsapp-import.mjs <ordner> --objekt "Glücksgefühle" --projekt 26-0032
 *   node scripts/whatsapp-import.mjs <ordner> --out daten.json --tag 2026-09-05
 *
 * <ordner> ist der entpackte Export: eine `_chat.txt` und die Bilddateien
 * daneben. Danach:
 *
 *   node scripts/protokoll.mjs daten.json --pdf --ablegen
 *
 * Warum dieser Weg: Der Export bringt die Fotos als echte Dateien mit. Aus dem
 * Postfach lassen sich Anhänge nur ansehen, nicht herausholen — die Bilder im
 * Protokoll waren darüber nicht zu bekommen. Hier liegen sie einfach da.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

/* ------------------------------------------------------------------ Eingabe */

const args = process.argv.slice(2);
const wert = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const quelle = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"))[0];
if (!quelle) {
  console.error("Aufruf: node scripts/whatsapp-import.mjs <export-ordner> [--objekt N] [--projekt N] [--tag JJJJ-MM-TT] [--out datei.json]");
  process.exit(2);
}
const basis = resolve(quelle);
if (!existsSync(basis)) {
  console.error(`FEHLER Ordner nicht gefunden: ${basis}`);
  process.exit(1);
}

const dateien = readdirSync(basis);
const chatDatei = dateien.find((n) => /^_chat\.txt$/i.test(n)) ?? dateien.find((n) => /\.txt$/i.test(n));
if (!chatDatei) {
  console.error(`FEHLER Keine Chatdatei in ${basis}. Erwartet wird "_chat.txt" aus dem WhatsApp-Export.`);
  process.exit(1);
}

/* ------------------------------------------------------- Chat zerlegen */

/* WhatsApp schreibt je nach Gerät und Sprache verschieden:
     [31.08.26, 13:47:56] Kilian: ‎<angehängt: 00000042-PHOTO-….jpg>
     31.08.26, 13:47 - Kilian: IMG-20260831-WA0000.jpg (Datei angehängt)
   Dazu unsichtbare Steuerzeichen (U+200E) am Zeilenanfang. Beide Formen und
   die Zeichen müssen weg, sonst beginnt keine Nachricht dort, wo sie beginnt. */
const KOPF = /^‎?\[?(\d{1,2})\.(\d{1,2})\.(\d{2,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\]?\s*(?:-\s+)?([^:]{1,80}?):\s?([\s\S]*)$/;

const ANHANG = [
  /‎?<(?:angehängt|attached|Anhang):\s*([^>]+)>/i,
  /‎?([^\s<>]+\.(?:jpg|jpeg|png|heic|webp))\s*\((?:Datei angehängt|file attached)\)/i,
];

const roh = readFileSync(join(basis, chatDatei), "utf8").replace(/\r\n/g, "\n");
const nachrichten = [];
for (const zeile of roh.split("\n")) {
  const treffer = KOPF.exec(zeile);
  if (treffer) {
    const [, tt, mm, jj, hh, min, sek, absender, rest] = treffer;
    const jahr = jj.length === 2 ? `20${jj}` : jj;
    nachrichten.push({
      zeit: `${jahr}-${mm.padStart(2, "0")}-${tt.padStart(2, "0")}T${hh.padStart(2, "0")}:${min}:${(sek ?? "00").padStart(2, "0")}`,
      absender: absender.trim(),
      text: rest,
    });
  } else if (nachrichten.length) {
    // Fortsetzungszeile: gehört zur vorigen Nachricht, etwa eine Beschriftung
    // unter dem Foto.
    nachrichten[nachrichten.length - 1].text += `\n${zeile}`;
  }
}

if (nachrichten.length === 0) {
  console.error(`FEHLER ${chatDatei} enthält keine erkennbaren Nachrichten.`);
  console.error("Die erste Zeile lautet:");
  console.error(`  ${roh.split("\n")[0]?.slice(0, 120)}`);
  console.error("Sieht sie anders aus als erwartet, muss das Muster im Skript ergänzt werden.");
  process.exit(1);
}

for (const n of nachrichten) {
  for (const muster of ANHANG) {
    const t = muster.exec(n.text);
    if (t) {
      n.anhang = t[1].trim();
      n.text = n.text.replace(muster, "").trim();
      break;
    }
  }
  n.text = n.text.replace(/‎/g, "").trim();
}

/* --------------------------------------------- Beschriftung nachreichen */

/* Manche WhatsApp-Fassungen schreiben die Bildunterschrift nicht in dieselbe
   Zeile, sondern als eigene Nachricht danach. Dann gehört die nächste Nachricht
   desselben Absenders innerhalb von fünf Minuten zum Bild — so war es auch der
   Crew angesagt: Text direkt nach dem Foto. */
const FENSTER_MS = 5 * 60 * 1000;
for (let i = 0; i < nachrichten.length; i++) {
  const n = nachrichten[i];
  if (!n.anhang || n.text) continue;
  const naechste = nachrichten[i + 1];
  if (!naechste || naechste.anhang || !naechste.text) continue;
  if (naechste.absender !== n.absender) continue;
  if (new Date(naechste.zeit) - new Date(n.zeit) > FENSTER_MS) continue;
  n.text = naechste.text;
  naechste.verbraucht = true;
}

/* -------------------------------------------- Folgeanhänge zuordnen */

/* WhatsApp verschickt mehrere Bilder als mehrere Nachrichten: Die erste trägt
   die Beschriftung, die übrigen kommen nackt hinterher, Sekunden später. Ohne
   diese Zuordnung wird aus einer Meldung mit sechs Anhängen eine Meldung und
   fünf Geisterzeilen ohne Standort — und im Protokoll steht sechsmal, was einmal
   gilt. */
const ANHANG_FENSTER_MS = 2 * 60 * 1000;
for (let i = 0; i < nachrichten.length; i++) {
  const n = nachrichten[i];
  if (!n.anhang || !n.text || n.verbraucht) continue;
  n.weitere = [];
  for (let j = i + 1; j < nachrichten.length; j++) {
    const f = nachrichten[j];
    if (!f.anhang || f.text || f.verbraucht) break;
    if (f.absender !== n.absender) break;
    if (new Date(f.zeit) - new Date(n.zeit) > ANHANG_FENSTER_MS) break;
    n.weitere.push(f.anhang);
    f.verbraucht = true;
  }
}

/* ------------------------------------------------- Betreff zerlegen */

/* ------------------------------------------------------- Gerätenamen */

/* In der Gruppe wird auf dem Handy getippt, oft im Stehen: „litecaraft x7“
   statt „Litecraft X7“. Der Name ist ein Katalogwert, kein Zitat — er gehört
   im Protokoll richtig geschrieben, damit sich zwei Meldungen desselben Geräts
   auch als dasselbe Gerät lesen. Der Wortlaut der Meldung bleibt daneben in
   `wieGemeldet` stehen.
   Was hier nicht steht, bleibt unangetastet: geraten wird kein Gerätename. */
const namenDatei = new URL("./geraetenamen.json", import.meta.url);
const NAMEN = new Map();
try {
  for (const [richtig, varianten] of Object.entries(JSON.parse(readFileSync(namenDatei, "utf8")))) {
    if (richtig.startsWith("_")) continue;
    for (const v of [richtig, ...varianten]) NAMEN.set(schluessel(v), richtig);
  }
} catch (fehler) {
  console.error(`WARNUNG geraetenamen.json nicht lesbar (${fehler.message}) — Namen bleiben, wie gemeldet.`);
}

/** Vergleichsform: ohne Gross-/Kleinschreibung, Leerzeichen und Bindestriche.
 *  „Litecraft X7“, „litecraft-x7“ und „LITECRAFTX7“ sind damit dasselbe. */
function schluessel(wert) {
  return String(wert).toLowerCase().replace(/[\s._-]+/g, "");
}

const richtigerName = (wert) => (wert ? NAMEN.get(schluessel(wert)) ?? wert : wert);

const BILD = /\.(jpe?g|png|heic|heif|webp|gif)$/i;
const VIDEO = /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i;

const ANZAHL = /^(\d{1,4})\s*(?:st(?:ü|ue)ck|st\.?|x)?$/i;
const GERAET = /^(?=.*\d)(?=.*[A-Za-zÄÖÜäöü])[A-Za-zÄÖÜäöü0-9._-]{2,20}$/;

/* Wie tatsächlich geschrieben wird: „Hauptzelt 4x w600“ — Standort, Stückzahl,
   Gerätetyp, ohne Kommas. Das ist keine schlampige Fassung des Meldeformats,
   sondern die kürzere: Ort, wie viele, was. */

/** Zerlegt eine Angabe wie „9x litecraft x7 12x w300 5x w600“ in ihre Gruppen —
 *  hier neun, zwölf und fünf Geräte, zusammen sechsundzwanzig.
 *
 *  Getrennt wird an „<Zahl>x “ mit Leerzeichen dahinter. Das „x7“ in
 *  „litecraft x7“ hat keine Zahl davor und bleibt deshalb Teil des Gerätenamens.
 *  Ohne diese Unterscheidung stünde die Zahl der ersten Gruppe für die ganze
 *  Meldung — bei dieser hier neun statt sechsundzwanzig. */
const GRUPPE = /(\d{1,4})\s*x\s+/gi;

function gruppen(text) {
  const t = String(text).trim();
  const treffer = [...t.matchAll(GRUPPE)];
  if (treffer.length === 0 || treffer[0].index !== 0) return null;
  return treffer.map((tr, i) => ({
    anzahl: Number(tr[1]),
    typ: t.slice(tr.index + tr[0].length, treffer[i + 1]?.index ?? t.length).trim(),
  }));
}

/** Mehrere Gruppen ergeben eine Position — ein Foto, eine Meldung. Die
 *  Aufteilung bleibt im Gerätetyp lesbar. */
function ausGruppen(g, standort, zustand) {
  const berichtigt = g.map((x) => ({ ...x, typ: richtigerName(x.typ) }));
  const roh = g.length > 1 ? g.map((x) => `${x.anzahl}× ${x.typ}`).join(", ") : g[0].typ;
  const typ = berichtigt.length > 1
    ? berichtigt.map((x) => `${x.anzahl}× ${x.typ}`).join(", ")
    : berichtigt[0].typ || undefined;
  return {
    standort,
    zustand,
    anzahl: berichtigt.reduce((summe, x) => summe + x.anzahl, 0),
    geraetetyp: typ,
    ...(typ && roh !== typ ? { wieGemeldet: roh } : {}),
  };
}


/** Von hinten lesen: letztes Feld Zustand, vorletztes Anzahl oder Gerät, alles
 *  davor Standort. Von vorn ginge es nicht — der Standort enthält selbst Kommas. */
function streng(text) {
  const felder = text.split(",").map((f) => f.trim()).filter((f, i, a) => !(f === "" && i === a.length - 1));
  if (felder.length < 3) return { fehler: "weniger als drei Kommafelder" };

  const zustand = felder[felder.length - 1];
  const mitte = felder[felder.length - 2];
  const standort = felder.slice(0, -2).join(", ");

  const zahl = ANZAHL.exec(mitte);
  if (zahl) return { standort, anzahl: Number(zahl[1]), zustand };

  // „12x W600“ und „9x litecraft x7 12x w300 5x w600“.
  const g = gruppen(mitte);
  if (g) return ausGruppen(g, standort, zustand);

  // „13 W600“ — Zahl und Typ ohne x. Nur hier erlaubt, nicht in der freien
  // Form: An dieser Stelle steht durch die Kommas schon fest, dass das Feld
  // Stückzahl oder Gerät meint. Ohne diese Gewissheit läse sich „Halle 3
  // Traverse Nord“ als drei Traversen.
  const zahlTyp = /^(\d{1,4})\s+(.+)$/.exec(mitte);
  if (zahlTyp) {
    const roh = zahlTyp[2].trim();
    const typ = richtigerName(roh);
    return { standort, anzahl: Number(zahlTyp[1]), geraetetyp: typ, zustand, ...(roh !== typ ? { wieGemeldet: roh } : {}) };
  }

  if (GERAET.test(mitte)) return { standort, geraet: richtigerName(mitte), zustand };
  return { fehler: `mittleres Feld ist weder Stückzahl noch Gerätebezeichnung: „${mitte}“` };
}

/** „Hauptzelt 4x w600“ und „Halle 3, Traverse Nord 6x MAC Aura, Linse gesprungen“.
 *  Ein Zustand steht hier hinter einem Komma — ohne Trennzeichen liesse sich
 *  nicht entscheiden, wo der Gerätetyp aufhört und der Zustand anfängt. */
function frei(text) {
  const felder = text.split(",").map((f) => f.trim()).filter(Boolean);
  // Zwei Lesarten: mit Zustand hinter dem letzten Komma und ohne.
  const versuche = felder.length > 1
    ? [[felder.slice(0, -1).join(", "), felder[felder.length - 1]], [text, ""]]
    : [[text, ""]];

  for (const [links, zustand] of versuche) {
    const roh = links.trim();
    const erste = /(\d{1,4})\s*x\s+/i.exec(roh);
    if (!erste) continue;

    let standort = roh.slice(0, erste.index).replace(/[,\s]+$/, "").trim();
    const g = gruppen(roh.slice(erste.index));
    if (!g) continue;

    if (!standort) {
      // „2x X7 bei Scooter“: Erst die Menge, der Ort hinten. Kommt vor, wenn
      // jemand vom Gerät her denkt. Nur mit Ortswort davor — sonst wäre bei
      // „5x w600“ nicht zu sagen, ob überhaupt ein Standort gemeint ist.
      const letzte = g[g.length - 1];
      const ort = /\s+(bei|am|im|an|auf|neben|hinter|vor)\s+(.+)$/i.exec(letzte.typ);
      if (!ort) continue;
      letzte.typ = letzte.typ.slice(0, ort.index).trim();
      standort = ort[2].trim();
    }
    return ausGruppen(g, standort, zustand);
  }
  return null;
}

/** Die lockere Lesart greift nur bei einer Meldung mit Foto. Ohne Bild ist
 *  „kann 2x nachsehen“ eine Wortmeldung im Gruppenchat und keine Position —
 *  wer ohne Foto meldet, muss das genaue Format schreiben. */
function zerlegen(text, hatFoto) {
  const s = streng(text);
  if (!s.fehler) return s;
  if (hatFoto) {
    const f = frei(text);
    if (f) return f;
  }
  return s;
}

/* ------------------------------------------------------ Positionen bauen */

const tagFilter = wert("--tag");
const positionen = [];
const hinweise = [];
const uebersprungen = [];
const geplauder = [];
const andereDateien = [];

for (const n of nachrichten) {
  if (n.verbraucht) continue;
  if (tagFilter && !n.zeit.startsWith(tagFilter)) continue;
  if (!n.anhang && !n.text) continue;

  // Systemmeldungen des Chats sind keine Meldungen der Crew. WhatsApp schreibt
  // sie mit dem Gruppennamen als Absender und mal in der zweiten, mal in der
  // dritten Person („Du hast die Gruppe … erstellt“ / „Robin hat die Gruppe …“).
  const SYSTEM = /verschlüsselt|Ende-zu-Ende|(?:hat|hast) die Gruppe|hinzugefügt|Nachrichten und Anrufe|Sicherheitsnummer|beigetreten|hat den Betreff/i;
  if (SYSTEM.test(n.text) && !n.anhang) continue;

  const fotos = [];
  const videos = [];
  for (const name of [n.anhang, ...(n.weitere ?? [])].filter(Boolean)) {
    const pfad = join(basis, name);
    if (!existsSync(pfad)) {
      uebersprungen.push(`${n.zeit} — Datei fehlt im Export: ${name}`);
      continue;
    }
    const eintrag = { name: basename(pfad), groesse: statSync(pfad).size };
    // Ein Video ist ein Beleg, aber kein Bild: Als <img> eingebettet ergäbe es
    // im PDF ein kaputtes Rechteck. Es wird gezählt und benannt, nicht gezeigt.
    if (BILD.test(name)) fotos.push({ ...eintrag, datei: pfad });
    else if (VIDEO.test(name)) videos.push(eintrag);
    else andereDateien.push(`${n.zeit} — ${basename(pfad)}`);
  }

  const zerlegt = n.text ? zerlegen(n.text, Boolean(n.anhang)) : { fehler: "keine Beschriftung" };

  // In der Gruppe wird auch geredet. Eine Nachricht ohne Foto, die sich nicht
  // zerlegen lässt, ist kein Bericht, sondern ein Satz — sie gehört nicht als
  // leere Zeile ins Protokoll. Mit Foto ist es umgekehrt: da war eine Meldung
  // gemeint, und die muss sichtbar bleiben.
  if (zerlegt.fehler && !n.anhang) {
    geplauder.push(n.zeit);
    continue;
  }

  if (zerlegt.fehler) {
    // Nicht raten. Die Meldung kommt als unvollständige Zeile ins Protokoll,
    // damit sie sichtbar bleibt, statt lautlos zu verschwinden.
    positionen.push({
      standort: n.text || "—",
      zustand: "",
      absender: n.absender,
      zeit: n.zeit,
      hinweis: zerlegt.fehler,
      fotos,
      ...(videos.length ? { videos } : {}),
      status: "unvollstaendig",
    });
    hinweise.push({
      bezug: n.zeit.slice(11, 16),
      titel: "Meldung nicht zerlegbar",
      text: `„${n.text || "(ohne Text)"}“ — ${zerlegt.fehler}. Die Zeile steht unvollständig im Protokoll und muss nachgetragen werden.`,
    });
    continue;
  }

  const position = {
    standort: zerlegt.standort,
    zustand: zerlegt.zustand,
    absender: n.absender,
    zeit: n.zeit,
    fotos,
    ...(videos.length ? { videos } : {}),
    // Vollständig heisst: belegt und verortet — Beleg, Standort, und wie viele
    // oder welches Gerät. Der Zustand fehlt meistens, weil nichts zu melden war;
    // ihn zur Bedingung zu machen färbte ein sauber erfasstes Protokoll
    // durchgehend rot und der Balken sagte nichts mehr aus. Er fehlt trotzdem
    // sichtbar: an der Zeile und als Sammelhinweis.
    status: (fotos.length || videos.length) && zerlegt.standort && (zerlegt.anzahl || zerlegt.geraet)
      ? "vollstaendig"
      : "unvollstaendig",
  };
  if (zerlegt.anzahl) position.anzahl = zerlegt.anzahl;
  if (zerlegt.geraet) position.geraet = zerlegt.geraet;
  if (zerlegt.geraetetyp) position.geraetetyp = zerlegt.geraetetyp;
  if (zerlegt.wieGemeldet) position.wieGemeldet = zerlegt.wieGemeldet;

  const luecken = [];
  if (!fotos.length) luecken.push(videos.length ? "nur Video, kein Foto" : "kein Foto");
  if (!zerlegt.zustand) luecken.push("kein Zustand angegeben");
  if (luecken.length) position.hinweis = luecken.join(", ");

  positionen.push(position);
}

if (positionen.length === 0) {
  console.error("FEHLER Keine verwertbaren Meldungen gefunden.");
  console.error(`Der Export enthält ${nachrichten.length} Nachrichten${tagFilter ? `, aber keine vom ${tagFilter}` : ""}.`);
  process.exit(1);
}

/* Dubletten: dieselbe Stelle ein zweites Mal, typischerweise weitergeleitet. */
const gesehen = new Set();
for (const p of positionen) {
  const schluessel = `${p.standort}|${p.geraet ?? ""}|${p.geraetetyp ?? ""}|${p.anzahl ?? ""}`;
  if (gesehen.has(schluessel)) p.status = "dublette";
  else gesehen.add(schluessel);
}

/* Ein Sammelhinweis statt einer Zeile je Meldung: Fehlt bei zehn Meldungen der
   Zustand, sind zehn gleichlautende Prüfhinweise nur Rauschen, in dem die
   wirklich einzelnen Fälle untergehen. */
const ohneZustand = positionen.filter((p) => p.status !== "dublette" && !p.zustand);
if (ohneZustand.length) {
  hinweise.push({
    bezug: "Zustand",
    titel: `${ohneZustand.length} Meldung(en) ohne Zustandsangabe`,
    text:
      `${ohneZustand.map((p) => p.standort).join("; ")} — hier steht, was wo hängt, ` +
      "nicht in welchem Zustand. Als Bestandsaufnahme zählt das; als Nachweis, dass " +
      "die Geräte in Ordnung waren, nicht. Wo es darauf ankommt, gehört der Zustand " +
      "hinter ein Komma: „Hauptzelt 4x w600, alle ok“.",
  });
}

if (andereDateien.length) {
  hinweise.push({
    bezug: "Anhänge",
    titel: `${andereDateien.length} Anhang/Anhänge weder Bild noch Video`,
    text: `${andereDateien.join("; ")} — nicht übernommen. Als Nachweis taugt nur, was sich ansehen lässt; was das ist, muss ein Mensch entscheiden.`,
  });
}

for (const eintrag of uebersprungen) {
  hinweise.push({
    bezug: eintrag.slice(11, 16),
    titel: "Foto fehlt im Export",
    text: `${eintrag}. Beim Exportieren muss „Medien einschließen“ gewählt werden; ohne das kommen nur die Texte mit.`,
  });
}

const daten = {
  objekt: wert("--objekt") ?? "",
  projekt: wert("--projekt") ?? undefined,
  postfach: "WhatsApp-Export",
  datum: positionen[0].zeit.slice(0, 10),
  erstellt: new Date().toISOString(),
  positionen,
  hinweise,
};

const ziel = resolve(wert("--out") ?? join(basis, "daten.json"));
writeFileSync(ziel, JSON.stringify(daten, null, 2) + "\n", "utf8");

const scheinwerfer = positionen
  .filter((p) => p.status !== "dublette")
  .reduce((s, p) => s + (p.anzahl ?? 1), 0);
const vollstaendig = positionen
  .filter((p) => p.status === "vollstaendig")
  .reduce((s, p) => s + (p.anzahl ?? 1), 0);

console.log(`DATEN ${ziel}`);
console.log(`      ${nachrichten.length} Nachrichten gelesen, ${positionen.length} Meldungen erkannt`);
if (geplauder.length) console.log(`      ${geplauder.length} Nachricht(en) ohne Foto und ohne Meldeformat übergangen`);
console.log(`      ${scheinwerfer} Scheinwerfer, ${vollstaendig} vollständig`);
if (ohneZustand.length) console.log(`      davon ${ohneZustand.length} Meldung(en) ohne Zustandsangabe`);
const videoZahl = positionen.reduce((s, p) => s + (p.videos?.length ?? 0), 0);
if (videoZahl) console.log(`      ${videoZahl} Video(s) vermerkt, nicht eingebettet`);
if (hinweise.length) console.log(`      ${hinweise.length} Prüfhinweis(e) — stehen im Protokoll`);
// Im Einzelbefehl (protokoll-whatsapp.sh) folgt der Aufruf sowieso — dann wäre
// die Zeile eine Anleitung zu etwas, das gerade von selbst passiert.
if (!process.env.PROTOKOLL_KETTE) {
  console.log("");
  console.log("Weiter mit:");
  console.log(`      node scripts/protokoll.mjs ${ziel} --pdf --ablegen`);
}
