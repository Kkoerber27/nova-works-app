/** Shapes returned by the Lexware Office API, narrowed to what is used here. */

/** One row of GET /v1/voucherlist. */
export interface VoucherListItem {
  id: string;
  voucherType: string;
  voucherStatus: string;
  voucherNumber?: string;
  voucherDate?: string;
  createdDate?: string;
  updatedDate?: string;
  dueDate?: string;
  contactName?: string;
  /** Gesamtwert des Belegs. Bei einer Schlussrechnung inklusive der bereits
   *  gestellten Anzahlungen — also NICHT die offene Forderung. */
  totalAmount?: number;
  /** Was tatsächlich noch aussteht. Das ist die Zahl, um die es geht. */
  openAmount?: number;
  currency?: string;
  archived?: boolean;
}

export interface VoucherListPage {
  content: VoucherListItem[];
  totalPages?: number;
  totalElements?: number;
  number?: number;
  size?: number;
  last?: boolean;
}

/** GET /v1/invoices/{id}, narrowed to the fields a project number can hide in. */
export interface Invoice {
  id: string;
  voucherNumber?: string;
  voucherDate?: string;
  title?: string;
  introduction?: string;
  remark?: string;
  address?: { name?: string; contactId?: string };
  totalPrice?: { totalGrossAmount?: number; currency?: string };
  voucherStatus?: string;
  files?: { documentFileId?: string };
  /** Positionen. Die Projektnummer steht oft hier statt im Kopf. */
  lineItems?: Array<{ name?: string; description?: string }>;
}

/** GET /v1/invoices/{id}/document */
export interface DocumentReference {
  documentFileId: string;
}

/** An invoice as this server reports it, with the project number resolved. */
export interface InvoiceSummary {
  id: string;
  rechnungsnummer: string;
  datum: string;
  kunde: string;
  /** Offene Forderung — bei Schlussrechnungen deutlich unter dem Gesamtwert. */
  offen: number | null;
  /** Gesamtwert inklusive bereits gestellter Anzahlungen. */
  betrag_brutto: number | null;
  waehrung: string;
  faellig_am: string;
  ueberfaellig: boolean;
  titel: string;
  /** Every distinct project number found in the invoice's text fields. */
  projektnummern: string[];
  /** The single project number to file under, or null when it is not unambiguous. */
  projektnummer: string | null;
  /** Woher die Nummer stammt: aus Titel/Einleitung/Bemerkung oder aus den Positionen. */
  projektnummer_quelle: "kopf" | "positionen" | null;
  /** Why no project number could be settled on, when that is the case. */
  hinweis?: string;
  bereits_abgelegt: boolean;
}

/** One entry of the filing ledger. */
export interface LedgerEntry {
  invoice_id: string;
  rechnungsnummer: string;
  projektnummer: string | null;
  abgelegt_am: string;
  ablageort: string;
  /** Ob die Datei hochgeladen wurde oder schon dort lag. */
  quelle?: "hochgeladen" | "vorhanden";
}
