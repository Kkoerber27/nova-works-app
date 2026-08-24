/**
 * Record of which invoices have already been filed.
 *
 * The poll runs every few minutes and Lexware keeps an invoice "offen" until it
 * is paid, so without this the same PDF would be filed again on every round.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { LEDGER_PATH } from "../constants.js";
import type { LedgerEntry } from "../types.js";

let cache: Map<string, LedgerEntry> | null = null;

async function load(): Promise<Map<string, LedgerEntry>> {
  if (cache) return cache;
  try {
    const raw = await readFile(LEDGER_PATH, "utf8");
    const parsed = JSON.parse(raw) as LedgerEntry[];
    cache = new Map(
      (Array.isArray(parsed) ? parsed : []).map((e) => [e.invoice_id, e]),
    );
  } catch {
    // No ledger yet, or unreadable: start empty rather than fail the tool.
    cache = new Map();
  }
  return cache;
}

async function persist(entries: Map<string, LedgerEntry>): Promise<void> {
  await mkdir(dirname(LEDGER_PATH), { recursive: true });
  const sorted = [...entries.values()].sort((a, b) =>
    b.abgelegt_am.localeCompare(a.abgelegt_am),
  );
  await writeFile(LEDGER_PATH, JSON.stringify(sorted, null, 2), "utf8");
}

export async function isFiled(invoiceId: string): Promise<boolean> {
  return (await load()).has(invoiceId);
}

export async function markFiled(entry: LedgerEntry): Promise<void> {
  const entries = await load();
  entries.set(entry.invoice_id, entry);
  await persist(entries);
}

export async function listFiled(limit: number): Promise<LedgerEntry[]> {
  const entries = await load();
  return [...entries.values()]
    .sort((a, b) => b.abgelegt_am.localeCompare(a.abgelegt_am))
    .slice(0, limit);
}

/** Where the ledger lives, for error messages and the status tool. */
export function ledgerLocation(): string {
  return LEDGER_PATH;
}
