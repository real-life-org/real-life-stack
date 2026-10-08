import type { Relation } from "@real-life/data-interface"
import { isMissingQualifier } from "../preview/field-register"

/**
 * Personen-Zuweisungen im Composer: ein Typ kann MEHRERE Personenfelder führen
 * (z.B. eine Aufgabe mit „Kann ich" = `assignedTo` und „Will lernen" =
 * `wantsToLearn`). Jedes Feld ist dieselbe `PeopleWidget`-Komponente mit eigenem
 * Label, eigenem Datenschlüssel und eigenem Relations-Prädikat.
 *
 * Spec: `docs/spec/modules/shared-components.md` → ContentComposer → Personenfelder.
 */

/**
 * Qualifier einer Personen-Kante (08, Qualifier an Kanten): Schlüssel in
 * `meta` der Relation und die erlaubten Werte, aus dem Register.
 */
export interface PeopleQualifier {
  key: string
  values: readonly { id: string; label: string }[]
  /** Der Wert, als der ein fehlender gilt (Spec 06, Regel 7): wird nie ausdrücklich geschrieben. */
  default?: string
}

/** Ein deklariertes Personenfeld eines Typs. */
export interface PeopleRelationConfig {
  /** Relations-Prädikat, unter dem das Feld gespeichert wird (`assignedTo`, …). */
  predicate: string
  /** Feld-Beschriftung im Composer. */
  label: string
  /** Abweichender Datenschlüssel; Standard siehe {@link resolvePeopleFields}. */
  dataKey?: string
  /** Qualifier je Person; Antippen am Chip wechselt ihn (Edit-Regeln 6). */
  qualifier?: PeopleQualifier
  /** Beschriftung des Hinzufügen-Felds („Einladen…", „Zuweisen…"). */
  placeholder?: string
  /** Record-Kante in derselben Zeile (`joins`), deren Zustand der Chip trägt. */
  record?: PeopleRecordStates
}

/**
 * Zustände eines Personenfelds, das eine eingebettete Kante mit einer
 * Record-Kante vereint (Event: `invited` + `attends`, 08 → Teilnahme am
 * Event). `base` ist der Zustand ohne Aussage („eingeladen"), `values` die
 * Werte des Records in Register-Reihenfolge.
 */
export interface PeopleRecordStates {
  predicate: string
  key: string
  base: { id: string; label: string }
  values: readonly { id: string; label: string }[]
}

/** Eine Aussage, die nach dem Speichern als eigener Record geschrieben wird. */
export interface PeopleStatement {
  predicate: string
  from: string
  key: string
  /** `null`: keine Aussage mehr. */
  value: string | null
}

/** Ein aufgelöstes Personenfeld, so wie der Composer es rendert. */
export interface PeopleField {
  /** Prädikat, oder `undefined` wenn der Typ keine Personen-Relation deklariert. */
  predicate?: string
  dataKey: string
  label: string
  qualifier?: PeopleQualifier
  placeholder?: string
  record?: PeopleRecordStates
}

/** Der Datenschlüssel des ersten (bzw. einzigen) Personenfeldes. */
export const PEOPLE_DATA_KEY = "people"

const PEOPLE_DATA_KEY_PREFIX = `${PEOPLE_DATA_KEY}:`

const DEFAULT_PEOPLE_LABEL = "Personen"

const USER_TARGET_PREFIX = "global:"

/**
 * Datenschlüssel der Qualifier eines Personenfeldes: `{ [userId]: wertId }`.
 * Formulardaten, nie `item.data` — der Mapper schreibt sie nach `meta`.
 */
export function peopleQualifierKey(dataKey: string): string {
  return `${dataKey}#qualifier`
}

/**
 * Datenschlüssel der geänderten Zustände eines Personenfelds mit Record-Kante:
 * `{ [userId]: zustandId | null }`. Nur Änderungen; der aktuelle Zustand
 * kommt live aus den Records.
 */
export function peopleStatementKey(dataKey: string): string {
  return `${dataKey}#statement`
}

/**
 * Formulardaten → eigene Aussagen (08, Qualifier an Kanten, Regel 8): Ein
 * Wert der Record-Kante schreibt meine Aussage über die Person, der
 * Grundzustand oder `null` nimmt sie zurück.
 */
export function peopleStatementsFromWidgetData(config: PeopleRelationSource, data: Record<string, unknown>): PeopleStatement[] {
  const out: PeopleStatement[] = []
  for (const field of resolvePeopleFields(config)) {
    if (!field.record) continue
    const changes = asRecordOfUnknown(data[peopleStatementKey(field.dataKey)])
    for (const [userId, value] of Object.entries(changes)) {
      const known = typeof value === "string" && field.record.values.some((v) => v.id === value)
      out.push({ predicate: field.record.predicate, from: `${USER_TARGET_PREFIX}${userId}`, key: field.record.key, value: known ? (value as string) : null })
    }
  }
  return out
}

function asRecordOfUnknown(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/** Datenschlüssel eines weiteren Personenfeldes, abgeleitet aus dem Prädikat. */
export function peopleDataKey(predicate: string): string {
  return `${PEOPLE_DATA_KEY_PREFIX}${predicate}`
}

/**
 * Die Datenschlüssel aller Personenfelder eines Typs. Wer wissen will, ob ein
 * Schlüssel Personen trägt, fragt DIESE Liste — nicht das `people:`-Präfix:
 * ein Eintrag darf einen eigenen `dataKey` setzen.
 */
export function peopleDataKeys(config: PeopleRelationSource): string[] {
  return resolvePeopleFields(config).map((field) => field.dataKey)
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
      ...(entry.qualifier ? { qualifier: entry.qualifier } : {}),
      ...(entry.placeholder ? { placeholder: entry.placeholder } : {}),
      ...(entry.record ? { record: entry.record } : {}),
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
  const managed: { predicate: string; ids: string[]; qualifier?: PeopleQualifier; values: Record<string, unknown>; submitted: boolean }[] = []
  for (const field of resolvePeopleFields(config)) {
    if (!field.predicate) continue
    const ids = asIdList(data[field.dataKey])
    if (!ids) continue
    const submitted = data[peopleQualifierKey(field.dataKey)]
    const values = asRecord(submitted)
    managed.push({ predicate: field.predicate, ids, qualifier: field.qualifier, values, submitted: submitted !== undefined })
  }
  if (managed.length === 0) return undefined

  const touched = new Set(managed.map((m) => m.predicate))
  const others = (existingRelations ?? []).filter((r) => !touched.has(r.predicate))
  const assigned = managed.flatMap(({ predicate, ids, qualifier, values, submitted }) =>
    ids.map((id): Relation => {
      const target = `${USER_TARGET_PREFIX}${id}`
      // 08, Qualifier an Kanten, Regel 11: Eine Kante, die bestehen bleibt,
      // behält ihr meta — auch Schlüssel, die dieses Formular nicht kennt.
      const kept = (existingRelations ?? []).find((r) => r.predicate === predicate && r.target === target)
      const meta: Record<string, unknown> = { ...(kept?.meta ?? {}) }
      if (qualifier) {
        const value = values[id]
        if (typeof value === "string" && qualifier.values.some((v) => v.id === value)) meta[qualifier.key] = value
        // Mit default heißt „kein Wert in der eingereichten Menge": default —
        // die Kante trägt dann keinen (fehlend = default, Spec 06 Regel 7). Ein
        // unbekannter Wert steht in der Menge und bleibt so unverändert.
        else if (isMissingQualifier(value) && submitted && qualifier.default !== undefined) delete meta[qualifier.key]
      }
      return Object.keys(meta).length > 0 ? { predicate, target, meta } : { predicate, target }
    }),
  )
  return [...others, ...assigned]
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

/**
 * Relations → Composer-Daten (Umkehrung von
 * {@link peopleRelationsFromWidgetData}). Leere Felder bleiben weg, damit die
 * Vorbefüllung kein Feld unnötig aufklappt.
 */
export function peopleRelationsToWidgetData(
  config: PeopleRelationSource,
  relations: readonly Relation[] | undefined,
): Record<string, string[] | Record<string, unknown>> {
  const out: Record<string, string[] | Record<string, unknown>> = {}
  for (const field of resolvePeopleFields(config)) {
    if (!field.predicate) continue
    const mine = (relations ?? []).filter((r) => r.predicate === field.predicate)
    const ids = mine.map((r) => r.target.replace(/^global:/, ""))
    if (ids.length > 0) out[field.dataKey] = ids
    if (field.qualifier) {
      // Jeder vorhandene Wert geht ins Formular, auch ein unbekannter (auch
      // kein String): er bleibt erhalten und steht ohne Zustandstext da. Nur
      // ein fehlender (fehlend, null, leer) fehlt hier und gilt als Standard
      // (Spec 06, Regel 7).
      const values: Record<string, unknown> = {}
      for (const relation of mine) {
        const value = relation.meta?.[field.qualifier.key]
        if (!isMissingQualifier(value)) values[relation.target.replace(/^global:/, "")] = value
      }
      if (Object.keys(values).length > 0) out[peopleQualifierKey(field.dataKey)] = values
    }
  }
  return out
}
