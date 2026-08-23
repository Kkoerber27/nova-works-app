/**
 * Domain helpers shared by the tools: loading the core documents, flattening
 * crew bookings out of projects, and reasoning about the phase date ranges.
 */

import { GEWERKE_BASE, KEYS, PHASES, STATUS_VALUES } from "../constants.js";
import type {
  CrewAssignment,
  CrewMember,
  CrewStatus,
  Gewerk,
  Phase,
  Planung,
  Techniker,
} from "../types.js";
import { getKey } from "./supabase.js";

/** Load all Crewplanungen. Returns an empty list when nothing is stored yet. */
export async function loadPlanungen(): Promise<Planung[]> {
  const raw = await getKey<Planung[]>(KEYS.planungen);
  return Array.isArray(raw) ? raw : [];
}

/** Load the effective Gewerk list: the six built-ins plus any custom ones. */
export async function loadGewerke(): Promise<Gewerk[]> {
  const custom = await getKey<Gewerk[]>(KEYS.gewerke);
  const base = GEWERKE_BASE.map((g) => ({ ...g, cats: [...g.cats] })) as Gewerk[];
  if (!Array.isArray(custom)) return base;
  return [...base, ...custom.map((g) => ({ ...g, _custom: true }))];
}

/** Load the technicians added through the app's own Techniker-DB. */
export async function loadCustomTechniker(): Promise<Techniker[]> {
  const raw = await getKey<Techniker[]>(KEYS.techniker);
  return Array.isArray(raw) ? raw.map((t) => ({ ...t, _custom: true })) : [];
}

/** Resolve a Gewerk id to its display name, falling back to the raw id. */
export function gewerkName(gewerke: Gewerk[], id: string): string {
  return gewerke.find((g) => g.id === id)?.name ?? id;
}

/** Start date of a phase string ("YYYY-MM-DD/YYYY-MM-DD" or a single date). */
export function phaseStart(value: string | undefined): string {
  return value ? value.split("/")[0].trim() : "";
}

/** End date of a phase string; falls back to the start for single-day phases. */
export function phaseEnd(value: string | undefined): string {
  if (!value) return "";
  const parts = value.split("/");
  const end = parts.length > 1 ? parts[1].trim() : "";
  return end || phaseStart(value);
}

/** Overall date range a project spans, across all four phases. */
export function projectRange(p: Planung): { von: string; bis: string } {
  const starts: string[] = [];
  const ends: string[] = [];
  for (const ph of PHASES) {
    const s = phaseStart(p[ph]);
    const e = phaseEnd(p[ph]);
    if (s) starts.push(s);
    if (e) ends.push(e);
  }
  if (!starts.length) return { von: "", bis: "" };
  starts.sort();
  ends.sort();
  return { von: starts[0], bis: ends[ends.length - 1] };
}

/** The phases a crew member is flagged for. Empty means no phase was ticked. */
export function memberPhases(member: CrewMember): Phase[] {
  if (!member.phasen) return [];
  return PHASES.filter((ph) => member.phasen?.[ph] === true);
}

/**
 * Date range a person is actually needed for. Uses the ticked phases when there
 * are any, otherwise the full project range — matching how the UI reads a row
 * with no phase dots set.
 */
export function memberRange(p: Planung, member: CrewMember): { von: string; bis: string } {
  const phases = memberPhases(member);
  if (!phases.length) return projectRange(p);
  const starts = phases.map((ph) => phaseStart(p[ph])).filter(Boolean).sort();
  const ends = phases.map((ph) => phaseEnd(p[ph])).filter(Boolean).sort();
  if (!starts.length) return projectRange(p);
  return { von: starts[0], bis: ends[ends.length - 1] };
}

/** Inclusive overlap test for two ISO date ranges. Unknown ranges never overlap. */
export function rangesOverlap(
  a: { von: string; bis: string },
  b: { von: string; bis: string },
): boolean {
  if (!a.von || !a.bis || !b.von || !b.bis) return false;
  return a.von <= b.bis && b.von <= a.bis;
}

/** Normalise a possibly missing status to the value the UI would show. */
export function statusOf(member: CrewMember): CrewStatus {
  const s = member.status;
  return s && (STATUS_VALUES as readonly string[]).includes(s) ? s : "angefragt";
}

/** Flatten every crew booking of every project into one comparable list. */
export function flattenAssignments(
  planungen: Planung[],
  gewerke: Gewerk[],
): CrewAssignment[] {
  const out: CrewAssignment[] = [];
  for (const p of planungen) {
    for (const [gid, members] of Object.entries(p.crew ?? {})) {
      if (!Array.isArray(members)) continue;
      members.forEach((m, index) => {
        const range = memberRange(p, m);
        out.push({
          projekt_id: p.id,
          projekt: p.name ?? "",
          kunde: p.kunde ?? "",
          ort: p.ort ?? "",
          gewerk_id: gid,
          gewerk: gewerkName(gewerke, gid),
          index,
          name: m.name ?? "",
          funktion: m.funktion ?? "",
          tel: m.tel ?? "",
          email: m.email ?? "",
          notiz: m.notiz ?? "",
          status: statusOf(m),
          phasen: memberPhases(m),
          von: range.von,
          bis: range.bis,
        });
      });
    }
  }
  return out;
}

/** Case- and umlaut-tolerant containment test used by all search tools. */
export function matches(haystack: string, needle: string): boolean {
  return normalise(haystack).includes(normalise(needle));
}

/** Lowercase, strip diacritics, and fold ß so "Große" matches "grosse". */
export function normalise(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Find a project by exact id, else by exact name, else by partial name. */
export function findPlanung(planungen: Planung[], idOrName: string): Planung | undefined {
  return (
    planungen.find((p) => p.id === idOrName) ??
    planungen.find((p) => normalise(p.name) === normalise(idOrName)) ??
    planungen.find((p) => matches(p.name ?? "", idOrName))
  );
}

/** Count bookings per status for a project. */
export function statusCounts(p: Planung): Record<CrewStatus, number> {
  const counts: Record<CrewStatus, number> = { angefragt: 0, bestaetigt: 0, abgesagt: 0 };
  for (const members of Object.values(p.crew ?? {})) {
    if (!Array.isArray(members)) continue;
    for (const m of members) counts[statusOf(m)] += 1;
  }
  return counts;
}
