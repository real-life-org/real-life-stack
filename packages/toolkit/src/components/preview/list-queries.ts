// Benannte Abfragen für Rückwärts-Listen (Spec 06, Feld- und Kantenregister,
// Regel 12): Das Register nennt nur den Namen; was die Abfrage liefert und
// was ihre Aktion tut, definiert die Spec des Typs oder Moduls. Hier binden
// Toolkit (und Apps) die Umsetzung an den Namen.

import type { ReactNode } from "react"
import type { Item } from "@real-life/data-interface"

import type { ListEntry } from "./field-register"

/** Zusatz je Zeile einer Liste: Badge links, Markierung, etwas rechts (klein). */
export interface ListRowDecoration {
  badge?: string
  /** Markierung der angezeigten Zeile („diese"). */
  mark?: string
  trailing?: ReactNode
}

export interface ListQueryResult {
  /** Alle Einträge, jeder einmal; das angezeigte Item darf dabei sein. */
  entries: readonly Item[]
  decorate?: (entry: Item) => ListRowDecoration
  /** Die Aktion der Liste (`ListEntry.action`), wenn Capability und Autorisierung sie erlauben. */
  action?: () => void
  /** Hinweis an der Stelle der Liste (Modi, Regel 4: „Wortlaut eingefroren"), kurz. */
  note?: ReactNode
  /** Die Erklärung zum Hinweis (Tooltip): warum es so ist und was bleibt. */
  noteDetail?: string
}

/** Hook: die Liste zu einem Item. Muss bei jedem Render gleich viele Hooks rufen. */
export type ListQuery = (item: Item, entry: ListEntry) => ListQueryResult

const queries = new Map<string, () => ListQuery>()

/**
 * Bindet eine Abfrage an ihren Namen. Ein Name gehört einer Umsetzung; ein
 * zweiter Versuch mit einer anderen ist ein Konflikt (kein Override, 06).
 * `query` darf ein Thunk sein: Die Toolkit-Typen registrieren beim Laden des
 * Registers, bevor jedes Modul, das eine Abfrage liefert, ausgewertet ist.
 */
export function registerListQuery(name: string, query: ListQuery | { lazy: () => ListQuery }): void {
  const get = "lazy" in query ? query.lazy : () => query
  const existing = queries.get(name)
  if (existing && existing() !== get()) {
    throw new Error(`Listen-Abfrage "${name}" ist bereits vergeben (Spec 06, Feld- und Kantenregister, Regel 12).`)
  }
  queries.set(name, get)
}

/** Die Umsetzung einer benannten Abfrage, oder undefined (die Liste entfällt dann). */
export function resolveListQuery(name: string): ListQuery | undefined {
  return queries.get(name)?.()
}
