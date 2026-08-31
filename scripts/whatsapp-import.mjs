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

/* ------------------------------------------------- Betreff zerlegen */

const ANZAHL = /^(\d{1,4})\s*(?:st(?:ü|ue)ck|st\.?|x)?$/i;
const GERAET = /^(?=.*\d)(?=.*[A-Za-zÄÖÜäöü])[A-Za-zÄÖÜäöü0-9._-]{2,20}$/;

/* Wie tatsächlich geschrieben wird: „Hauptzelt 4x w600“ — Standort, Stückzahl,
   Gerätetyp, ohne Kommas. Das ist keine schlampige Fassung des Meldeformats,
   sondern die kürzere: Ort, wie viele, was. */
const FREI = /^(.*?)[\s,]+(\d{1,4})\s*(?:x|st(?:ü|ue)ck|st\.)\s*(.*)$/i;

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
  if (GERAET.test(mitte)) return { standort, geraet: mitte, zustand };
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
    const t = FREI.exec(links);
    if (!t) continue;
    const standort = t[1].trim().replace(/[,\s]+$/, "");
    const geraetetyp = t[3].trim();
    if (!standort) continue;
    return { standort, anzahl: Number(t[2]), geraetetyp: geraetetyp || undefined, zustand };
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
  if (n.anhang) {
    const pfad = join(basis, n.anhang);
    if (existsSync(pfad)) {
      // Absoluter Pfad: protokoll.mjs löst `datei` relativ zur Datendatei auf,
      // und die liegt nicht zwingend im Export-Ordner.
      fotos.push({ name: basename(pfad), groesse: statSync(pfad).size, datei: pfad });
    } else {
      uebersprungen.push(`${n.zeit} — Datei fehlt im Export: ${n.anhang}`);
    }
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
    status: fotos.length && zerlegt.standort && zerlegt.zustand ? "vollstaendig" : "unvollstaendig",
  };
  if (zerlegt.anzahl) position.anzahl = zerlegt.anzahl;
  if (zerlegt.geraet) position.geraet = zerlegt.geraet;
  if (zerlegt.geraetetyp) position.geraetetyp = zerlegt.geraetetyp;

  const luecken = [];
  if (!fotos.length) luecken.push("kein Foto");
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
      `${ohneZustand.map((p) => p.standort).join("; ")} — hier steht nur, was wo hängt, ` +
      "nicht in welchem Zustand. Als Bestandsaufnahme brauchbar, als Schadensnachweis nicht. " +
      "Der Zustand gehört hinter ein Komma: „Hauptzelt 4x w600, alle ok“.",
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
if (hinweise.length) console.log(`      ${hinweise.length} Prüfhinweis(e) — stehen im Protokoll`);
console.log("");
console.log("Weiter mit:");
console.log(`      node scripts/protokoll.mjs ${ziel} --pdf --ablegen`);
