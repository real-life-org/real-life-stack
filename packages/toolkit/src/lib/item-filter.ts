/**
 * Auswahl nach Zuweisung, für Listen, die schon geladen sind.
 *
 * Nicht zu verwechseln mit `ItemFilter` aus @real-life-stack/data-interface:
 * das ist der **Abfrage**-Filter (was der Connector überhaupt herausgibt).
 * Dieser hier ist ein **Anzeige**-Filter (was die Fläche aus dem Geladenen
 * zeigt). Tags, Typen und Suchtext macht die geteilte Leiste
 * (`useModuleFilteredItems`); hier bleibt nur, was an Relationen hängt.
 *
 * Vorher stand hier ein größerer Filter, den niemand rief, während das Kanban
 * dieselbe Zuweisungslogik noch einmal ausformulierte. Jetzt nur noch diese
 * eine Regel, und sie hat einen Aufrufer.
 */

import type { Item, Relation } from "@real-life-stack/data-interface"

export interface AssigneeFilter {
  /** Nur Items, die mindestens einer dieser Personen zugewiesen sind. Leer heißt: alle. */
  assignedTo?: readonly string[]
  /** Nur Items, die mir zugewiesen sind. */
  myItemsOnly?: boolean
}

/** Die Kennungen, denen ein Item zugewiesen ist (`assignedTo`, ohne das `global:`-Präfix). */
export function assigneeIds(item: Item): string[] {
  return (item.relations ?? [])
    .filter((r: Relation) => r.predicate === "assignedTo")
    .map((r: Relation) => r.target.replace(/^global:/, ""))
}

/**
 * Filtert nach Zuweisung.
 *
 * Bei `myItemsOnly` ohne bekannte eigene Kennung bleibt die Liste leer, nicht
 * voll: Solange nicht feststeht, wer ich bin, ist „meine Aufgaben" nicht
 * beantwortbar, und alles zu zeigen wäre die falsche Hälfte des Zweifels.
 */
export function filterByAssignee(
  items: readonly Item[],
  filter: AssigneeFilter,
  currentUserId?: string,
): Item[] {
  const gewuenscht = new Set(filter.assignedTo ?? [])
  if (gewuenscht.size === 0 && !filter.myItemsOnly) return [...items]
  return items.filter((item) => {
    const ids = assigneeIds(item)
    if (gewuenscht.size > 0 && !ids.some((id) => gewuenscht.has(id))) return false
    if (filter.myItemsOnly && (!currentUserId || !ids.includes(currentUserId))) return false
    return true
  })
}
