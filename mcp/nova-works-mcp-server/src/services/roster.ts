/**
 * The built-in freelancer roster lives as a `const DB = [...]` literal inside
 * Crewplanung.html rather than in Supabase, so it is read straight from the file.
 * Technicians added through the app itself come from Supabase and are merged in.
 */

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CREWPLANUNG_HTML } from "../constants.js";
import type { Techniker } from "../types.js";
import { loadCustomTechniker } from "./domain.js";

/** dist/services/roster.js -> repo root is four levels up. */
const DEFAULT_HTML = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../Crewplanung.html",
);

let cache: Techniker[] | null = null;

/** Parse the `const DB = [ ... ];` array out of Crewplanung.html. */
async function readBuiltInRoster(): Promise<Techniker[]> {
  if (cache) return cache;
  const path = CREWPLANUNG_HTML || DEFAULT_HTML;
  let html: string;
  try {
    html = await readFile(path, "utf8");
  } catch {
    cache = [];
    return cache;
  }
  const start = html.indexOf("const DB = [");
  if (start === -1) {
    cache = [];
    return cache;
  }
  const open = html.indexOf("[", start);
  const end = findArrayEnd(html, open);
  if (end === -1) {
    cache = [];
    return cache;
  }
  try {
    cache = JSON.parse(html.slice(open, end + 1)) as Techniker[];
  } catch {
    cache = [];
  }
  return cache;
}

/** Walk to the bracket closing the array at `open`, ignoring brackets in strings. */
function findArrayEnd(text: string, open: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * The full roster: the built-in list from the HTML plus the custom technicians
 * stored in Supabase. Custom entries win when the same person appears in both.
 */
export async function loadRoster(): Promise<Techniker[]> {
  const [builtIn, custom] = await Promise.all([
    readBuiltInRoster(),
    loadCustomTechniker(),
  ]);
  const byPerson = new Map<string, Techniker>();
  for (const t of builtIn) byPerson.set(personKey(t), t);
  for (const t of custom) byPerson.set(personKey(t), t);
  return [...byPerson.values()];
}

/** Whether the built-in roster could be read; used to explain empty results. */
export async function rosterSourceAvailable(): Promise<boolean> {
  return (await readBuiltInRoster()).length > 0;
}

function personKey(t: Techniker): string {
  return `${(t.n ?? "").toLowerCase()}|${(t.v ?? "").toLowerCase()}`;
}

/** All categories a technician is listed under. */
export function categoriesOf(t: Techniker): string[] {
  if (Array.isArray(t.ks) && t.ks.length) return t.ks.filter(Boolean);
  return t.k ? [t.k] : [];
}

/** "Vorname Nachname", trimmed. */
export function fullName(t: Techniker): string {
  return `${t.v ?? ""} ${t.n ?? ""}`.trim();
}
