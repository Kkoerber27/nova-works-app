/** Cross-project crew tools: who is booked where, what is still open, who clashes. */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { STATUS_VALUES } from "../constants.js";
import {
  flattenAssignments,
  loadGewerke,
  loadPlanungen,
  matches,
  normalise,
  rangesOverlap,
} from "../services/domain.js";
import {
  assignmentLine,
  contactSuffix,
  deRange,
  fail,
  guard,
  limitSchema,
  offsetSchema,
  ok,
  paginate,
  ResponseFormat,
  responseFormatSchema,
} from "../services/format.js";
import { categoriesOf, fullName, loadRoster, rosterSourceAvailable } from "../services/roster.js";
import type { CrewAssignment } from "../types.js";

const statusSchema = z
  .enum(STATUS_VALUES)
  .optional()
  .describe("Filter by booking state: 'angefragt', 'bestaetigt' or 'abgesagt'");

export function registerCrewTools(server: McpServer): void {
  server.registerTool(
    "nova_search_crew",
    {
      title: "Crew-Buchungen durchsuchen",
      description: `Search every crew booking across all Crewplanungen at once — the tool for "where is person X booked?".

Each booking carries the date range the person is actually needed for: the ticked phases
when there are any, otherwise the whole project range.

Args:
  - name (string, optional): person name, partial and umlaut-insensitive
  - gewerk (string, optional): Gewerk id or name
  - status ('angefragt'|'bestaetigt'|'abgesagt', optional)
  - from (string, optional): ISO date; keeps bookings still running on or after it
  - to (string, optional): ISO date; keeps bookings starting on or before it
  - limit (number): 1-200, default 50
  - offset (number): default 0
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "total","count","offset","has_more",
    "bookings": [{
      "projekt_id","projekt","kunde","ort","gewerk_id","gewerk","index",
      "name","funktion","tel","email","notiz","status","phasen":[...],"von","bis"
    }]
  }

Examples:
  - "Wo ist Nico Beranek nächsten Monat gebucht?" -> name="Beranek", from/to for the month
  - "Alle bestätigten Rigger" -> gewerk="rigging", status="bestaetigt"
  - Don't use for the freelancer address book (use nova_search_technicians).`,
      inputSchema: {
        name: z.string().optional().describe("Person name, partial match"),
        gewerk: z.string().optional().describe("Gewerk id ('ton') or name ('Ton')"),
        status: statusSchema,
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format, e.g. 2026-03-01")
          .optional()
          .describe("ISO date lower bound"),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format, e.g. 2026-03-31")
          .optional()
          .describe("ISO date upper bound"),
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
      name?: string;
      gewerk?: string;
      status?: (typeof STATUS_VALUES)[number];
      from?: string;
      to?: string;
      limit: number;
      offset: number;
      response_format: ResponseFormat;
    }) => {
      const [planungen, gewerke] = await Promise.all([loadPlanungen(), loadGewerke()]);
      let bookings = flattenAssignments(planungen, gewerke);

      if (params.name) {
        const n = params.name;
        bookings = bookings.filter((a) => matches(a.name, n));
      }
      if (params.gewerk) {
        const g = params.gewerk;
        bookings = bookings.filter(
          (a) => a.gewerk_id === g || matches(a.gewerk, g) || matches(a.gewerk_id, g),
        );
      }
      if (params.status) {
        bookings = bookings.filter((a) => a.status === params.status);
      }
      if (params.from || params.to) {
        bookings = bookings.filter((a) => {
          if (!a.von || !a.bis) return false;
          if (params.from && a.bis < params.from) return false;
          if (params.to && a.von > params.to) return false;
          return true;
        });
      }

      if (!bookings.length) {
        return fail(
          `No crew bookings match those filters. Try nova_search_crew with fewer filters, or nova_list_projects to see what exists.`,
        );
      }

      bookings.sort((a, b) => (a.von || "9999").localeCompare(b.von || "9999"));
      const { page, total, has_more, next_offset } = paginate(
        bookings,
        params.limit,
        params.offset,
      );

      const structured = {
        total,
        count: page.length,
        offset: params.offset,
        has_more,
        ...(next_offset !== undefined ? { next_offset } : {}),
        bookings: page,
      };

      return ok(params.response_format, structured, () => {
        const lines = [`# Crew-Buchungen (${total} gefunden, ${page.length} angezeigt)`, ""];
        for (const a of page) lines.push(assignmentLine(a));
        if (has_more) lines.push("", `_Weitere Ergebnisse: offset=${next_offset}_`);
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "nova_staffing_gaps",
    {
      title: "Offene Positionen finden",
      description: `Find everything that is not confirmed yet: bookings still 'angefragt', people who cancelled, and rows with no name filled in.

This is the dispo check — "what still needs chasing before the show?".

Args:
  - project (string, optional): limit to one project, by id or name
  - from (string, optional): ISO date lower bound on the booking range
  - to (string, optional): ISO date upper bound on the booking range
  - include_abgesagt (boolean): also list cancelled bookings (default true)
  - limit (number): 1-200, default 50
  - offset (number): default 0
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "total","count","offset","has_more",
    "summary": { "angefragt": number, "abgesagt": number, "unbesetzt": number },
    "gaps": [{ ...booking fields..., "grund": "angefragt"|"abgesagt"|"unbesetzt" }]
  }
  "unbesetzt" means the row exists but carries no name — an open slot.

Examples:
  - "Was ist für die Automotive Show noch offen?" -> project="Automotive Show"
  - "Welche Anfragen laufen im März noch?" -> from="2026-03-01", to="2026-03-31"`,
      inputSchema: {
        project: z.string().optional().describe("Project id or name"),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format")
          .optional()
          .describe("ISO date lower bound"),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format")
          .optional()
          .describe("ISO date upper bound"),
        include_abgesagt: z
          .boolean()
          .default(true)
          .describe("Include cancelled bookings in the result"),
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
      project?: string;
      from?: string;
      to?: string;
      include_abgesagt: boolean;
      limit: number;
      offset: number;
      response_format: ResponseFormat;
    }) => {
      const [planungen, gewerke] = await Promise.all([loadPlanungen(), loadGewerke()]);
      let bookings = flattenAssignments(planungen, gewerke);

      if (params.project) {
        const q = params.project;
        bookings = bookings.filter(
          (a) => a.projekt_id === q || matches(a.projekt, q),
        );
        if (!bookings.length) {
          return fail(
            `No Crewplanung matches "${q}". Run nova_list_projects to see the available projects.`,
          );
        }
      }
      if (params.from || params.to) {
        bookings = bookings.filter((a) => {
          if (!a.von || !a.bis) return false;
          if (params.from && a.bis < params.from) return false;
          if (params.to && a.von > params.to) return false;
          return true;
        });
      }

      const gaps = bookings
        .map((a) => {
          const grund = !a.name.trim()
            ? "unbesetzt"
            : a.status === "angefragt"
              ? "angefragt"
              : a.status === "abgesagt"
                ? "abgesagt"
                : null;
          return grund ? { ...a, grund } : null;
        })
        .filter((x): x is CrewAssignment & { grund: string } => x !== null)
        .filter((x) => params.include_abgesagt || x.grund !== "abgesagt");

      const summary = {
        angefragt: gaps.filter((g) => g.grund === "angefragt").length,
        abgesagt: gaps.filter((g) => g.grund === "abgesagt").length,
        unbesetzt: gaps.filter((g) => g.grund === "unbesetzt").length,
      };

      if (!gaps.length) {
        return ok(
          params.response_format,
          { total: 0, count: 0, offset: 0, has_more: false, summary, gaps: [] },
          () => "# Offene Positionen\n\nAlles bestätigt — keine offenen Positionen im gewählten Ausschnitt.",
        );
      }

      gaps.sort((a, b) => (a.von || "9999").localeCompare(b.von || "9999"));
      const { page, total, has_more, next_offset } = paginate(
        gaps,
        params.limit,
        params.offset,
      );

      const structured = {
        total,
        count: page.length,
        offset: params.offset,
        has_more,
        ...(next_offset !== undefined ? { next_offset } : {}),
        summary,
        gaps: page,
      };

      return ok(params.response_format, structured, () => {
        const lines = [
          `# Offene Positionen (${total})`,
          "",
          `? ${summary.angefragt} angefragt · ✗ ${summary.abgesagt} abgesagt · ␣ ${summary.unbesetzt} unbesetzt`,
          "",
        ];
        for (const g of page) {
          const label = g.grund === "unbesetzt" ? "**(offene Position)**" : `**${g.name}**`;
          const bits = [label];
          if (g.funktion) bits.push(g.funktion);
          bits.push(`Projekt: ${g.projekt}`, `Gewerk: ${g.gewerk}`, `Status: ${g.grund}`);
          const range = deRange(g.von, g.bis);
          if (range) bits.push(range);
          lines.push(`- ${bits.join(" · ")}${contactSuffix(g.tel, g.email)}`);
        }
        if (has_more) lines.push("", `_Weitere Ergebnisse: offset=${next_offset}_`);
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "nova_find_conflicts",
    {
      title: "Doppelbuchungen finden",
      description: `Find people booked on two projects whose date ranges overlap.

Compares every pair of bookings that share a person name. Cancelled bookings ('abgesagt')
are ignored, since they no longer occupy the person.

Args:
  - project (string, optional): only report conflicts touching this project
  - from (string, optional): ISO date lower bound
  - to (string, optional): ISO date upper bound
  - confirmed_only (boolean): only count 'bestaetigt' bookings (default false)
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "total": number,
    "conflicts": [{
      "name": string,
      "ueberschneidung": { "von": string, "bis": string },
      "buchungen": [{ "projekt","projekt_id","gewerk","status","von","bis" }, ...]
    }]
  }

Examples:
  - "Ist jemand doppelt verplant?" -> no arguments
  - "Kollidiert bei der Automotive Show jemand?" -> project="Automotive Show"

Note: matching is by name, so two different people with the same name would show as a conflict.`,
      inputSchema: {
        project: z.string().optional().describe("Project id or name"),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format")
          .optional()
          .describe("ISO date lower bound"),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Use ISO format")
          .optional()
          .describe("ISO date upper bound"),
        confirmed_only: z
          .boolean()
          .default(false)
          .describe("Only consider bookings with status 'bestaetigt'"),
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
      project?: string;
      from?: string;
      to?: string;
      confirmed_only: boolean;
      response_format: ResponseFormat;
    }) => {
      const [planungen, gewerke] = await Promise.all([loadPlanungen(), loadGewerke()]);
      let bookings = flattenAssignments(planungen, gewerke)
        .filter((a) => a.status !== "abgesagt")
        .filter((a) => a.name.trim() !== "")
        .filter((a) => a.von && a.bis);

      if (params.confirmed_only) {
        bookings = bookings.filter((a) => a.status === "bestaetigt");
      }
      if (params.from || params.to) {
        bookings = bookings.filter((a) => {
          if (params.from && a.bis < params.from) return false;
          if (params.to && a.von > params.to) return false;
          return true;
        });
      }

      const byPerson = new Map<string, CrewAssignment[]>();
      for (const a of bookings) {
        const key = normalise(a.name);
        const list = byPerson.get(key) ?? [];
        list.push(a);
        byPerson.set(key, list);
      }

      const conflicts: Array<{
        name: string;
        ueberschneidung: { von: string; bis: string };
        buchungen: Array<Record<string, string>>;
      }> = [];

      for (const list of byPerson.values()) {
        if (list.length < 2) continue;
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            if (a.projekt_id === b.projekt_id) continue;
            if (!rangesOverlap(a, b)) continue;
            if (
              params.project &&
              !(
                a.projekt_id === params.project ||
                b.projekt_id === params.project ||
                matches(a.projekt, params.project) ||
                matches(b.projekt, params.project)
              )
            ) {
              continue;
            }
            conflicts.push({
              name: a.name,
              ueberschneidung: {
                von: a.von > b.von ? a.von : b.von,
                bis: a.bis < b.bis ? a.bis : b.bis,
              },
              buchungen: [a, b].map((x) => ({
                projekt: x.projekt,
                projekt_id: x.projekt_id,
                gewerk: x.gewerk,
                status: x.status,
                von: x.von,
                bis: x.bis,
              })),
            });
          }
        }
      }

      conflicts.sort((a, b) => a.ueberschneidung.von.localeCompare(b.ueberschneidung.von));
      const structured = { total: conflicts.length, conflicts };

      return ok(params.response_format, structured, () => {
        if (!conflicts.length) {
          return "# Doppelbuchungen\n\nKeine Überschneidungen gefunden.";
        }
        const lines = [`# Doppelbuchungen (${conflicts.length})`, ""];
        for (const c of conflicts) {
          lines.push(
            `## ${c.name} — überschneidet sich ${deRange(c.ueberschneidung.von, c.ueberschneidung.bis)}`,
          );
          for (const b of c.buchungen) {
            lines.push(
              `- ${b.projekt} · ${b.gewerk} · ${b.status} · ${deRange(b.von, b.bis)}`,
            );
          }
          lines.push("");
        }
        return lines.join("\n");
      });
    }),
  );

  server.registerTool(
    "nova_search_technicians",
    {
      title: "Freelancer-Datenbank durchsuchen",
      description: `Search the freelancer address book: name, phone, email and qualification.

Combines two sources: the built-in roster embedded in Crewplanung.html and the technicians
added through the app (stored in Supabase under 'nw_crew_techniker'). Custom entries win
when a person appears in both.

Args:
  - query (string, optional): matches surname, first name or email
  - kategorie (string, optional): qualification, e.g. "Rigger", "Tontechniker", "AV Techniker"
  - limit (number): 1-200, default 50
  - offset (number): default 0
  - response_format ('markdown' | 'json'): default 'markdown'

Returns (json):
  {
    "total","count","offset","has_more",
    "technicians": [{ "name","nachname","vorname","telefon","email","kategorien":[...],"custom":boolean }]
  }

Examples:
  - "Welche Rigger haben wir?" -> kategorie="Rigger"
  - "Wie erreiche ich Stefan Große?" -> query="Große"
  - Don't use to see who is booked on a project (use nova_search_crew).

Error Handling:
  - Says so explicitly if the built-in roster could not be read, which happens when
    the server runs outside the repo; set NOVA_CREWPLANUNG_HTML to the file path.`,
      inputSchema: {
        query: z.string().optional().describe("Name or email fragment"),
        kategorie: z.string().optional().describe("Qualification / Kategorie"),
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
      query?: string;
      kategorie?: string;
      limit: number;
      offset: number;
      response_format: ResponseFormat;
    }) => {
      const roster = await loadRoster();
      if (!roster.length) {
        const hasBuiltIn = await rosterSourceAvailable();
        return fail(
          hasBuiltIn
            ? "The roster is empty."
            : "Could not read the built-in roster from Crewplanung.html, and Supabase holds no custom technicians. Set NOVA_CREWPLANUNG_HTML to the absolute path of Crewplanung.html.",
        );
      }

      let people = roster;
      if (params.query) {
        const q = params.query;
        people = people.filter(
          (t) => matches(t.n ?? "", q) || matches(t.v ?? "", q) || matches(t.e ?? "", q),
        );
      }
      if (params.kategorie) {
        const k = params.kategorie;
        people = people.filter((t) => categoriesOf(t).some((c) => matches(c, k)));
      }

      if (!people.length) {
        const known = [...new Set(roster.flatMap(categoriesOf))].sort();
        return fail(
          `No technician matches those filters. Known Kategorien: ${known.join(", ")}.`,
        );
      }

      people = [...people].sort((a, b) => (a.n ?? "").localeCompare(b.n ?? "", "de"));
      const { page, total, has_more, next_offset } = paginate(
        people,
        params.limit,
        params.offset,
      );

      const technicians = page.map((t) => ({
        name: fullName(t),
        nachname: t.n ?? "",
        vorname: t.v ?? "",
        telefon: t.t ?? "",
        email: t.e ?? "",
        kategorien: categoriesOf(t),
        custom: t._custom === true,
      }));

      const structured = {
        total,
        count: technicians.length,
        offset: params.offset,
        has_more,
        ...(next_offset !== undefined ? { next_offset } : {}),
        technicians,
      };

      return ok(params.response_format, structured, () => {
        const lines = [`# Freelancer (${total} gefunden, ${technicians.length} angezeigt)`, ""];
        for (const t of technicians) {
          lines.push(
            `- **${t.name}** · ${t.kategorien.join(", ") || "—"}${contactSuffix(t.telefon, t.email)}`,
          );
        }
        if (has_more) lines.push("", `_Weitere Ergebnisse: offset=${next_offset}_`);
        return lines.join("\n");
      });
    }),
  );
}
