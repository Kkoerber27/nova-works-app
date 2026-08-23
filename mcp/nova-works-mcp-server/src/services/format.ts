/** Shared response shaping so every tool returns the same two formats. */

import { z } from "zod";

import type { CrewAssignment } from "../types.js";
import { capText, SupabaseError } from "./supabase.js";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}

export const responseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for reading, 'json' for further processing");

export const limitSchema = z
  .number()
  .int()
  .min(1)
  .max(200)
  .default(50)
  .describe("Maximum number of results to return");

export const offsetSchema = z
  .number()
  .int()
  .min(0)
  .default(0)
  .describe("Number of results to skip, for paging through a long list");

/** The shape every tool handler returns to the MCP SDK. */
export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  [key: string]: unknown;
}

/** Build a successful result carrying both a readable and a structured view. */
export function ok(
  format: ResponseFormat,
  structured: Record<string, unknown>,
  markdown: () => string,
  truncationHint = "Narrow the filters or use 'limit' and 'offset'.",
): ToolResult {
  const text =
    format === ResponseFormat.JSON
      ? JSON.stringify(structured, null, 2)
      : markdown();
  return {
    content: [{ type: "text", text: capText(text, truncationHint) }],
    structuredContent: structured,
  };
}

/** Build an error result with a message the agent can act on. */
export function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/** Wrap a handler so no exception escapes as an unhandled protocol error. */
export function guard<T>(handler: (params: T) => Promise<ToolResult>) {
  return async (params: T): Promise<ToolResult> => {
    try {
      return await handler(params);
    } catch (err) {
      if (err instanceof SupabaseError) return fail(err.message);
      return fail(
        `Unexpected failure: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };
}

/** Apply offset/limit and report whether more results exist. */
export function paginate<T>(
  items: T[],
  limit: number,
  offset: number,
): { page: T[]; total: number; has_more: boolean; next_offset?: number } {
  const page = items.slice(offset, offset + limit);
  const consumed = offset + page.length;
  const has_more = consumed < items.length;
  return {
    page,
    total: items.length,
    has_more,
    ...(has_more ? { next_offset: consumed } : {}),
  };
}

/** "01.03.2026" from "2026-03-01"; passes anything unparseable straight through. */
export function deDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso ?? "");
}

/** "01.03.2026 – 05.03.2026", or "" when the range is unknown. */
export function deRange(von: string, bis: string): string {
  if (!von && !bis) return "";
  if (von === bis) return deDate(von);
  return `${deDate(von)} – ${deDate(bis)}`;
}

const STATUS_MARK: Record<string, string> = {
  bestaetigt: "✓",
  angefragt: "?",
  abgesagt: "✗",
};

/** One crew booking as a markdown bullet, used by several tools. */
export function assignmentLine(a: CrewAssignment, withProject = true): string {
  const parts = [`${STATUS_MARK[a.status] ?? "?"} **${a.name || "(ohne Namen)"}**`];
  if (a.funktion) parts.push(a.funktion);
  if (withProject) parts.push(`Projekt: ${a.projekt}`);
  parts.push(`Gewerk: ${a.gewerk}`);
  const range = deRange(a.von, a.bis);
  if (range) parts.push(range);
  if (a.phasen.length) parts.push(`Phasen: ${a.phasen.join(", ")}`);
  return `- ${parts.join(" · ")}`;
}

/** Contact details as a compact suffix, omitting whatever is missing. */
export function contactSuffix(tel: string, email: string): string {
  const bits = [tel, email].filter(Boolean);
  return bits.length ? ` (${bits.join(", ")})` : "";
}
