/**
 * Thin PostgREST client for the NOVA WORKS `app_data` key-value table.
 *
 * The whole app stores its state as jsonb documents keyed by `nw_*` strings,
 * so every read here is "fetch one document" or "fetch documents by prefix".
 */

import {
  CHARACTER_LIMIT,
  KEYS,
  REQUEST_TIMEOUT_MS,
  SUPABASE_KEY,
  SUPABASE_URL,
} from "../constants.js";
import type { AppDataRow } from "../types.js";

const REST = `${SUPABASE_URL}/rest/v1/app_data`;

/** An error carrying enough context for the agent to act on it. */
export class SupabaseError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SupabaseError";
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new SupabaseError(describeStatus(res.status, body), res.status);
    }
    return res;
  } catch (err) {
    if (err instanceof SupabaseError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new SupabaseError(
        `Supabase did not respond within ${REQUEST_TIMEOUT_MS / 1000}s. Check the network connection and that ${SUPABASE_URL} is reachable.`,
      );
    }
    throw new SupabaseError(
      `Could not reach Supabase at ${SUPABASE_URL}: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

function describeStatus(status: number, body: string): string {
  switch (status) {
    case 401:
    case 403:
      return `Supabase rejected the key (HTTP ${status}). The anon key only has access to keys starting with "nw_" (see supabase_rls_setup.sql). Set NOVA_SUPABASE_KEY if the project key has been rotated. Details: ${body}`;
    case 404:
      return `Table app_data not found (HTTP 404). Check NOVA_SUPABASE_URL points at the right project and that supabase_setup.sql has been run. Details: ${body}`;
    case 429:
      return "Supabase rate limit reached (HTTP 429). Wait a moment and retry.";
    default:
      return `Supabase request failed with HTTP ${status}. Details: ${body}`;
  }
}

/** Read one document. Returns `null` when the key does not exist. */
export async function getKey<T = unknown>(key: string): Promise<T | null> {
  const url = `${REST}?select=value&key=eq.${encodeURIComponent(key)}&limit=1`;
  const res = await request(url, { method: "GET", headers: headers() });
  const rows = (await res.json()) as Array<{ value: T }>;
  return rows.length ? rows[0].value : null;
}

/** Read one document, or throw a message naming the tool that can list valid keys. */
export async function requireKey<T = unknown>(key: string, hint: string): Promise<T> {
  const value = await getKey<T>(key);
  if (value === null) {
    throw new SupabaseError(`No data stored under key "${key}". ${hint}`);
  }
  return value;
}

/** List rows whose key starts with `prefix`, newest change first. */
export async function listByPrefix(
  prefix: string,
  withValues = false,
): Promise<AppDataRow[]> {
  const select = withValues ? "key,value,updated_at" : "key,updated_at";
  const url = `${REST}?select=${select}&key=like.${encodeURIComponent(prefix + "*")}&order=updated_at.desc`;
  const res = await request(url, { method: "GET", headers: headers() });
  return (await res.json()) as AppDataRow[];
}

/** Insert or replace one document. */
export async function setKey(key: string, value: unknown): Promise<void> {
  await request(`${REST}?on_conflict=key`, {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

/**
 * Copy the current value of `key` into the MCP backup slot before overwriting it.
 * One slot, deliberately: it is a safety net for the last mutation, not a history.
 */
export async function snapshotBeforeWrite(key: string): Promise<void> {
  const current = await getKey(key);
  if (current === null) return;
  await setKey(KEYS.mcpBackup, {
    key,
    value: current,
    savedAt: new Date().toISOString(),
    note: "Automatic snapshot taken by nova-works-mcp-server before a write.",
  });
}

/** Truncate an oversized payload so a single tool result cannot flood the context. */
export function capText(text: string, note: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  return `${text.slice(0, CHARACTER_LIMIT)}\n\n[Response truncated at ${CHARACTER_LIMIT} characters. ${note}]`;
}
