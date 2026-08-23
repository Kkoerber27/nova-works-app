/** Type definitions mirroring the JSON shapes the NOVA WORKS HTML tools persist. */

import type { PHASES, STATUS_VALUES } from "./constants.js";

export type Phase = (typeof PHASES)[number];
export type CrewStatus = (typeof STATUS_VALUES)[number];

/** One booked person inside a Gewerk of a Planung. */
export interface CrewMember {
  name: string;
  funktion: string;
  tel: string;
  email: string;
  notiz: string;
  status?: CrewStatus;
  /** Which project phases this person is booked for. Absent means "not set". */
  phasen?: Partial<Record<Phase, boolean>>;
}

/**
 * One Crewplanung (project). Phase fields hold a date range encoded as
 * "YYYY-MM-DD/YYYY-MM-DD", or a single "YYYY-MM-DD", or "" when unset.
 */
export interface Planung {
  id: string;
  name: string;
  kunde: string;
  ort: string;
  aufbau: string;
  proben: string;
  show: string;
  abbau: string;
  datum: string;
  pl: string;
  notizen: string;
  /** Gewerk id -> crew list. */
  crew: Record<string, CrewMember[]>;
  collapsed?: Record<string, boolean>;
}

/** A trade/department. Custom ones live in `nw_crew_gewerke`. */
export interface Gewerk {
  id: string;
  name: string;
  color: string;
  cats: string[];
  _custom?: boolean;
}

/** A freelancer record. Short keys are the app's own storage format. */
export interface Techniker {
  /** Nachname */
  n: string;
  /** Vorname */
  v: string;
  /** Telefon */
  t: string;
  /** E-Mail */
  e: string;
  /** Primary category/qualification */
  k: string;
  /** All categories, when the record carries more than one */
  ks?: string[];
  _custom?: boolean;
}

/** One row of the Hotelplanung. */
export interface HotelRow {
  name: string;
  checkin1: string;
  checkout1: string;
  checkin2: string;
  checkout2: string;
  nights: number | string;
  zimmer: string;
  notiz: string;
  changed?: boolean;
}

export interface HotelState {
  eventName: string;
  rows: HotelRow[];
  savedAt: string;
}

export interface SchichtplanState {
  eventName: string;
  phases: Partial<Record<Phase, string>>;
  days: unknown;
  savedAt: string;
}

export interface BauzeitState {
  eventName: string;
  phases: Partial<Record<Phase, string>>;
  dayData: unknown;
  extraDays: unknown;
  savedAt: string;
}

/** A row of the `app_data` key-value table. */
export interface AppDataRow {
  key: string;
  value: unknown;
  updated_at: string;
}

/** A crew booking flattened out of its project, used by the cross-project tools. */
export interface CrewAssignment {
  projekt_id: string;
  projekt: string;
  kunde: string;
  ort: string;
  gewerk_id: string;
  gewerk: string;
  index: number;
  name: string;
  funktion: string;
  tel: string;
  email: string;
  notiz: string;
  status: CrewStatus;
  phasen: Phase[];
  von: string;
  bis: string;
}
