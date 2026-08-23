/**
 * Mutating tools. Disabled unless NOVA_ALLOW_WRITE=1, because they rewrite the
 * single 'nw_crew_planungen' document the whole Crewplanung UI reads from.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { ALLOW_WRITE, KEYS, PHASES, STATUS_VALUES } from "../constants.js";
import {
  findPlanung,
  gewerkName,
  loadGewerke,
  loadPlanungen,
  matches,
  statusOf,
} from "../services/domain.js";
import {
  fail,
  guard,
  ok,
  ResponseFormat,
  responseFormatSchema,
} from "../services/format.js";
import { setKey, snapshotBeforeWrite } from "../services/supabase.js";
import type { CrewMember, Gewerk, Phase, Planung } from "../types.js";

const WRITE_DISABLED =
  "Writing is disabled. Start the server with NOVA_ALLOW_WRITE=1 to enable the mutating tools. " +
  "Every write first copies the previous document into 'nw_backup_mcp'.";

/** Resolve a Gewerk reference to an id that exists in the project or the Gewerk list. */
function resolveGewerkId(p: Planung, gewerke: Gewerk[], ref: string): string | null {
  if (p.crew && Object.prototype.hasOwnProperty.call(p.crew, ref)) return ref;
  const g =
    gewerke.find((x) => x.id === ref) ??
    gewerke.find((x) => matches(x.name, ref)) ??
    gewerke.find((x) => matches(x.id, ref));
  return g?.id ?? null;
}

function gewerkOptions(p: Planung, gewerke: Gewerk[]): string {
  const ids = Object.keys(p.crew ?? {});
  const known = ids.length ? ids : gewerke.map((g) => g.id);
  return known.map((id) => `${gewerkName(gewerke, id)} (${id})`).join(", ");
}

export function registerWriteTools(server: McpServer): void {
  server.registerTool(
    "nova_set_crew_status",
    {
      title: "Buchungsstatus setzen",
      description: `Set the booking status of one crew member in a Crewplanung.

Addresses the person either by their position in the Gewerk ('index', as returned by
nova_get_project) or by name. Requires NOVA_ALLOW_WRITE=1.

Args:
  - project (string): project id or name
  - gewerk (string): Gewerk id or name
  - status ('angefragt'|'bestaetigt'|'abgesagt'): the new status
  - index (number, optional): position inside the Gewerk
  - name (string, optional): person name; must match exactly one row
  - response_format ('markdown' | 'json'): default 'markdown'

Exactly one of 'index' or 'name' must be given.

Returns (json):
  { "projekt","gewerk","index","name","status_vorher","status_nachher","backup_key" }

Examples:
  - "Setz Nico auf bestätigt" -> project=..., gewerk="av", name="Nico", status="bestaetigt"

Error Handling:
  - Refuses when 'name' matches several rows, listing the indices so you can retry with 'index'.
  - Refuses with an explanation when writing is disabled.`,
      inputSchema: {
        project: z.string().min(1).describe("Project id or name"),
        gewerk: z.string().min(1).describe("Gewerk id or name"),
        status: z.enum(STATUS_VALUES).describe("New booking status"),
        index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Position inside the Gewerk, from nova_get_project"),
        name: z.string().optional().describe("Person name; must match exactly one row"),
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: {
      project: string;
      gewerk: string;
      status: (typeof STATUS_VALUES)[number];
      index?: number;
      name?: string;
      response_format: ResponseFormat;
    }) => {
      if (!ALLOW_WRITE) return fail(WRITE_DISABLED);
      if ((params.index === undefined) === (params.name === undefined)) {
        return fail("Give exactly one of 'index' or 'name' to identify the crew member.");
      }

      const [planungen, gewerke] = await Promise.all([loadPlanungen(), loadGewerke()]);
      const p = findPlanung(planungen, params.project);
      if (!p) {
        return fail(
          `No Crewplanung matches "${params.project}". Run nova_list_projects for the available projects.`,
        );
      }

      const gid = resolveGewerkId(p, gewerke, params.gewerk);
      if (!gid || !Array.isArray(p.crew?.[gid])) {
        return fail(
          `Project "${p.name}" has no Gewerk "${params.gewerk}". Available: ${gewerkOptions(p, gewerke)}.`,
        );
      }
      const members = p.crew[gid];

      let idx: number;
      if (params.index !== undefined) {
        if (params.index >= members.length) {
          return fail(
            `Gewerk "${gewerkName(gewerke, gid)}" has ${members.length} rows, so index ${params.index} is out of range.`,
          );
        }
        idx = params.index;
      } else {
        const hits = members
          .map((m, i) => ({ m, i }))
          .filter(({ m }) => matches(m.name ?? "", params.name as string));
        if (!hits.length) {
          return fail(
            `No one named like "${params.name}" in Gewerk "${gewerkName(gewerke, gid)}" of "${p.name}".`,
          );
        }
        if (hits.length > 1) {
          const list = hits.map((h) => `[${h.i}] ${h.m.name}`).join(", ");
          return fail(
            `"${params.name}" matches ${hits.length} rows: ${list}. Retry with 'index'.`,
          );
        }
        idx = hits[0].i;
      }

      const before = statusOf(members[idx]);
      if (before === params.status) {
        return ok(
          params.response_format,
          {
            projekt: p.name,
            gewerk: gewerkName(gewerke, gid),
            index: idx,
            name: members[idx].name ?? "",
            status_vorher: before,
            status_nachher: before,
            backup_key: null,
            unchanged: true,
          },
          () =>
            `**${members[idx].name}** steht bereits auf "${before}" — nichts geändert.`,
        );
      }

      await snapshotBeforeWrite(KEYS.planungen);
      members[idx].status = params.status;
      await setKey(KEYS.planungen, planungen);

      const structured = {
        projekt: p.name,
        gewerk: gewerkName(gewerke, gid),
        index: idx,
        name: members[idx].name ?? "",
        status_vorher: before,
        status_nachher: params.status,
        backup_key: KEYS.mcpBackup,
      };
      return ok(
        params.response_format,
        structured,
        () =>
          `✓ **${structured.name}** (${structured.gewerk}, ${structured.projekt}): ${before} → ${params.status}\n\n_Vorheriger Stand liegt unter \`${KEYS.mcpBackup}\`._`,
      );
    }),
  );

  server.registerTool(
    "nova_add_crew_member",
    {
      title: "Person zur Crewplanung hinzufügen",
      description: `Add a person to a Gewerk of a Crewplanung, appended at the end of that Gewerk's list.

Requires NOVA_ALLOW_WRITE=1. Creates the Gewerk entry in the project if it does not exist yet.

Args:
  - project (string): project id or name
  - gewerk (string): Gewerk id or name
  - name (string): the person's name as it should appear
  - funktion (string, optional): role, e.g. "Ton FOH"
  - tel (string, optional), email (string, optional), notiz (string, optional)
  - status ('angefragt'|'bestaetigt'|'abgesagt'): default 'angefragt'
  - phasen (array, optional): subset of ["aufbau","proben","show","abbau"]; omit to leave unset,
    which the UI reads as "needed for the whole project"
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  { "projekt","gewerk","index","member": {...},"backup_key" }

Examples:
  - "Setz Kilian als Ton FOH auf die Show" -> project=..., gewerk="ton", name="Kilian Koeth",
    funktion="Ton FOH", phasen=["show"]

Error Handling:
  - Warns instead of adding when someone with the same name is already in that Gewerk.
  - Refuses with an explanation when writing is disabled.`,
      inputSchema: {
        project: z.string().min(1).describe("Project id or name"),
        gewerk: z.string().min(1).describe("Gewerk id or name"),
        name: z.string().min(1).describe("Person name"),
        funktion: z.string().default("").describe("Role within the Gewerk"),
        tel: z.string().default("").describe("Phone number"),
        email: z.string().default("").describe("Email address"),
        notiz: z.string().default("").describe("Free-text note"),
        status: z.enum(STATUS_VALUES).default("angefragt").describe("Initial status"),
        phasen: z
          .array(z.enum(PHASES))
          .optional()
          .describe("Phases the person is booked for; omit for the whole project"),
        response_format: responseFormatSchema,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    guard(async (params: {
      project: string;
      gewerk: string;
      name: string;
      funktion: string;
      tel: string;
      email: string;
      notiz: string;
      status: (typeof STATUS_VALUES)[number];
      phasen?: Phase[];
      response_format: ResponseFormat;
    }) => {
      if (!ALLOW_WRITE) return fail(WRITE_DISABLED);

      const [planungen, gewerke] = await Promise.all([loadPlanungen(), loadGewerke()]);
      const p = findPlanung(planungen, params.project);
      if (!p) {
        return fail(
          `No Crewplanung matches "${params.project}". Run nova_list_projects for the available projects.`,
        );
      }

      const gid = resolveGewerkId(p, gewerke, params.gewerk);
      if (!gid) {
        return fail(
          `Unknown Gewerk "${params.gewerk}". Known Gewerke: ${gewerke.map((g) => `${g.name} (${g.id})`).join(", ")}.`,
        );
      }

      if (!p.crew) p.crew = {};
      if (!Array.isArray(p.crew[gid])) p.crew[gid] = [];

      const duplicate = p.crew[gid].find((m) => matches(m.name ?? "", params.name));
      if (duplicate) {
        return fail(
          `"${duplicate.name}" is already listed in Gewerk "${gewerkName(gewerke, gid)}" of "${p.name}". Use nova_set_crew_status to change that booking instead.`,
        );
      }

      const member: CrewMember = {
        name: params.name,
        funktion: params.funktion,
        tel: params.tel,
        email: params.email,
        notiz: params.notiz,
        status: params.status,
        ...(params.phasen?.length
          ? { phasen: Object.fromEntries(params.phasen.map((ph) => [ph, true])) }
          : {}),
      };

      await snapshotBeforeWrite(KEYS.planungen);
      p.crew[gid].push(member);
      await setKey(KEYS.planungen, planungen);

      const structured = {
        projekt: p.name,
        gewerk: gewerkName(gewerke, gid),
        index: p.crew[gid].length - 1,
        member,
        backup_key: KEYS.mcpBackup,
      };
      return ok(
        params.response_format,
        structured,
        () =>
          `✓ **${member.name}** zu ${structured.gewerk} (${structured.projekt}) hinzugefügt, Status "${member.status}".\n\n_Vorheriger Stand liegt unter \`${KEYS.mcpBackup}\`._`,
      );
    }),
  );
}
