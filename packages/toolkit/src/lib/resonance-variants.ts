import type { Item } from "@real-life-stack/data-interface"
import { resolveTarget, sameSpaceScope, type TargetScope } from "./item-targets"

/**
 * Varianten im Resonanzmodul (docs/spec/modules/resonance.md → Varianten).
 *
 * Eine Variante ist ein eigenes Statement mit `data.variantOf` auf die
 * Aussage, von der es abweicht. Dieses Modul rechnet nur über die Menge der
 * Statements eines Space; es liest keine Daten nach.
 */

/**
 * Der Kontext von `variantOf`: Die Statements eines Space bilden einen
 * Bereich (Varianten-Regel 2: das Ziel liegt im selben Space); alte Werte
 * ohne Präfix werden geduldet.
 */
const VARIANT_SCOPE: TargetScope = sameSpaceScope({ otherKind: "statement", bareId: true }) // targets: ein Bereich — die Statements EINES Space

/** Das Statement, von dem `item` eine Variante ist, aus `statements` — über den Auflöser. */
export function variantOfTarget(item: Item, statements: Iterable<Item> | ReadonlyMap<string, Item>): Item | undefined {
  const raw = item.data?.variantOf
  return typeof raw === "string" && raw !== "" ? resolveTarget(raw, VARIANT_SCOPE, statements) : undefined
}

/** Ist `item` eine Variante (hat es einen Wert in `variantOf`)? */
function hasVariantOf(item: Item): boolean {
  const raw = item.data?.variantOf
  return typeof raw === "string" && raw !== ""
}

/** Der Wert für `data.variantOf`, wenn eine Variante zu `item` entsteht. */
export function variantOfValue(item: Pick<Item, "id">): string {
  return `item:${item.id}`
}

export interface StatementFamily {
  /** Die Aussage, von der `item` eine Variante ist; `"missing"`, wenn das Ziel
      im Space nicht verfügbar ist; null, wenn `item` keine Variante ist. */
  parent: Item | "missing" | null
  /** Direkte Varianten von `item`, älteste zuerst. */
  variants: Item[]
  /** Die ganze Familie: Ausgangsaussage zuerst, dann alle Varianten in
      Breitensuche, jede genau einmal (Zyklen werden toleriert). Enthält
      `item` immer. */
  members: Item[]
}

const byCreatedAt = (a: Item, b: Item) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)

/**
 * Familie eines Statements (Varianten-Regeln 5 und 6): von `item` aufwärts
 * bis zur Ausgangsaussage (Abbruch bei Zyklus oder fehlendem Ziel), von dort
 * abwärts alle Varianten. Eine Familie wird ohne Wiederholung durchlaufen.
 */
export function statementFamily(item: Item, statements: readonly Item[]): StatementFamily {
  const byId = new Map<string, Item>()
  for (const statement of statements) byId.set(statement.id, statement)
  byId.set(item.id, item)

  const children = new Map<string, Item[]>()
  for (const statement of byId.values()) {
    const target = variantOfTarget(statement, byId)
    if (!target || target.id === statement.id) continue
    const list = children.get(target.id) ?? []
    list.push(statement)
    children.set(target.id, list)
  }
  for (const list of children.values()) list.sort(byCreatedAt)

  const parentItem = variantOfTarget(item, byId)
  const parent = !hasVariantOf(item) || parentItem?.id === item.id ? null : parentItem ?? "missing"

  // Aufwärts zur Ausgangsaussage; ein Zyklus oder ein fehlendes Ziel beendet
  // den Weg beim letzten verfügbaren Statement.
  let root = item
  const climbed = new Set([item.id])
  for (;;) {
    const next = variantOfTarget(root, byId)
    if (!next || climbed.has(next.id)) break
    climbed.add(next.id)
    root = next
  }

  const members: Item[] = []
  const seen = new Set<string>()
  const queue = [root]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (seen.has(current.id)) continue
    seen.add(current.id)
    members.push(current)
    for (const child of children.get(current.id) ?? []) queue.push(child)
  }
  // Ein Zyklus ohne Einstieg von oben erreicht `item` nicht immer über die
  // Kinder — es gehört trotzdem dazu.
  if (!seen.has(item.id)) members.push(item)

  return { parent, variants: children.get(item.id) ?? [], members }
}
