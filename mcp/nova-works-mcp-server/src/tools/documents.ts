/** Tools for the per-event documents: Hotelplanung, Schichtplan, Bauzeitenplan. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { PREFIXES } from "../constants.js";
import { normalise } from "../services/domain.js";
import {
  deDate,
  deRange,
  fail,
  guard,
  ok,
  ResponseFormat,
  responseFormatSchema,
} from "../services/format.js";
import { getKey, listByPrefix } from "../services/supabase.js";
import type { BauzeitState, HotelState, SchichtplanState } from "../types.js";

/** The app writes '_default' when a tool is opened without an ?e= event name. */
const DEFAULT_EVENT = "_default";

function keyFor(prefix: string, event: string): string {
  return prefix + (event || DEFAULT_EVENT);
}

function eventFrom(prefix: string, key: string): string {
  return key.slice(prefix.length);
}

/**
 * Resolve a user-supplied event name to a stored key, tolerating case and
 * partial matches so "automotive" finds "Automotive Show 2026".
 */
async function resolveKey(
  prefix: string,
  event: string,
): Promise<{ key: string; event: string } | { error: string }> {
  const exact = keyFor(prefix, event);
  if (await getKey(exact)) return { key: exact, event: event || DEFAULT_EVENT };

  const rows = await listByPrefix(prefix);
  const events = rows.map((r) => eventFrom(prefix, r.key));
  const hit =
    events.find((e) => normalise(e) === normalise(event)) ??
    events.find((e) => normalise(e).includes(normalise(event)));
  if (hit) return { key: keyFor(prefix, hit), event: hit };

  return {
    error: events.length
      ? `No document stored for event "${event}". Available: ${events.join(", ")}.`
      : `Nothing stored under the "${prefix}" prefix yet. Run nova_list_events to see which events have documents.`,
  };
}

const eventInput = {
  event: z
    .string()
    .min(1)
    .describe("Event name as used in the tool URL (?e=...); partial names work"),
  response_format: responseFormatSchema,
};

export function registerDocumentTools(server: McpServer): void {
  server.registerTool(
    "nova_list_events",
    {
      title: "Events mit Dokumenten auflisten",
      description: `List which events have a Hotelplanung, Schichtplan or Bauzeitenplan stored, with the time of the last save.

These documents are keyed by event name, independent of the Crewplanungen, so this is how
you discover the names the other document tools accept.

Args:
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "events": [{
      "event": string,
      "hotel": string|null,        // ISO timestamp of last change, null if absent
      "schichtplan": string|null,
      "bauzeitenplan": string|null
    }]
  }

Examples:
  - "Für welche Events gibt es eine Hotelplanung?" -> no arguments`,
      inputSchema: { response_format: responseFormatSchema },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: { response_format: ResponseFormat }) => {
      const [hotel, schicht, bauzeit] = await Promise.all([
        listByPrefix(PREFIXES.hotel),
        listByPrefix(PREFIXES.schichtplan),
        listByPrefix(PREFIXES.bauzeit),
      ]);

      const merged = new Map<
        string,
        { event: string; hotel: string | null; schichtplan: string | null; bauzeitenplan: string | null }
      >();
      const add = (
        rows: typeof hotel,
        prefix: string,
        field: "hotel" | "schichtplan" | "bauzeitenplan",
      ) => {
        for (const r of rows) {
          const event = eventFrom(prefix, r.key);
          const entry =
            merged.get(event) ??
            { event, hotel: null, schichtplan: null, bauzeitenplan: null };
          entry[field] = r.updated_at;
          merged.set(event, entry);
        }
      };
      add(hotel, PREFIXES.hotel, "hotel");
      add(schicht, PREFIXES.schichtplan, "schichtplan");
      add(bauzeit, PREFIXES.bauzeit, "bauzeitenplan");

      const events = [...merged.values()].sort((a, b) => a.event.localeCompare(b.event, "de"));
      if (!events.length) {
        return fail(
          "No Hotelplanung, Schichtplan or Bauzeitenplan has been saved yet. Save one from the corresponding HTML tool first.",
        );
      }

      return ok(params.response_format, { total: events.length, events }, () => {
        const lines = [`# Events mit Dokumenten (${events.length})`, ""];
        for (const e of events) {
          const docs = [
            e.hotel ? "Hotel" : null,
            e.schichtplan ? "Schichtplan" : null,
            e.bauzeitenplan ? "Bauzeitenplan" : null,
          ].filter(Boolean);
          lines.push(`- **${e.event}** — ${docs.join(", ")}`);
        }
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "nova_get_hotel_plan",
    {
      title: "Hotelplanung abrufen",
      description: `Get the Hotelplanung for one event: who stays, check-in/check-out, number of nights and room type.

Args:
  - event (string): event name; partial and case-insensitive
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "event": string, "gespeichert_am": string, "naechte_gesamt": number,
    "zimmer": { "<Zimmertyp>": number },
    "rows": [{ "name","checkin1","checkout1","checkin2","checkout2","nights","zimmer","notiz","changed" }]
  }
  A second check-in/out pair is used when a stay is split. "changed" marks rows the planner
  flagged as changed since the last hotel confirmation.

Examples:
  - "Wer übernachtet bei der Automotive Show?" -> event="Automotive Show"`,
      inputSchema: eventInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: { event: string; response_format: ResponseFormat }) => {
      const resolved = await resolveKey(PREFIXES.hotel, params.event);
      if ("error" in resolved) return fail(resolved.error);

      const state = await getKey<HotelState>(resolved.key);
      const rows = Array.isArray(state?.rows) ? state.rows : [];
      const zimmer: Record<string, number> = {};
      let naechte = 0;
      for (const r of rows) {
        const n = Number(r.nights);
        if (Number.isFinite(n)) naechte += n;
        const type = r.zimmer || "unbekannt";
        zimmer[type] = (zimmer[type] ?? 0) + 1;
      }

      const structured = {
        event: resolved.event,
        gespeichert_am: state?.savedAt ?? "",
        naechte_gesamt: naechte,
        zimmer,
        rows,
      };

      return ok(params.response_format, structured, () => {
        const lines = [`# Hotelplanung — ${resolved.event}`, ""];
        if (state?.savedAt) lines.push(`Zuletzt gespeichert: ${state.savedAt}`);
        lines.push(`${rows.length} Personen · ${naechte} Nächte gesamt`);
        const types = Object.entries(zimmer).map(([k, v]) => `${v}× ${k}`);
        if (types.length) lines.push(`Zimmer: ${types.join(", ")}`);
        lines.push("");
        for (const r of rows) {
          const stays = [
            deRange(r.checkin1, r.checkout1),
            deRange(r.checkin2, r.checkout2),
          ].filter(Boolean);
          const bits = [`**${r.name || "(ohne Namen)"}**`];
          if (stays.length) bits.push(stays.join(" + "));
          bits.push(`${r.nights} N`, r.zimmer || "—");
          if (r.notiz) bits.push(r.notiz);
          lines.push(`- ${r.changed ? "⚑ " : ""}${bits.join(" · ")}`);
        }
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "nova_get_schichtplan",
    {
      title: "Schichtplan abrufen",
      description: `Get the Schichtplan (shift plan) for one event: the phase dates and the per-day shift rows.

The 'days' payload is passed through as the Schichtplan tool stores it — a map of ISO date
to the rows entered for that day (Gewerk, times, people, notes).

Args:
  - event (string): event name; partial and case-insensitive
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  { "event": string, "gespeichert_am": string, "phasen": {"aufbau","proben","show","abbau"}, "days": object }

Examples:
  - "Wie sieht der Schichtplan für den Aufbau aus?" -> event="<Eventname>"`,
      inputSchema: eventInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: { event: string; response_format: ResponseFormat }) => {
      const resolved = await resolveKey(PREFIXES.schichtplan, params.event);
      if ("error" in resolved) return fail(resolved.error);

      const state = await getKey<SchichtplanState>(resolved.key);
      const structured = {
        event: resolved.event,
        gespeichert_am: state?.savedAt ?? "",
        phasen: state?.phases ?? {},
        days: state?.days ?? {},
      };

      return ok(
        params.response_format,
        structured,
        () => {
          const lines = [`# Schichtplan — ${resolved.event}`, ""];
          if (state?.savedAt) lines.push(`Zuletzt gespeichert: ${state.savedAt}`, "");
          lines.push("## Phasen");
          for (const [ph, value] of Object.entries(state?.phases ?? {})) {
            lines.push(`- **${ph}**: ${value || "—"}`);
          }
          lines.push("", "## Tage");
          const days = state?.days;
          if (days && typeof days === "object") {
            for (const [day, rows] of Object.entries(days as Record<string, unknown>)) {
              const count = Array.isArray(rows) ? rows.length : 0;
              lines.push(`- ${deDate(day)}: ${count} Einträge`);
            }
            lines.push(
              "",
              "_Für die einzelnen Schichtzeilen response_format='json' verwenden._",
            );
          } else {
            lines.push("_Keine Tagesdaten gespeichert._");
          }
          return lines.join("\n");
        },
        "Request a single event, or read the JSON payload in smaller pieces.",
      );
    }),
  );

  server.registerTool(
    "nova_get_bauzeitenplan",
    {
      title: "Bauzeitenplan abrufen",
      description: `Get the Bauzeitenplan (build schedule) for one event: phases, per-day entries and any extra days.

The 'dayData' payload is passed through as the Bauzeitenplan tool stores it.

Args:
  - event (string): event name; partial and case-insensitive
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "event": string, "gespeichert_am": string,
    "phasen": {"aufbau","proben","show","abbau"},
    "dayData": object, "extraDays": object
  }

Examples:
  - "Was steht im Bauzeitenplan für Montag?" -> event="<Eventname>", then read dayData`,
      inputSchema: eventInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: { event: string; response_format: ResponseFormat }) => {
      const resolved = await resolveKey(PREFIXES.bauzeit, params.event);
      if ("error" in resolved) return fail(resolved.error);

      const state = await getKey<BauzeitState>(resolved.key);
      const structured = {
        event: resolved.event,
        gespeichert_am: state?.savedAt ?? "",
        phasen: state?.phases ?? {},
        dayData: state?.dayData ?? {},
        extraDays: state?.extraDays ?? {},
      };

      return ok(
        params.response_format,
        structured,
        () => {
          const lines = [`# Bauzeitenplan — ${resolved.event}`, ""];
          if (state?.savedAt) lines.push(`Zuletzt gespeichert: ${state.savedAt}`, "");
          lines.push("## Phasen");
          for (const [ph, value] of Object.entries(state?.phases ?? {})) {
            lines.push(`- **${ph}**: ${value || "—"}`);
          }
          const dayData = state?.dayData;
          lines.push("", "## Tage");
          if (dayData && typeof dayData === "object") {
            for (const [day, rows] of Object.entries(dayData as Record<string, unknown>)) {
              const count = Array.isArray(rows) ? rows.length : 0;
              lines.push(`- ${deDate(day)}: ${count} Einträge`);
            }
            lines.push(
              "",
              "_Für die einzelnen Zeilen response_format='json' verwenden._",
            );
          } else {
            lines.push("_Keine Tagesdaten gespeichert._");
          }
          return lines.join("\n");
        },
        "Request a single event, or read the JSON payload in smaller pieces.",
      );
    }),
  );
}
