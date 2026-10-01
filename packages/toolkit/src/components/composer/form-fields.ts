import type { FieldDefinition } from "../../lib/form-state"
import type { GeoJSONPoint } from "../../lib/geo"

/**
 * Die Felder des Formulars (shared-components → Formularzustand, Regel 5):
 * Jede Definition sagt, welche Datenschlüssel einem Feld gehören und wie es
 * sie liest und schreibt. Ein Feld schreibt nie fremde Schlüssel — der
 * Formularzustand filtert, was die Definition nicht nennt.
 */

type Data = Record<string, unknown>

/** Ein Feld mit genau einem Schlüssel. */
export function scalarField<V>(key: string, label: string, read: (raw: unknown) => V, options: { locked?: boolean } = {}): FieldDefinition<V> {
  return {
    label,
    keys: [key],
    read: (data) => read(data[key]),
    write: (next) => ({ [key]: next }),
    ...(options.locked ? { locked: true } : {}),
  }
}

export const asString = (raw: unknown): string => (typeof raw === "string" ? raw : "")
const NO_STRINGS = Object.freeze([]) as unknown as string[]
/**
 * Eine Liste von Strings. Stabil: Ist der gespeicherte Wert schon eine,
 * kommt er unverändert zurück — Widgets hängen Effekte an den Wert.
 */
export const asStrings = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? raw.every((v) => typeof v === "string")
      ? (raw as string[])
      : raw.filter((v): v is string => typeof v === "string")
    : NO_STRINGS

/** Ein Feld mit einem Verweis (B15): im Widget eine Liste mit höchstens einem Ziel. */
export function itemRefField(key: string, label: string): FieldDefinition<string[]> {
  return {
    label,
    keys: [key],
    read: (data) => (typeof data[key] === "string" && data[key] !== "" ? [data[key] as string] : []),
    write: (next) => ({ [key]: next[0] ?? "" }),
  }
}

/** Der Wert des Ort-Felds (B4): Adresse und Position ODER ein Ort-Item. */
export interface LocationValue {
  address?: string
  position?: GeoJSONPoint
  locationName?: string
  /** Targets der Ort-Kante (`locatedAt`); leer ohne Ort-Item. */
  place: readonly string[]
}

/** Das Ort-Feld; `placeKey` ist der Datenschlüssel der Ort-Kante, wenn der Typ eine führt. */
export function locationField(label: string, placeKey?: string): FieldDefinition<LocationValue> {
  return {
    label,
    keys: ["address", "position", "locationName", ...(placeKey ? [placeKey] : [])],
    read: (data) => ({
      address: typeof data.address === "string" ? data.address : undefined,
      position: data.position as GeoJSONPoint | undefined,
      locationName: typeof data.locationName === "string" ? data.locationName : undefined,
      place: placeKey ? asStrings(data[placeKey]) : [],
    }),
    write: (next) => ({
      address: next.address || undefined,
      position: next.position,
      locationName: next.locationName || undefined,
      ...(placeKey ? { [placeKey]: [...next.place] } : {}),
    }),
  }
}

/** Der Wert eines Personenfelds: Personen, Qualifier je Person, Änderungen an Aussagen. */
export interface PeopleValue {
  people: string[]
  qualifiers: Record<string, string>
  changes: Record<string, string | null>
}

export function peopleField(label: string, keys: { people: string; qualifiers: string; changes: string }): FieldDefinition<PeopleValue> {
  const record = <T>(raw: unknown): Record<string, T> => (raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, T>) : {})
  return {
    label,
    keys: [keys.people, keys.qualifiers, keys.changes],
    read: (data) => ({
      people: asStrings(data[keys.people]),
      qualifiers: record<string>(data[keys.qualifiers]),
      changes: record<string | null>(data[keys.changes]),
    }),
    write: (next) => ({ [keys.people]: next.people, [keys.qualifiers]: next.qualifiers, [keys.changes]: next.changes }),
  }
}

/** Eine eingehende Kante („Braucht"): die Änderungen gegen die live gelesenen Quellen. */
export interface IncomingValue {
  added: string[]
  removed: string[]
}

export function incomingField(label: string, keys: { added: string; removed: string }): FieldDefinition<IncomingValue> {
  return {
    label,
    keys: [keys.added, keys.removed],
    read: (data: Data) => ({ added: asStrings(data[keys.added]), removed: asStrings(data[keys.removed]) }),
    write: (next) => ({ [keys.added]: next.added, [keys.removed]: next.removed }),
  }
}
