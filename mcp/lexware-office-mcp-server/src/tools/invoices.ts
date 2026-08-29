/** The four tools that make filing an invoice a mechanical step. */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { CHARACTER_LIMIT, DOWNLOAD_DIR } from "../constants.js";
import {
  downloadFile,
  getInvoice,
  LexwareError,
  listVouchers,
  renderDocument,
} from "../services/lexware.js";
import { isFiled, listFiled, ledgerLocation, markFiled } from "../services/ledger.js";
import { ordnerZuordnen, pdfFileName, resolveProjectNumber } from "../services/project.js";
import type { InvoiceSummary } from "../types.js";

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

const formatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format: 'markdown' for reading, 'json' for further processing");

function ok(
  format: "markdown" | "json",
  structured: Record<string, unknown>,
  markdown: () => string,
): ToolResult {
  const text = format === "json" ? JSON.stringify(structured, null, 2) : markdown();
  const capped =
    text.length > CHARACTER_LIMIT
      ? `${text.slice(0, CHARACTER_LIMIT)}\n\n[Gekürzt. 'limit' verkleinern oder 'offset' nutzen.]`
      : text;
  return { content: [{ type: "text", text: capped }], structuredContent: structured };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

function guard<T>(handler: (params: T) => Promise<ToolResult>) {
  return async (params: T): Promise<ToolResult> => {
    try {
      return await handler(params);
    } catch (err) {
      if (err instanceof LexwareError) return fail(err.message);
      return fail(err instanceof Error ? err.message : String(err));
    }
  };
}

function deDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso ?? "");
}

function euro(amount: number | null, currency: string): string {
  if (amount === null) return "";
  return `${amount.toFixed(2).replace(".", ",")} ${currency || "EUR"}`;
}

export function registerInvoiceTools(server: McpServer): void {
  server.registerTool(
    "lex_list_open_invoices",
    {
      title: "Offene Rechnungen auflisten",
      description: `List invoices in Lexware Office and resolve the NOVA WORKS project number for each.

Reads the voucher list, then fetches each invoice to look for a project number in its title,
introduction and remark. Rate-limited to under two requests per second, so a page of 25
invoices takes roughly fifteen seconds.

Args:
  - status (string): Lexware voucher status, default 'open' (finalised but unpaid). Other
    values: 'draft', 'paid', 'voided', 'overdue', 'any'
  - only_unfiled (boolean): skip invoices already recorded by lex_mark_filed (default true)
  - limit (number): 1-50, default 25
  - offset (number): default 0
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "total": number, "count": number, "offset": number, "has_more": boolean,
    "invoices": [{
      "id": string,                  // pass to lex_download_invoice_pdf
      "rechnungsnummer": string, "datum": string, "kunde": string,
      "betrag": number|null, "waehrung": string, "titel": string,
      "projektnummern": string[],    // every number found
      "projektnummer": string|null,  // set only when exactly one was found
      "hinweis": string,             // present when projektnummer is null
      "bereits_abgelegt": boolean
    }]
  }

"projektnummer" is null on purpose whenever the invoice carries no number or more than one.
Do not guess in that case: file it only after a human names the project.

Examples:
  - "Welche offenen Rechnungen sind noch nicht abgelegt?" -> no arguments
  - "Zeig alle bezahlten Rechnungen" -> status="paid", only_unfiled=false`,
      inputSchema: {
        status: z.string().default("open").describe("Lexware voucher status"),
        only_unfiled: z
          .boolean()
          .default(true)
          .describe("Skip invoices already recorded as filed"),
        limit: z.number().int().min(1).max(50).default(25).describe("Maximum invoices"),
        offset: z.number().int().min(0).default(0).describe("Invoices to skip"),
        response_format: formatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: {
      status: string;
      only_unfiled: boolean;
      limit: number;
      offset: number;
      response_format: "markdown" | "json";
    }) => {
      // The API pages from an offset of whole pages; ask for one page that is
      // large enough to cover the requested window, then slice locally.
      const pageSize = Math.min(100, params.offset + params.limit);
      const page = await listVouchers(params.status, 0, pageSize);
      const rows = Array.isArray(page.content) ? page.content : [];
      if (!rows.length) {
        return fail(
          `Lexware reports no invoices with status "${params.status}". Valid values are draft, open, paid, voided, overdue, any.`,
        );
      }

      const window = rows.slice(params.offset, params.offset + params.limit);
      const invoices: InvoiceSummary[] = [];
      for (const row of window) {
        const filed = await isFiled(row.id);
        if (params.only_unfiled && filed) continue;
        const invoice = await getInvoice(row.id);
        const resolved = resolveProjectNumber(invoice, row);
        invoices.push({
          id: row.id,
          rechnungsnummer: invoice.voucherNumber ?? row.voucherNumber ?? "",
          datum: (invoice.voucherDate ?? row.voucherDate ?? "").slice(0, 10),
          kunde: invoice.address?.name ?? row.contactName ?? "",
          betrag: invoice.totalPrice?.totalGrossAmount ?? row.totalAmount ?? null,
          waehrung: invoice.totalPrice?.currency ?? row.currency ?? "EUR",
          titel: invoice.title ?? "",
          ...resolved,
          bereits_abgelegt: filed,
        });
      }

      const structured = {
        total: page.totalElements ?? rows.length,
        count: invoices.length,
        offset: params.offset,
        has_more: rows.length > params.offset + params.limit,
        invoices,
      };

      return ok(params.response_format, structured, () => {
        if (!invoices.length) {
          return `# Offene Rechnungen\n\nAlle Rechnungen mit Status "${params.status}" sind bereits abgelegt.`;
        }
        const lines = [`# Rechnungen "${params.status}" (${invoices.length})`, ""];
        for (const i of invoices) {
          const head = `**${i.rechnungsnummer || "(ohne Nummer)"}** · ${deDate(i.datum)} · ${i.kunde}`;
          lines.push(`## ${head}`);
          if (i.titel) lines.push(i.titel);
          const money = euro(i.betrag, i.waehrung);
          if (money) lines.push(`Betrag: ${money}`);
          lines.push(
            i.projektnummer
              ? `Projekt: **${i.projektnummer}**`
              : `⚠ Projekt: unklar — ${i.hinweis ?? ""}`,
          );
          if (i.bereits_abgelegt) lines.push("_bereits abgelegt_");
          lines.push(`\`${i.id}\``, "");
        }
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "lex_download_invoice_pdf",
    {
      title: "Rechnungs-PDF herunterladen",
      description: `Render an invoice as PDF and save it locally, ready to be uploaded into the project folder.

Triggers the PDF rendering in Lexware, downloads the file and writes it to disk. The file name
is deterministic — "RE_<Nummer>_<Datum>_<Kunde>.pdf" — so filing the same invoice twice
overwrites rather than duplicates.

Args:
  - invoice_id (string): the id from lex_list_open_invoices
  - target_dir (string, optional): directory to write into; defaults to LEX_DOWNLOAD_DIR
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "invoice_id": string, "rechnungsnummer": string, "datum": string, "kunde": string,
    "projektnummer": string|null, "hinweis": string,
    "dateiname": string, "pfad": string, "groesse_bytes": number
  }

The returned "pfad" is what you hand to the SharePoint upload. The target folder is
"Documents/Angebote/<projektnummer>_*/Rechnungen/Out" — resolve it by project number, and
when several folders share that number, ask rather than pick.

Error Handling:
  - Says so explicitly when the invoice is still a draft and has no PDF to render.`,
      inputSchema: {
        invoice_id: z.string().min(1).describe("Invoice id from lex_list_open_invoices"),
        target_dir: z.string().optional().describe("Directory to write the PDF into"),
        response_format: formatSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: {
      invoice_id: string;
      target_dir?: string;
      response_format: "markdown" | "json";
    }) => {
      const invoice = await getInvoice(params.invoice_id);
      const resolved = resolveProjectNumber(invoice);
      const fileId = await renderDocument(params.invoice_id);
      const pdf = await downloadFile(fileId);

      const dir = resolve(params.target_dir ?? DOWNLOAD_DIR);
      await mkdir(dir, { recursive: true });
      const kunde = invoice.address?.name ?? "";
      const dateiname = pdfFileName(
        invoice.voucherNumber ?? "",
        invoice.voucherDate ?? "",
        kunde,
      );
      const pfad = join(dir, dateiname);
      await writeFile(pfad, pdf);

      const structured = {
        invoice_id: params.invoice_id,
        rechnungsnummer: invoice.voucherNumber ?? "",
        datum: (invoice.voucherDate ?? "").slice(0, 10),
        kunde,
        projektnummer: resolved.projektnummer,
        ...(resolved.hinweis ? { hinweis: resolved.hinweis } : {}),
        dateiname,
        pfad,
        groesse_bytes: pdf.length,
      };

      return ok(params.response_format, structured, () => {
        const lines = [
          `# ${dateiname}`,
          "",
          `Gespeichert unter \`${pfad}\` (${Math.round(pdf.length / 1024)} KB)`,
          "",
        ];
        lines.push(
          resolved.projektnummer
            ? `Ziel: \`Documents/Angebote/${resolved.projektnummer}_*/Rechnungen/Out\``
            : `⚠ Kein eindeutiges Ziel — ${resolved.hinweis ?? ""}`,
        );
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "lex_match_project_folder",
    {
      title: "Projektordner zuordnen",
      description: `Decide between several project folders that share one project number.

Several NOVA WORKS folders can carry the same number — 26-0007 exists four times
(80er Live, … Frankfurt, … Hamburg, … Schalke). This tool compares the remaining words of
the invoice text with the folder names and picks the folder only when exactly one wins.

Args:
  - ordner (string[]): candidate folders, as names or SharePoint webUrls
  - invoice_id (string, optional): read title, introduction and remark from this invoice
  - text (string, optional): use this text instead of fetching an invoice
  - response_format ('markdown' | 'json'): default 'markdown'

Give either invoice_id or text.

Returns (json):
  {
    "treffer": string|null,        // the chosen folder, null when undecidable
    "projektnummer": string|null,
    "hinweis": string,             // why it is undecidable, when it is
    "kandidaten": [{ "ordner","name","punkte","passende_woerter" }]
  }

"treffer" stays null on a tie and when no word matches at all — then a human decides.
Do not fall back to picking the first candidate.

Examples:
  - Invoice "Schlussrechnung 26-0007 Schalke" against the four 26-0007 folders
    -> treffer = the Schalke folder
  - Invoice "Schlussrechnung 26-0007" against the same four
    -> treffer = null, because nothing distinguishes them`,
      inputSchema: {
        ordner: z
          .array(z.string().min(1))
          .min(1)
          .describe("Candidate folders, as names or webUrls"),
        invoice_id: z.string().optional().describe("Invoice to read the text from"),
        text: z.string().optional().describe("Invoice text, instead of invoice_id"),
        response_format: formatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: {
      ordner: string[];
      invoice_id?: string;
      text?: string;
      response_format: "markdown" | "json";
    }) => {
      if ((params.invoice_id === undefined) === (params.text === undefined)) {
        return fail("Gib entweder 'invoice_id' oder 'text' an, nicht beides und nicht keines.");
      }

      let text = params.text ?? "";
      let projektnummer: string | null = null;
      if (params.invoice_id) {
        const invoice = await getInvoice(params.invoice_id);
        text = [invoice.title, invoice.introduction, invoice.remark].filter(Boolean).join(" ");
        projektnummer = resolveProjectNumber(invoice).projektnummer;
      } else {
        const treffer = /\b(\d{2}-\d{3,4})\b/.exec(text);
        projektnummer = treffer ? treffer[1] : null;
      }

      const ergebnis = ordnerZuordnen(text, params.ordner, projektnummer ?? undefined);
      const structured = {
        treffer: ergebnis.treffer,
        projektnummer,
        ...(ergebnis.hinweis ? { hinweis: ergebnis.hinweis } : {}),
        kandidaten: ergebnis.kandidaten,
      };

      return ok(params.response_format, structured, () => {
        const lines = [`# Ordnerzuordnung${projektnummer ? ` für ${projektnummer}` : ""}`, ""];
        lines.push(`Rechnungstext: ${text || "(leer)"}`, "");
        for (const k of ergebnis.kandidaten) {
          const mark = k.ordner === ergebnis.treffer ? "→" : " ";
          lines.push(
            `${mark} **${k.name}** — ${k.punkte} Treffer${k.passende_woerter.length ? ` (${k.passende_woerter.join(", ")})` : ""}`,
          );
        }
        lines.push("");
        lines.push(
          ergebnis.treffer
            ? `Zuordnung: \`${ergebnis.treffer}\``
            : `⚠ Nicht zuzuordnen — ${ergebnis.hinweis ?? ""}`,
        );
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "lex_mark_filed",
    {
      title: "Rechnung als abgelegt vermerken",
      description: `Record that an invoice has been filed, so the next poll skips it.

Call this only after the upload actually succeeded. Without it the same invoice is offered
again on every round, because Lexware keeps it "offen" until it is paid.

Args:
  - invoice_id (string): the id that was filed
  - ablageort (string): where it landed, e.g. the SharePoint webUrl of the uploaded file
  - rechnungsnummer (string, optional), projektnummer (string, optional): for the log
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  { "invoice_id","rechnungsnummer","projektnummer","abgelegt_am","ablageort","ledger" }`,
      inputSchema: {
        invoice_id: z.string().min(1).describe("Invoice id that was filed"),
        ablageort: z.string().min(1).describe("Where the PDF ended up"),
        rechnungsnummer: z.string().default("").describe("Invoice number, for the log"),
        projektnummer: z.string().optional().describe("Project it was filed under"),
        response_format: formatSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guard(async (params: {
      invoice_id: string;
      ablageort: string;
      rechnungsnummer: string;
      projektnummer?: string;
      response_format: "markdown" | "json";
    }) => {
      const entry = {
        invoice_id: params.invoice_id,
        rechnungsnummer: params.rechnungsnummer,
        projektnummer: params.projektnummer ?? null,
        abgelegt_am: new Date().toISOString(),
        ablageort: params.ablageort,
      };
      await markFiled(entry);
      return ok(
        params.response_format,
        { ...entry, ledger: ledgerLocation() },
        () =>
          `✓ ${entry.rechnungsnummer || entry.invoice_id} als abgelegt vermerkt${entry.projektnummer ? ` (Projekt ${entry.projektnummer})` : ""}.\n\n${entry.ablageort}`,
      );
    }),
  );

  server.registerTool(
    "lex_filing_log",
    {
      title: "Ablage-Protokoll",
      description: `Show which invoices have been filed, newest first.

Args:
  - limit (number): 1-200, default 25
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  { "ledger": string, "count": number, "entries": [{ "invoice_id","rechnungsnummer","projektnummer","abgelegt_am","ablageort" }] }`,
      inputSchema: {
        limit: z.number().int().min(1).max(200).default(25).describe("Maximum entries"),
        response_format: formatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    guard(async (params: { limit: number; response_format: "markdown" | "json" }) => {
      const entries = await listFiled(params.limit);
      const structured = {
        ledger: ledgerLocation(),
        count: entries.length,
        entries,
      };
      return ok(params.response_format, structured, () => {
        if (!entries.length) {
          return `# Ablage-Protokoll\n\nNoch nichts abgelegt.\n\nProtokoll: \`${ledgerLocation()}\``;
        }
        const lines = [`# Ablage-Protokoll (${entries.length})`, ""];
        for (const e of entries) {
          lines.push(
            `- ${deDate(e.abgelegt_am)} · **${e.rechnungsnummer || e.invoice_id}**${e.projektnummer ? ` · Projekt ${e.projektnummer}` : ""}`,
          );
        }
        lines.push("", `_Protokoll: \`${ledgerLocation()}\`_`);
        return lines.join("\n");
      });
    }),
  );
}
