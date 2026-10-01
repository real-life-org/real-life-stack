// Zusatz und Gruppen einer Rückwärts-Liste über eine Kante (`list.trailing`,
// `list.group`).
//
// Spec: docs/spec/06-schema-composition.md → „Feld- und Kantenregister",
// Regeln 10 und 22; shared-components → Detail-Anatomie, Regel 8.
//
// React-frei: welche Felder zulässig sind, was als Wert gilt und wie die
// Einträge gegliedert werden. Gerendert wird in `register-reverse.tsx`.

import type { Item } from "@real-life-stack/data-interface"

import { formatNumber, parseNumberInput } from "../../lib/field-values"
import type { FieldEntry, WidgetId } from "./field-register"

/** Widgets, deren Wert rechts in der Zeile stehen und eine Liste gliedern darf (Regel 22). */
export const LIST_FIELD_WIDGETS: ReadonlySet<WidgetId> = new Set(["status", "select", "number"])

/** Überschrift der letzten Gruppe: Einträge ohne Wert. Die Spec nennt einen Intl-Schlüssel; das Toolkit hat für eigene Texte noch keine Intl-Schicht. */
export const NO_VALUE_LABEL = "Ohne Angabe"

/** Warum ein Feld weder Zusatz noch Gruppe sein darf, oder undefined. */
export function listFieldProblem(field: FieldEntry | undefined): string | undefined {
  if (!field) return "das der Typ am anderen Endpunkt nicht führt"
  if (!LIST_FIELD_WIDGETS.has(field.widget)) return `mit Widget "${field.widget}"; zulässig sind status, select oder number`
  if (field.pos === "system") return `mit pos "system"`
  return undefined
}

/**
 * Der Wert eines Eintrags für das Feld, oder undefined (fehlend, `null`,
 * leer): bei number die Zahl (unlesbar gilt als kein Wert, wie in der
 * Meta-Box), bei status/select die Id.
 */
export function listFieldValue(field: FieldEntry, entry: Item): string | number | undefined {
  const raw = (entry.data as Record<string, unknown> | undefined)?.[field.key]
  if (field.widget === "number") {
    const n = parseNumberInput(raw)
    return n === undefined || Number.isNaN(n) ? undefined : n
  }
  if (typeof raw === "string") return raw.trim() === "" ? undefined : raw
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw)
  return undefined
}

/** Die Leseform eines Werts: die Beschriftung der Option (unbekannt: der Wert selbst), eine Zahl mit Einheit. */
export function listValueText(field: FieldEntry, value: string | number): string {
  if (typeof value === "number") return formatNumber(value, field.unit)
  return field.options?.find((o) => o.id === value)?.label ?? value
}

export interface ListGroup {
  /** Stabiler Schlüssel; `null` für die Gruppe ohne Wert. */
  key: string | null
  /** Der Wert der Gruppe (`undefined` für die Gruppe ohne Wert). */
  value: string | number | undefined
  /** Zwischenüberschrift: der Wert in der Leseform, bei number mit Label („Stufe 3"). */
  heading: string
  entries: Item[]
}

/**
 * Gliedert die (schon gefilterten, in ihrer Reihenfolge sortierten) Einträge
 * nach dem Wert des Felds. Reihenfolge der Gruppen: bei status und select die
 * der Optionen, danach unbekannte Werte nach Id; bei number aufsteigend.
 * Einträge ohne Wert bilden die letzte Gruppe. Leere Gruppen entstehen nicht.
 * Innerhalb einer Gruppe bleibt die Reihenfolge der Einträge (`sort`).
 * Hat kein Eintrag einen Wert, `null`: die Gliederung entfällt.
 */
export function groupListEntries(entries: readonly Item[], field: FieldEntry): ListGroup[] | null {
  const buckets = new Map<string, { value: string | number; entries: Item[] }>()
  const none: Item[] = []
  for (const entry of entries) {
    const value = listFieldValue(field, entry)
    if (value === undefined) {
      none.push(entry)
      continue
    }
    const key = typeof value === "number" ? `n:${value}` : `s:${value}`
    const bucket = buckets.get(key)
    if (bucket) bucket.entries.push(entry)
    else buckets.set(key, { value, entries: [entry] })
  }
  if (buckets.size === 0) return null
  const optionIndex = new Map((field.options ?? []).map((o, i) => [o.id, i]))
  const rank = (value: string | number) => (typeof value === "string" ? (optionIndex.get(value) ?? Number.POSITIVE_INFINITY) : 0)
  const ordered = [...buckets.entries()].sort(([, a], [, b]) => {
    if (typeof a.value === "number" && typeof b.value === "number") return a.value - b.value
    const ra = rank(a.value)
    const rb = rank(b.value)
    if (ra !== rb) return ra < rb ? -1 : 1
    // Gleicher Rang heißt: beide unbekannt. Nach Id, deterministisch
    // (Code-Punkte, nicht Locale).
    const x = String(a.value)
    const y = String(b.value)
    return x < y ? -1 : x > y ? 1 : 0
  })
  const groups: ListGroup[] = ordered.map(([key, { value, entries: members }]) => {
    const text = listValueText(field, value)
    return {
      key,
      value,
      heading: typeof value === "number" && field.label ? `${field.label} ${text}` : text,
      entries: members,
    }
  })
  if (none.length > 0) groups.push({ key: null, value: undefined, heading: NO_VALUE_LABEL, entries: none })
  return groups
}
