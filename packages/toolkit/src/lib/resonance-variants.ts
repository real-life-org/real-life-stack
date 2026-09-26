import type { Item } from "@real-life-stack/data-interface"

/**
 * Varianten im Resonanzmodul (docs/spec/modules/resonance.md → Varianten).
 *
 * Eine Variante ist ein eigenes Statement mit `data.variantOf` auf die
 * Aussage, von der es abweicht. Dieses Modul rechnet nur über die Menge der
 * Statements eines Space; es liest keine Daten nach.
 */

/** Ziel-Id aus `data.variantOf` (`item:<id>`), oder null. */
export function variantOfId(item: Item): string | null {
  const raw = item.data?.variantOf
  if (typeof raw !== "string" || raw.length === 0) return null
  const id = raw.startsWith("item:") ? raw.slice("item:".length) : raw
  return id.length > 0 ? id : null
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
    const target = variantOfId(statement)
    if (target === null || target === statement.id) continue
    const list = children.get(target) ?? []
    list.push(statement)
    children.set(target, list)
  }
  for (const list of children.values()) list.sort(byCreatedAt)

  const parentId = variantOfId(item)
  const parent = parentId === null || parentId === item.id ? null : byId.get(parentId) ?? "missing"

  // Aufwärts zur Ausgangsaussage; ein Zyklus oder ein fehlendes Ziel beendet
  // den Weg beim letzten verfügbaren Statement.
  let root = item
  const climbed = new Set([item.id])
  for (;;) {
    const up = variantOfId(root)
    const next = up === null ? undefined : byId.get(up)
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
