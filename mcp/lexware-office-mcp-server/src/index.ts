#!/usr/bin/env node
/**
 * MCP server for Lexware Office invoices.
 *
 * Covers the Lexware half of filing an outgoing invoice: find the finalised
 * ("offen") invoices, read the NOVA WORKS project number out of them, and
 * download the PDF. Putting the file into SharePoint is left to the Microsoft
 * 365 connector, so this server needs no Microsoft credentials of its own.
 *
 * Transport: stdio. Configure via LEX_API_KEY, LEX_API_BASE, LEX_DOWNLOAD_DIR
 * and LEX_LEDGER_PATH.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { API_BASE, API_KEY } from "./constants.js";
import { registerInvoiceTools } from "./tools/invoices.js";

const server = new McpServer(
  { name: "lexware-office-mcp-server", version: "1.0.0" },
  {
    instructions: [
      "Tools for filing NOVA WORKS outgoing invoices from Lexware Office.",
      "",
      "The filing round is: lex_list_open_invoices to see what is unfiled, then per invoice",
      "lex_download_invoice_pdf, then upload the returned file into",
      "'Documents/Angebote/<projektnummer>_*/Rechnungen/Out' with the Microsoft 365 tools,",
      "then lex_mark_filed so the next round skips it.",
      "",
      "Never guess the project. 'projektnummer' is null whenever the invoice carries no number",
      "or more than one, and several folders can share one number (26-0007 has four). When the",
      "project is not unambiguous, leave the invoice unfiled and say which invoice needs a",
      "decision.",
      "",
      "Only call lex_mark_filed after an upload actually succeeded.",
    ].join("\n"),
  },
);

registerInvoiceTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `lexware-office-mcp-server ready on stdio — ${API_BASE}, key ${API_KEY ? "configured" : "MISSING (set LEX_API_KEY)"}`,
  );
}

main().catch((error: unknown) => {
  console.error(
    "lexware-office-mcp-server failed to start:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
