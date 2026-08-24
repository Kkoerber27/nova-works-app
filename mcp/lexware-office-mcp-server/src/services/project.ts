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
  const base = ["RE", safe(rechnungsnummer) || "ohne-Nummer", day, safe(kunde)]
    .filter(Boolean)
    .join("_")
    .replace(/_+/g, "_")
    // A name ending in "." — "CSD München e.V." — would give "….V..pdf", and a
    // trailing dot is not a legal name segment on Windows or SharePoint.
    .replace(/[\s.]+$/, "");
  return `${base}.pdf`;
}
