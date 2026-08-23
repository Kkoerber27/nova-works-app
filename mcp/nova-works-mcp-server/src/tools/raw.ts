/** Escape hatch: direct access to the app_data key-value store. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  fail,
  guard,
  limitSchema,
  offsetSchema,
  ok,
  paginate,
  ResponseFormat,
  responseFormatSchema,
} from "../services/format.js";
import { getKey, listByPrefix } from "../services/supabase.js";

export function registerRawTools(server: McpServer): void {
  server.registerTool(
    "nova_list_keys",
    {
      title: "Gespeicherte Keys auflisten",
      description: `List the keys in the Supabase 'app_data' store with their last-changed timestamp.

Every NOVA WORKS document lives under a 'nw_' key. Use this to discover data the dedicated
tools do not cover — import channels, backups, migration flags.

Known key families:
  - nw_crew_planungen      the Crewplanungen (nova_list_projects / nova_get_project)
  - nw_crew_techniker      custom technicians (nova_search_technicians)
  - nw_crew_gewerke        custom Gewerke
  - nw_hotel_save_*        Hotelplanung per event (nova_get_hotel_plan)
  - nw_schichtplan_*       Schichtplan per event (nova_get_schichtplan)
  - nw_bauzeit_save_*      Bauzeitenplan per event (nova_get_bauzeitenplan)
  - nw_*_import            one-shot transfer channels between the HTML tools
  - nw_backup_*            rolling and daily backups

Args:
  - prefix (string): key prefix to list, default 'nw_'
  - limit (number): 1-200, default 50
  - offset (number): default 0
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  { "total","count","offset","has_more","keys": [{ "key": string, "updated_at": string }] }

Note: the anon key can only reach keys starting with 'nw_' (see supabase_rls_setup.sql).`,
      inputSchema: {
        prefix: z.string().default("nw_").describe("Key prefix to list"),
        limit: limitSchema,
        offset: offsetSchema,
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: {
      prefix: string;
      limit: number;
      offset: number;
      response_format: ResponseFormat;
    }) => {
      const rows = await listByPrefix(params.prefix);
      if (!rows.length) {
        return fail(
          `No keys found for prefix "${params.prefix}". The anon key can only read keys starting with "nw_".`,
        );
      }
      const { page, total, has_more, next_offset } = paginate(
        rows,
        params.limit,
        params.offset,
      );
      const keys = page.map((r) => ({ key: r.key, updated_at: r.updated_at }));
      const structured = {
        total,
        count: keys.length,
        offset: params.offset,
        has_more,
        ...(next_offset !== undefined ? { next_offset } : {}),
        keys,
      };
      return ok(params.response_format, structured, () => {
        const lines = [`# Keys mit Präfix "${params.prefix}" (${total})`, ""];
        for (const k of keys) lines.push(`- \`${k.key}\` — ${k.updated_at}`);
        if (has_more) lines.push("", `_Weitere Ergebnisse: offset=${next_offset}_`);
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "nova_get_raw",
    {
      title: "Rohdaten eines Keys lesen",
      description: `Read the raw JSON document stored under one key.

Use only when no dedicated tool covers the data — the typed tools return smaller, more
readable results. Large documents are truncated at the response character limit.

Args:
  - key (string): the exact key, e.g. 'nw_funk_import'
  - response_format ('markdown' | 'json'): default 'json' is usually what you want here

Returns (json):
  { "key": string, "value": <the stored document> }

Error Handling:
  - Returns an error naming nova_list_keys when the key does not exist.`,
      inputSchema: {
        key: z.string().min(1).describe("Exact key name, e.g. 'nw_crew_gewerke'"),
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: { key: string; response_format: ResponseFormat }) => {
      const value = await getKey(params.key);
      if (value === null) {
        return fail(
          `No document stored under "${params.key}". Use nova_list_keys to see what exists.`,
        );
      }
      const structured = { key: params.key, value };
      return ok(
        params.response_format,
        structured,
        () =>
          `# ${params.key}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``,
        "This document is large; read it through a dedicated tool instead.",
      );
    }),
  );
}
