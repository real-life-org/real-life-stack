import type { Relation } from "@real-life-stack/data-interface"

/**
 * Personen-Zuweisungen im Composer: ein Typ kann MEHRERE Personenfelder führen
 * (z.B. eine Aufgabe mit „Kann ich" = `assignedTo` und „Will lernen" =
 * `wantsToLearn`). Jedes Feld ist dieselbe `PeopleWidget`-Komponente mit eigenem
 * Label, eigenem Datenschlüssel und eigenem Relations-Prädikat.
 *
 * Spec: `docs/spec/modules/shared-components.md` → ContentComposer → Personenfelder.
 */

/** Ein deklariertes Personenfeld eines Typs. */
export interface PeopleRelationConfig {
  /** Relations-Prädikat, unter dem das Feld gespeichert wird (`assignedTo`, …). */
  predicate: string
  /** Feld-Beschriftung im Composer. */
  label: string
  /** Abweichender Datenschlüssel; Standard siehe {@link resolvePeopleFields}. */
  dataKey?: string
}

/** Ein aufgelöstes Personenfeld, so wie der Composer es rendert. */
export interface PeopleField {
  /** Prädikat, oder `undefined` wenn der Typ keine Personen-Relation deklariert. */
  predicate?: string
  dataKey: string
  label: string
}

/** Der Datenschlüssel des ersten (bzw. einzigen) Personenfeldes. */
export const PEOPLE_DATA_KEY = "people"

const PEOPLE_DATA_KEY_PREFIX = `${PEOPLE_DATA_KEY}:`

const DEFAULT_PEOPLE_LABEL = "Personen"

const USER_TARGET_PREFIX = "global:"

/** Datenschlüssel eines weiteren Personenfeldes, abgeleitet aus dem Prädikat. */
export function peopleDataKey(predicate: string): string {
  return `${PEOPLE_DATA_KEY_PREFIX}${predicate}`
}

/** Ob ein Datenschlüssel zu einem *weiteren* Personenfeld gehört. */
export function isPeopleDataKey(key: string): boolean {
  return key.startsWith(PEOPLE_DATA_KEY_PREFIX)
}

/** Der Teil der Typ-Konfiguration, den die Auflösung braucht. */
export interface PeopleRelationSource {
  peopleRelation?: { predicate: string }
  peopleRelations?: readonly PeopleRelationConfig[]
  widgetLabels?: Partial<Record<string, string>>
}

/**
 * Die Personenfelder eines Typs, in Deklarationsreihenfolge. Immer mindestens
 * eines — ein Typ ohne deklarierte Relation behält das namenlose `data.people`.
 *
 * - Erstes/einziges Feld schreibt aus Kompatibilität nach `data.people`.
 * - Jedes weitere nach `people:<predicate>` (oder nach dem gesetzten `dataKey`).
 * - `peopleRelations` gewinnt über die Einzahl-Kurzform `peopleRelation`.
 */
export function resolvePeopleFields(config: PeopleRelationSource): PeopleField[] {
  const declared = config.peopleRelations
  if (declared && declared.length > 0) {
    return declared.map((entry, index) => ({
      predicate: entry.predicate,
      dataKey: entry.dataKey ?? (index === 0 ? PEOPLE_DATA_KEY : peopleDataKey(entry.predicate)),
      label: entry.label,
    }))
  }
  const label = config.widgetLabels?.[PEOPLE_DATA_KEY] ?? DEFAULT_PEOPLE_LABEL
  return [{ predicate: config.peopleRelation?.predicate, dataKey: PEOPLE_DATA_KEY, label }]
}

function asIdList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((v): v is string => typeof v === "string")
}

/**
 * Composer-Daten → Relations. Je eingereichtem Personenfeld werden die Relationen
 * seines Prädikats ersetzt; Prädikate ohne eingereichtes Feld und Relationen
 * anderer Prädikate bleiben unangetastet. `undefined` heißt: nichts verwaltet,
 * der Caller behält die bestehenden Relationen.
 */
export function peopleRelationsFromWidgetData(
  config: PeopleRelationSource,
  data: Record<string, unknown>,
  existingRelations: readonly Relation[] | undefined,
): Relation[] | undefined {
  const managed: { predicate: string; ids: string[] }[] = []
  for (const field of resolvePeopleFields(config)) {
    if (!field.predicate) continue
    const ids = asIdList(data[field.dataKey])
    if (!ids) continue
    managed.push({ predicate: field.predicate, ids })
  }
  if (managed.length === 0) return undefined

  const touched = new Set(managed.map((m) => m.predicate))
  const others = (existingRelations ?? []).filter((r) => !touched.has(r.predicate))
  const assigned = managed.flatMap(({ predicate, ids }) =>
    ids.map((id) => ({ predicate, target: `${USER_TARGET_PREFIX}${id}` })),
  )
  return [...others, ...assigned]
}

/**
 * Relations → Composer-Daten (Umkehrung von
 * {@link peopleRelationsFromWidgetData}). Leere Felder bleiben weg, damit die
 * Vorbefüllung kein Feld unnötig aufklappt.
 */
export function peopleRelationsToWidgetData(
  config: PeopleRelationSource,
  relations: readonly Relation[] | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const field of resolvePeopleFields(config)) {
    if (!field.predicate) continue
    const ids = (relations ?? [])
      .filter((r) => r.predicate === field.predicate)
      .map((r) => r.target.replace(/^global:/, ""))
    if (ids.length > 0) out[field.dataKey] = ids
  }
  return out
}
