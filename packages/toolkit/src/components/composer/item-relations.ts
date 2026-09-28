import type { Item, Relation } from "@real-life-stack/data-interface"
import { isItemTarget, survivesSpaceChange } from "../../lib/item-targets"

/**
 * Item-Kanten im Composer (C3, Schreibform): Chips und eine `@`-Suche über
 * die Items des Space; jede ausgehende eingebettete Item-Kante des Typs ist
 * ein Feld mit eigenem Datenschlüssel.
 *
 * Spec: shared-components → „Item-Detail aus dem Register", Widget-Paare C3,
 * Edit-Regeln 7; 06 → Feld- und Kantenregister, Regel 16; 08, Qualifier an
 * Kanten, Regel 11 (meta bestehender Kanten bleibt).
 */

/** Ein Feld für eine Item-Kante, abgeleitet aus einem `EdgeEntry`. */
export interface ItemRelationFieldConfig {
  predicate: string
  label: string
  /** Beschriftung der Suche („@ Aufgabe suchen…"). */
  placeholder?: string
  /** Typ der Gegenstelle aus dem Manifest (`otherKind`); ohne Angabe jedes Item. */
  targetType?: string
  /**
   * Eingehende Kante (`itemRole: "to"`, „Braucht"): Sie liegt am ANDEREN Item.
   * Das Formular führt nur die Änderungen (hinzugefügt, entfernt) gegen die
   * live gelesenen Quellen und schreibt sie nach dem Speichern dort — nur mit
   * Schreibrecht an diesem Item.
   */
  incoming?: true
  /**
   * Die Kante gehört dem Ort-Feld (B4, S4b): Das Ort-Widget schreibt sie
   * (Ort-Item gewählt) oder leert sie (Adresse gewählt); kein eigenes
   * Verknüpfungsfeld. Datenschlüssel wie jede Item-Kante.
   */
  location?: true
}

/** Eine Änderung an eingehenden Kanten: an welchen Items die Kante dazukommt oder entfällt (lokale Targets `item:<id>`). */
export interface IncomingEdgeChange {
  predicate: string
  add: string[]
  remove: string[]
}

/** Ein Feld mit Item-Verweis (B15), abgeleitet aus einem `FieldEntry` mit `item-ref`. */
export interface ItemRefFieldConfig {
  key: string
  label: string
  targetType: string
  /** Text für ein Ziel, das sich nicht auflösen lässt. */
  missing: string
  /** `edit: "fixed"`: sichtbar, nicht bearbeitbar (06, Regel 14). */
  fixed: boolean
}

/**
 * Datenschlüssel eines Item-Kanten-Felds im Composer. Eingehend: die
 * hinzugefügten Quellen (`item:<id>`); die entfernten unter
 * {@link incomingRemovedKey}. Beide beginnen mit `relation:`, damit ein
 * Space-Wechsel ihre space-lokalen Ziele mit leert (withSpaceChange).
 */
export const itemRelationDataKey = (predicate: string, incoming?: boolean): string =>
  incoming ? `relation:in:${predicate}` : `relation:${predicate}`

/** Die entfernten Quellen einer eingehenden Kante (`item:<id>`). */
export const incomingRemovedKey = (predicate: string): string => `relation:in:${predicate}#removed`

/** Die Datenschlüssel aller Item-Kanten-Felder eines Typs. */
export function itemRelationDataKeys(fields: readonly ItemRelationFieldConfig[] | undefined): string[] {
  return (fields ?? []).flatMap((f) =>
    f.incoming ? [itemRelationDataKey(f.predicate, true), incomingRemovedKey(f.predicate)] : [itemRelationDataKey(f.predicate)],
  )
}

/**
 * Die Schlüssel, deren Wert eine GEWÄHLTE Beziehung ist (Space des
 * Formulars, Regel 5: beim Anlegen fest, sobald eine Item-Kante gewählt ist).
 * Entfernte eingehende Quellen zählen nicht.
 */
export function itemRelationChoiceKeys(fields: readonly ItemRelationFieldConfig[] | undefined): string[] {
  return (fields ?? []).map((f) => itemRelationDataKey(f.predicate, f.incoming))
}

/**
 * Die lokalen Item-Targets eines Werts (`item:<id>`), jedes einmal. Welches
 * Item sie meinen, bestimmt beim Schreiben der Auflöser (use-item-editor).
 */
function localTargetsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const target of value) {
    if (typeof target !== "string" || !isItemTarget(target) || survivesSpaceChange(target)) continue
    if (!out.includes(target)) out.push(target)
  }
  return out
}

/**
 * Die Änderungen an eingehenden Kanten aus der Einreichung („Braucht"). Nur
 * Felder mit einer Änderung; ein Item, das zugleich hinzugefügt und entfernt
 * ist, gilt als hinzugefügt.
 */
export function incomingChangesFromWidgetData(
  fields: readonly ItemRelationFieldConfig[] | undefined,
  data: Record<string, unknown>,
): IncomingEdgeChange[] {
  const out: IncomingEdgeChange[] = []
  for (const field of fields ?? []) {
    if (!field.incoming) continue
    const add = localTargetsOf(data[itemRelationDataKey(field.predicate, true)])
    const remove = localTargetsOf(data[incomingRemovedKey(field.predicate)]).filter((id) => !add.includes(id))
    if (add.length > 0 || remove.length > 0) out.push({ predicate: field.predicate, add, remove })
  }
  return out
}

/** Vorbelegung beim Bearbeiten: je Feld die Targets der Kante, in ihrer Reihenfolge, jedes einmal. */
export function itemRelationsToWidgetData(
  fields: readonly ItemRelationFieldConfig[] | undefined,
  relations: readonly Relation[] | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const field of fields ?? []) {
    // Eingehende Kanten liegen an anderen Items; das Feld liest sie live.
    if (field.incoming) continue
    const targets: string[] = []
    for (const r of relations ?? []) if (r.predicate === field.predicate && !targets.includes(r.target)) targets.push(r.target)
    out[itemRelationDataKey(field.predicate)] = targets
  }
  return out
}

/**
 * Die Relationen nach dem Speichern: Nur die Prädikate der eingereichten
 * Felder werden ersetzt. Eine Kante, die bleibt, behält ihre Stelle und ihr
 * `meta`; neue kommen hinten dazu. `undefined`, wenn kein Feld eingereicht wurde.
 */
export function itemRelationsFromWidgetData(
  fields: readonly ItemRelationFieldConfig[] | undefined,
  data: Record<string, unknown>,
  existing: readonly Relation[] | undefined,
): Relation[] | undefined {
  const submitted = (fields ?? []).filter((f) => !f.incoming && Array.isArray(data[itemRelationDataKey(f.predicate)]))
  if (submitted.length === 0) return undefined
  let relations: Relation[] = [...(existing ?? [])]
  for (const field of submitted) {
    const wanted = (data[itemRelationDataKey(field.predicate)] as unknown[]).filter((t): t is string => typeof t === "string" && t !== "")
    const kept = new Set<string>()
    relations = relations.filter((r) => {
      if (r.predicate !== field.predicate) return true
      if (!wanted.includes(r.target) || kept.has(r.target)) return false
      kept.add(r.target)
      return true
    })
    for (const target of wanted) {
      if (kept.has(target)) continue
      kept.add(target)
      relations.push({ predicate: field.predicate, target })
    }
  }
  return relations
}

/** Titel eines Items für Chips und Suche. */
export function itemTitle(item: Item): string {
  const data = (item.data ?? {}) as Record<string, unknown>
  const title = data.title ?? data.displayName ?? data.content
  return typeof title === "string" && title.trim() !== "" ? title : "Ohne Titel"
}
