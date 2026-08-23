/** Tools for browsing the Crewplanungen (projects). */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { PHASES } from "../constants.js";
import {
  findPlanung,
  flattenAssignments,
  loadGewerke,
  loadPlanungen,
  matches,
  phaseEnd,
  phaseStart,
  projectRange,
  statusCounts,
} from "../services/domain.js";
import {
  deRange,
  guard,
  limitSchema,
  offsetSchema,
  ok,
  fail,
  paginate,
  responseFormatSchema,
  ResponseFormat,
  contactSuffix,
} from "../services/format.js";

const listInput = {
  query: z
    .string()
    .optional()
    .describe("Filter on project name, customer (Kunde) or location (Ort)"),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format, e.g. 2026-03-01")
    .optional()
    .describe("Only projects that are still running on or after this date"),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format, e.g. 2026-03-31")
    .optional()
    .describe("Only projects that start on or before this date"),
  limit: limitSchema,
  offset: offsetSchema,
  response_format: responseFormatSchema,
};

const getInput = {
  project: z
    .string()
    .min(1)
    .describe("Project id (e.g. 'p_1712345678901') or project name; partial names work"),
  gewerk: z
    .string()
    .optional()
    .describe("Restrict the crew list to one Gewerk, by id ('licht') or name ('Licht')"),
  response_format: responseFormatSchema,
};

export function registerProjectTools(server: McpServer): void {
  server.registerTool(
    "nova_list_projects",
    {
      title: "Crewplanungen auflisten",
      description: `List the NOVA WORKS Crewplanungen (projects) with their date ranges and booking counts.

Reads the 'nw_crew_planungen' document from Supabase. Use this first to find a project id
for nova_get_project, or to get an overview of what is running in a period.

Args:
  - query (string, optional): matches project name, Kunde or Ort, case- and umlaut-insensitive
  - from (string, optional): ISO date; keeps projects still running on or after it
  - to (string, optional): ISO date; keeps projects starting on or before it
  - limit (number): 1-200, default 50
  - offset (number): default 0
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "total": number, "count": number, "offset": number, "has_more": boolean,
    "projects": [{
      "id": string, "name": string, "kunde": string, "ort": string,
      "projektleitung": string, "von": string, "bis": string,
      "phasen": { "aufbau": {"von","bis"}, "proben": ..., "show": ..., "abbau": ... },
      "crew_gesamt": number,
      "status": { "angefragt": number, "bestaetigt": number, "abgesagt": number }
    }]
  }

Examples:
  - "Welche Projekte laufen im März?" -> from="2026-03-01", to="2026-03-31"
  - "Zeig mir alles für Kunde Siemens" -> query="Siemens"
  - Don't use when you need the crew of one project (use nova_get_project).`,
      inputSchema: listInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: {
      query?: string;
      from?: string;
      to?: string;
      limit: number;
      offset: number;
      response_format: ResponseFormat;
    }) => {
      const planungen = await loadPlanungen();
      if (!planungen.length) {
        return fail(
          "No Crewplanungen stored yet (key 'nw_crew_planungen' is empty or missing). Create one in Crewplanung.html first.",
        );
      }

      let filtered = planungen;
      if (params.query) {
        const q = params.query;
        filtered = filtered.filter(
          (p) =>
            matches(p.name ?? "", q) ||
            matches(p.kunde ?? "", q) ||
            matches(p.ort ?? "", q),
        );
      }
      if (params.from || params.to) {
        filtered = filtered.filter((p) => {
          const { von, bis } = projectRange(p);
          if (!von || !bis) return false;
          if (params.from && bis < params.from) return false;
          if (params.to && von > params.to) return false;
          return true;
        });
      }

      const sorted = [...filtered].sort((a, b) => {
        const av = projectRange(a).von || "9999-12-31";
        const bv = projectRange(b).von || "9999-12-31";
        return av.localeCompare(bv);
      });

      const { page, total, has_more, next_offset } = paginate(
        sorted,
        params.limit,
        params.offset,
      );

      const projects = page.map((p) => {
        const range = projectRange(p);
        const counts = statusCounts(p);
        return {
          id: p.id,
          name: p.name ?? "",
          kunde: p.kunde ?? "",
          ort: p.ort ?? "",
          projektleitung: p.pl ?? "",
          von: range.von,
          bis: range.bis,
          phasen: Object.fromEntries(
            PHASES.map((ph) => [ph, { von: phaseStart(p[ph]), bis: phaseEnd(p[ph]) }]),
          ),
          crew_gesamt: counts.angefragt + counts.bestaetigt + counts.abgesagt,
          status: counts,
        };
      });

      const structured = {
        total,
        count: projects.length,
        offset: params.offset,
        has_more,
        ...(next_offset !== undefined ? { next_offset } : {}),
        projects,
      };

      return ok(params.response_format, structured, () => {
        const lines = [
          `# Crewplanungen (${total} gefunden, ${projects.length} angezeigt)`,
          "",
        ];
        for (const p of projects) {
          lines.push(`## ${p.name || "(ohne Namen)"}  \`${p.id}\``);
          const meta = [p.kunde, p.ort].filter(Boolean).join(" · ");
          if (meta) lines.push(`${meta}`);
          const range = deRange(p.von, p.bis);
          if (range) lines.push(`Zeitraum: ${range}`);
          if (p.projektleitung) lines.push(`PL: ${p.projektleitung}`);
          lines.push(
            `Crew: ${p.crew_gesamt} (✓ ${p.status.bestaetigt} bestätigt · ? ${p.status.angefragt} angefragt · ✗ ${p.status.abgesagt} abgesagt)`,
          );
          lines.push("");
        }
        if (has_more) {
          lines.push(`_Weitere Ergebnisse: offset=${next_offset}_`);
        }
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "nova_get_project",
    {
      title: "Crewplanung im Detail",
      description: `Get one Crewplanung in full: phases, project metadata and the complete crew list per Gewerk.

Args:
  - project (string): project id or (partial) name. Exact id wins, then exact name, then partial.
  - gewerk (string, optional): restrict the crew list to one Gewerk, by id or name
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "id","name","kunde","ort","projektleitung","notizen","von","bis",
    "phasen": { "aufbau": {"von","bis"}, ... },
    "status": {"angefragt","bestaetigt","abgesagt"},
    "crew": [{
      "gewerk_id","gewerk","index","name","funktion","tel","email","notiz",
      "status","phasen":[...],"von","bis"
    }]
  }
  The "index" is the position inside its Gewerk and is what the write tools address.

Examples:
  - "Wer ist auf der Automotive Show gebucht?" -> project="Automotive Show"
  - "Zeig nur das Rigging von p_1712345678901" -> project="p_1712345678901", gewerk="rigging"

Error Handling:
  - Returns an error naming nova_list_projects when no project matches.`,
      inputSchema: getInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    guard(async (params: {
      project: string;
      gewerk?: string;
      response_format: ResponseFormat;
    }) => {
      const [planungen, gewerke] = await Promise.all([loadPlanungen(), loadGewerke()]);
      const p = findPlanung(planungen, params.project);
      if (!p) {
        return fail(
          `No Crewplanung matches "${params.project}". Run nova_list_projects to see the available projects and their ids.`,
        );
      }

      let crew = flattenAssignments([p], gewerke);
      if (params.gewerk) {
        const g = params.gewerk;
        crew = crew.filter(
          (a) => a.gewerk_id === g || matches(a.gewerk, g) || matches(a.gewerk_id, g),
        );
        if (!crew.length) {
          const available = [
            ...new Set(flattenAssignments([p], gewerke).map((a) => `${a.gewerk} (${a.gewerk_id})`)),
          ];
          return fail(
            `Project "${p.name}" has no crew under Gewerk "${g}". Gewerke with bookings here: ${available.join(", ") || "none"}.`,
          );
        }
      }

      const range = projectRange(p);
      const structured = {
        id: p.id,
        name: p.name ?? "",
        kunde: p.kunde ?? "",
        ort: p.ort ?? "",
        projektleitung: p.pl ?? "",
        notizen: p.notizen ?? "",
        von: range.von,
        bis: range.bis,
        phasen: Object.fromEntries(
          PHASES.map((ph) => [ph, { von: phaseStart(p[ph]), bis: phaseEnd(p[ph]) }]),
        ),
        status: statusCounts(p),
        crew,
      };

      return ok(params.response_format, structured, () => {
        const lines = [`# ${p.name || "(ohne Namen)"}  \`${p.id}\``, ""];
        const meta = [p.kunde, p.ort].filter(Boolean).join(" · ");
        if (meta) lines.push(meta);
        if (p.pl) lines.push(`Projektleitung: ${p.pl}`);
        lines.push("");
        lines.push("## Phasen");
        for (const ph of PHASES) {
          const r = deRange(phaseStart(p[ph]), phaseEnd(p[ph]));
          lines.push(`- **${ph}**: ${r || "—"}`);
        }
        lines.push("");
        lines.push(`## Crew (${crew.length})`);
        const byGewerk = new Map<string, typeof crew>();
        for (const a of crew) {
          const list = byGewerk.get(a.gewerk) ?? [];
          list.push(a);
          byGewerk.set(a.gewerk, list);
        }
        for (const [name, members] of byGewerk) {
          lines.push("");
          lines.push(`### ${name} (${members.length})`);
          for (const m of members) {
            const mark =
              m.status === "bestaetigt" ? "✓" : m.status === "abgesagt" ? "✗" : "?";
            const bits = [`${mark} **${m.name || "(ohne Namen)"}**`];
            if (m.funktion) bits.push(m.funktion);
            if (m.phasen.length) bits.push(m.phasen.join(", "));
            lines.push(
              `- [${m.index}] ${bits.join(" · ")}${contactSuffix(m.tel, m.email)}`,
            );
            if (m.notiz) lines.push(`  - Notiz: ${m.notiz}`);
          }
        }
        if (p.notizen) {
          lines.push("", "## Notizen", p.notizen);
        }
        return lines.join("\n");
      });
    }),
  );
}
