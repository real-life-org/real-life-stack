import { useMemo } from "react"
import type { Item } from "@real-life/data-interface"
import { useOptionalSharedFilter } from "../components/filter/filter-store"
import type { FilterBarValue } from "../components/filter/types"

/**
 * Pure filter logic — exported for tests and for non-React callers.
 *
 * - Tag filter: AND across the selected tags (item must carry every
 *   selected tag in its top-level `item.tags`).
 * - Type filter: OR across the selected types (item type must be in
 *   the set).
 */
export function applyFilterBarValue(items: readonly Item[], filter: FilterBarValue): Item[] {
  const { tags, types } = filter
  if (tags.length === 0 && types.length === 0) return [...items]

  const tagSet = new Set(tags)
  const typeSet = new Set(types)

  return items.filter((item) => {
    if (tagSet.size > 0) {
      const itemTags = item.tags ?? []
      for (const required of tagSet) {
        if (!itemTags.includes(required)) return false
      }
    }
    if (typeSet.size > 0) {
      if (!typeSet.has(item.type)) return false
    }
    return true
  })
}

/**
 * The shared filter applied to a list, for surfaces that hold the bar themselves.
 *
 * Apply a shared `FilterBarValue` to a list of items, client-side.
 *
 * Memoised on the items reference and the filter's stringified arrays,
 * so memoised children stay stable across unrelated renders and the
 * caller doesn't have to memoise their filter value.
 *
 * Server-side optimisation (lifting `tags` into a `hasTag` connector
 * filter) is intentionally out of scope here — that's a data-interface
 * concern. This hook is the UI-layer guarantee that the same filter
 * shape applies the same way in every module.
 *
 * @answers `{items, value, setValue, …}`
 * @without throws on render — without `FilterProvider`
 * @group surface
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useFilterableItems(items: readonly Item[], filter: FilterBarValue): Item[] {
  // JSON.stringify avoids the `["a", "b"]` vs `["a b"]` collision that
  // a naive join(" ") would produce — codex-Review #53.
  const tagsKey = JSON.stringify(filter.tags)
  const typesKey = JSON.stringify(filter.types)
  return useMemo(
    () => applyFilterBarValue(items, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, tagsKey, typesKey],
  )
}

/**
 * Freitextsuche ueber ein Item: Titel, Beschreibung, Inhalt.
 *
 * Eine Funktion statt fuenfmal derselbe `haystack`: Feed, Kanban, Kalender und
 * Karte hatten je eine eigene Variante, und sie stimmten nicht ueberein — die
 * einen suchten ueber `content` mit, die anderen nicht. Wer im Feed etwas
 * fand, fand es im Kanban nicht.
 */
export function applyItemSearch(items: readonly Item[], search: string): Item[] {
  const needle = search.trim().toLowerCase()
  if (!needle) return [...items]
  return items.filter((item) =>
    [item.data.title, item.data.description, item.data.content].some((value) =>
      String(value ?? "").toLowerCase().includes(needle),
    ),
  )
}

/**
 * Exactly what the toolbar in the module head promises: filter plus search text.
 *
 * Die Items einer Fläche, gefiltert wie die Steuerleiste im Kopf es anzeigt:
 * geteilte Tag-/Typ-Auswahl plus geteilter Suchtext. Der Modul-Host und
 * `ModuleSurfaceScope` wenden ihn so an; ein Modul unter dem Host bekommt
 * seine Items schon gefiltert und ruft ihn nicht selbst (Anton, 21.09.2026:
 * „ein Modul darf da gar nichts falsch machen koennen").
 *
 * Öffentlich für die Fläche AUSSERHALB des Hosts (real-life-stack#558): eine
 * App-eigene Ansicht wie das Karabirrdt-Brett, die den geteilten Filter sonst
 * aus `useSharedFilter`, `applyFilterBarValue` und `applyItemSearch` selbst
 * zusammensetzen müsste. Ohne `FilterProvider` besitzt niemand einen Filter,
 * dann kommen die Items unverändert zurück.
 *
 * @answers `Item[]`
 * @without value — the items unchanged, without `FilterProvider`
 * @group read
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useModuleFilteredItems(items: readonly Item[]): Item[] {
  const filter = useOptionalSharedFilter()
  const value = filter?.value ?? LEER
  const searchText = filter?.searchText ?? ""
  const gefiltert = useFilterableItems(items, value)
  return useMemo(() => applyItemSearch(gefiltert, searchText), [gefiltert, searchText])
}

const LEER: FilterBarValue = { tags: [], types: [] }
