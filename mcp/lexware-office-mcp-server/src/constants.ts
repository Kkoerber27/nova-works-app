/** Shared constants for the Lexware Office MCP server. */

import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Canonical API gateway. The old api.lexoffice.io host was retired at the end
 * of 2025; override only if Lexware moves the gateway again.
 */
export const API_BASE = process.env.LEX_API_BASE ?? "https://api.lexware.io";

/** Personal access token from Lexware Office → Einstellungen → Öffentliche API. */
export const API_KEY = process.env.LEX_API_KEY ?? "";

/** Where the record of already-filed invoices lives. */
export const LEDGER_PATH =
  process.env.LEX_LEDGER_PATH ?? join(homedir(), ".nova-works", "lexware-filed.json");

/** Directory the rendered PDFs are written to before they are filed. */
export const DOWNLOAD_DIR =
  process.env.LEX_DOWNLOAD_DIR ?? join(homedir(), ".nova-works", "rechnungen");

/** Lexware allows two requests per second per key; stay just under it. */
export const MIN_REQUEST_GAP_MS = 550;

export const REQUEST_TIMEOUT_MS = 30000;

export const CHARACTER_LIMIT = 25000;

/**
 * NOVA WORKS project numbers: two digits for the year, a dash, then three or
 * four running digits — "26-0007", "26-005". Matched case-insensitively and
 * only when not glued to further digits.
 */
export const PROJECT_NUMBER_PATTERN = /\b(\d{2}-\d{3,4})\b/g;
