/** Shared constants for the NOVA WORKS MCP server. */

/** Supabase project of the NOVA WORKS app. Override via env for a different project. */
export const SUPABASE_URL =
  process.env.NOVA_SUPABASE_URL ?? "https://ekfuzciwjsldpkojyzgg.supabase.co";

/**
 * Publishable ("anon") key. This is the same key the static HTML tools ship with —
 * it is public by design and constrained by the `nw_%` RLS policies in
 * supabase_rls_setup.sql. Never put a service-role key here.
 */
export const SUPABASE_KEY =
  process.env.NOVA_SUPABASE_KEY ?? "sb_publishable_53YU2qO5PwdFwhVuZSSyPg_pcdw2Dhk";

/** Writing tools stay disabled unless explicitly enabled. */
export const ALLOW_WRITE = process.env.NOVA_ALLOW_WRITE === "1";

/** Optional path to Crewplanung.html, used to read the built-in freelancer roster. */
export const CREWPLANUNG_HTML = process.env.NOVA_CREWPLANUNG_HTML ?? "";

/** Maximum characters in a single tool response before it gets truncated. */
export const CHARACTER_LIMIT = 25000;

/** Request timeout for Supabase calls, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 30000;

/** Well-known keys in the `app_data` key-value store. */
export const KEYS = {
  planungen: "nw_crew_planungen",
  techniker: "nw_crew_techniker",
  gewerke: "nw_crew_gewerke",
  /** Snapshot of the previous value, written before every mutating tool call. */
  mcpBackup: "nw_backup_mcp",
} as const;

/** Key prefixes for the per-event document tools. */
export const PREFIXES = {
  hotel: "nw_hotel_save_",
  hotelSync: "nw_hotel_sync_",
  bauzeit: "nw_bauzeit_save_",
  schichtplan: "nw_schichtplan_",
} as const;

/** The six built-in Gewerke, mirroring GEWERKE_BASE in Crewplanung.html. */
export const GEWERKE_BASE = [
  { id: "tl", name: "Technische Leitung", color: "#8a8a8a", cats: ["Technischer Leiter", "Projektleiter"] },
  { id: "licht", name: "Licht", color: "#4a7fb5", cats: ["Lichttechniker", "Licht OP", "Licht System"] },
  { id: "ton", name: "Ton", color: "#5a9e6f", cats: ["Tontechniker", "Ton FOH", "Ton Monitor", "Ton System", "Ton UHV"] },
  { id: "rigging", name: "Rigging", color: "#c0713a", cats: ["Head Rigger", "Rigger"] },
  { id: "av", name: "AV / Video", color: "#7c5cbf", cats: ["AV Techniker", "LED Techniker", "Medien Server OP", "Kamera"] },
  { id: "logistik", name: "Logistik", color: "#b5862a", cats: ["Logistik", "Transport", "Fahrer"] },
] as const;

/** Crew booking states, in the order the UI cycles through them. */
export const STATUS_VALUES = ["angefragt", "bestaetigt", "abgesagt"] as const;

/** The four project phases, in chronological order. */
export const PHASES = ["aufbau", "proben", "show", "abbau"] as const;
