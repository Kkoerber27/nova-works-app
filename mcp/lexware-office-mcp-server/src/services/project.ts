/** Pulling the NOVA WORKS project number out of an invoice. */

import { PROJECT_NUMBER_PATTERN } from "../constants.js";
import type { Invoice, VoucherListItem } from "../types.js";

/** Every distinct project number appearing in the given text, in order. */
export function findProjectNumbers(...texts: Array<string | undefined>): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(PROJECT_NUMBER_PATTERN)) {
      found.add(match[1]);
    }
  }
  return [...found];
}

/**
 * Decide which project number to file under.
 *
 * Deliberately refuses rather than guesses: an invoice filed in the wrong
 * project is worse than one that waits for a human, and only shows up at audit
 * time. The caller reports `hinweis` instead of picking.
 */
export function resolveProjectNumber(
  invoice: Invoice,
  listItem?: VoucherListItem,
): { projektnummern: string[]; projektnummer: string | null; hinweis?: string } {
  const projektnummern = findProjectNumbers(
    invoice.title,
    invoice.introduction,
    invoice.remark,
    listItem?.voucherNumber,
  );

  if (projektnummern.length === 1) {
    return { projektnummern, projektnummer: projektnummern[0] };
  }
  if (!projektnummern.length) {
    return {
      projektnummern,
      projektnummer: null,
      hinweis:
        "Keine Projektnummer in Titel, Einleitung oder Bemerkung gefunden. Nummer im Format 26-0007 in der Rechnung ergänzen, oder die Ablage von Hand entscheiden.",
    };
  }
  return {
    projektnummern,
    projektnummer: null,
    hinweis: `Mehrere Projektnummern gefunden (${projektnummern.join(", ")}). Nicht automatisch ablegbar — die richtige von Hand wählen.`,
  };
}

/** Deterministic file name, so re-filing overwrites instead of duplicating. */
export function pdfFileName(
  rechnungsnummer: string,
  datum: string,
  kunde: string,
): string {
  const day = (datum || "").slice(0, 10);
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim();
  // Die Nummer beginnt bei NOVA WORKS schon mit "RE" — kein zweites davorsetzen.
  const nummer = safe(rechnungsnummer) || "ohne-Nummer";
  const praefix = /^re/i.test(nummer) ? "" : "RE";
  const base = [praefix, nummer, day, safe(kunde)]
    .filter(Boolean)
    .join("_")
    .replace(/_+/g, "_")
    // A name ending in "." — "CSD München e.V." — would give "….V..pdf", and a
    // trailing dot is not a legal name segment on Windows or SharePoint.
    .replace(/[\s.]+$/, "");
  return `${base}.pdf`;
}

/**
 * Wörter, die zwischen Projektordnern nicht unterscheiden. Sie stehen auf fast
 * jeder Rechnung und würden jeden Ordner gleich gut passen lassen.
 */
const FUELLWOERTER = new Set([
  "rechnung", "schlussrechnung", "abschlagsrechnung", "teilrechnung", "vorauszahlung",
  "gutschrift", "angebot", "auftrag", "leistungen", "nachtrag", "storno",
  "gmbh", "gbr", "kg", "ag", "co", "ug",
  "der", "die", "das", "den", "dem", "des", "und", "oder", "fuer", "von", "vom",
  "bis", "mit", "nr", "no", "vom", "am", "im", "in", "an", "auf", "zur", "zum",
]);

/** Klein, ohne Umlaute, ohne Satzzeichen — für den Wortvergleich. */
function woerter(text: string): string[] {
  return String(text ?? "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !FUELLWOERTER.has(w) && !/^\d+$/.test(w));
}

/**
 * Aus einem Ordnerpfad den sprechenden Teil holen: aus
 * ".../Angebote/26-0007_80er Live Schalke/Rechnungen/Out" wird
 * "26-0007_80er Live Schalke".
 */
export function ordnerName(pfad: string, projektnummer?: string): string {
  const teile = decodeURIComponent(String(pfad ?? "")).split("/").filter(Boolean);
  if (projektnummer) {
    const treffer = teile.find((t) => t.startsWith(projektnummer));
    if (treffer) return treffer;
  }
  const vorRechnungen = teile.findIndex((t) => t.toLowerCase() === "rechnungen");
  if (vorRechnungen > 0) return teile[vorRechnungen - 1];
  return teile[teile.length - 1] ?? String(pfad ?? "");
}

export interface OrdnerTreffer {
  ordner: string;
  name: string;
  punkte: number;
  passende_woerter: string[];
}

/**
 * Entscheidet zwischen mehreren Projektordnern derselben Nummer, indem die
 * übrigen Wörter des Rechnungstextes mit den Ordnernamen verglichen werden.
 *
 * Gewinnt genau einer, ist das der Treffer. Bei Gleichstand oder ohne jede
 * Übereinstimmung bleibt es bei null — geraten wird nicht.
 */
export function ordnerZuordnen(
  text: string,
  ordner: string[],
  projektnummer?: string,
): { treffer: string | null; kandidaten: OrdnerTreffer[]; hinweis?: string } {
  if (!ordner.length) {
    return { treffer: null, kandidaten: [], hinweis: "Keine Ordner übergeben." };
  }

  const rechnungsWoerter = new Set(woerter(text));
  const kandidaten: OrdnerTreffer[] = ordner.map((pfad) => {
    const name = ordnerName(pfad, projektnummer);
    const passende = woerter(name).filter((w) => rechnungsWoerter.has(w));
    return { ordner: pfad, name, punkte: passende.length, passende_woerter: passende };
  });
  kandidaten.sort((a, b) => b.punkte - a.punkte);

  if (kandidaten.length === 1) {
    return { treffer: kandidaten[0].ordner, kandidaten };
  }

  const beste = kandidaten[0].punkte;
  if (beste === 0) {
    return {
      treffer: null,
      kandidaten,
      hinweis: `Der Rechnungstext enthält kein Wort, das einen der ${kandidaten.length} Ordner auszeichnet. Unterscheidungsmerkmal in den Rechnungstitel aufnehmen, etwa den Ort.`,
    };
  }
  const gleichauf = kandidaten.filter((k) => k.punkte === beste);
  if (gleichauf.length > 1) {
    return {
      treffer: null,
      kandidaten,
      hinweis: `${gleichauf.length} Ordner passen gleich gut (${gleichauf.map((k) => k.name).join(", ")}). Nicht entscheidbar.`,
    };
  }
  return { treffer: kandidaten[0].ordner, kandidaten };
}
