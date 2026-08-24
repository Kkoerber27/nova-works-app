/**
 * Client for the Lexware Office API.
 *
 * Two things shape this module: the key is a bearer token with no expiry, and
 * the gateway allows two requests per second per key — so every call goes
 * through one throttled queue.
 */

import {
  API_BASE,
  API_KEY,
  MIN_REQUEST_GAP_MS,
  REQUEST_TIMEOUT_MS,
} from "../constants.js";
import type {
  DocumentReference,
  Invoice,
  VoucherListPage,
} from "../types.js";

/** Hostname only, for error messages that talk about network policy. */
const HOST = (() => {
  try {
    return new URL(API_BASE).host;
  } catch {
    return API_BASE;
  }
})();

export class LexwareError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "LexwareError";
  }
}

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

/** Serialise requests and keep them under the documented rate limit. */
function throttled<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return run();
  });
  // Keep the chain alive even when one call rejects.
  queue = next.catch(() => undefined);
  return next;
}

function requireKey(): void {
  if (!API_KEY) {
    throw new LexwareError(
      "No API key configured. Create one in Lexware Office under Einstellungen → Öffentliche API and set it as LEX_API_KEY for this server.",
    );
  }
}

async function call(path: string, accept: string): Promise<Response> {
  requireKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: accept },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new LexwareError(describe(res.status, body, path), res.status);
    }
    return res;
  } catch (err) {
    if (err instanceof LexwareError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new LexwareError(
        `Lexware did not answer within ${REQUEST_TIMEOUT_MS / 1000}s. Retry, or check that ${API_BASE} is reachable from this machine.`,
      );
    }
    throw new LexwareError(
      `Could not reach Lexware at ${API_BASE}: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Lexware answers errors as a JSON object. Anything else came from in between. */
function parseApiError(body: string): { message?: string } | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as { message?: string };
    }
  } catch {
    // Not JSON, so not a Lexware error.
  }
  return null;
}

function describe(status: number, body: string, path: string): string {
  const api = parseApiError(body);
  const detail = (api?.message ?? body).trim().slice(0, 400);

  // A refusal without a Lexware body never reached Lexware: a proxy, a VPN or a
  // container egress allowlist stopped it. Saying "key" here sends people to
  // the wrong place entirely.
  if (!api && (status === 401 || status === 403 || status === 407)) {
    return (
      `Blocked on the way to Lexware (HTTP ${status}). The request to ${HOST} was refused by a ` +
      `proxy or network egress policy before it reached Lexware, so this is not a key or ` +
      `permission problem. Allow the host "${HOST}" in the network settings of wherever this ` +
      `server runs. Response: ${detail || "(empty)"}`
    );
  }

  switch (status) {
    case 401:
      return `Lexware rejected the API key (401). Check LEX_API_KEY — keys are scoped to one organisation and can be revoked in Einstellungen → Öffentliche API. Details: ${detail || "(none)"}`;
    case 403:
      return `Lexware denied access to ${path} (403). The key's organisation may not have this feature, or the key lacks the scope. Details: ${detail || "(none)"}`;
    case 404:
      return `Lexware has nothing at ${path} (404). For an invoice id, check it came from lex_list_open_invoices. Details: ${detail || "(none)"}`;
    case 406:
      return `Lexware refused the requested format for ${path} (406). Details: ${detail || "(none)"}`;
    case 429:
      return "Lexware rate limit hit (429). The server already paces requests at under two per second; wait a moment and retry.";
    default:
      return `Lexware request to ${path} failed with HTTP ${status}. Details: ${detail || "(no body)"}`;
  }
}

/** One page of the voucher list, filtered to invoices in the given status. */
export async function listVouchers(
  status: string,
  page: number,
  size: number,
): Promise<VoucherListPage> {
  const params = new URLSearchParams({
    voucherType: "invoice",
    voucherStatus: status,
    page: String(page),
    size: String(size),
    sort: "voucherDate,DESC",
  });
  const res = await throttled(() =>
    call(`/v1/voucherlist?${params.toString()}`, "application/json"),
  );
  return (await res.json()) as VoucherListPage;
}

/** Full invoice, for the text fields the project number can hide in. */
export async function getInvoice(id: string): Promise<Invoice> {
  const res = await throttled(() => call(`/v1/invoices/${id}`, "application/json"));
  return (await res.json()) as Invoice;
}

/**
 * Ask Lexware to render the invoice as PDF and hand back the file id.
 * Invoices created through the API need this before a file exists.
 */
export async function renderDocument(id: string): Promise<string> {
  const res = await throttled(() =>
    call(`/v1/invoices/${id}/document`, "application/json"),
  );
  const doc = (await res.json()) as DocumentReference;
  if (!doc?.documentFileId) {
    throw new LexwareError(
      `Lexware returned no documentFileId for invoice ${id}. The invoice may still be a draft — only finalised ("offen") invoices have a PDF.`,
    );
  }
  return doc.documentFileId;
}

/** Download a rendered file by its documentFileId. */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const res = await throttled(() => call(`/v1/files/${fileId}`, "application/pdf"));
  return Buffer.from(await res.arrayBuffer());
}
