"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import { emptyFilterBarValue, type FilterBarValue } from "./types"

/**
 * Der Filter einer App — app-weit, nicht modulgebunden.
 *
 * Spec: `docs/spec/modules/shared-components.md` → „Modul-uebergreifender
 * Filter-State". Er lebt neben dem persistenten Content-Panel (App-Shell,
 * Spec 01 → Overlay-Flaechen Ebene 1), aus demselben Grund: Beides ueberdauert
 * den Modulwechsel. Vorher hielt jedes Modul seinen Filter in eigenem
 * `useState` — beim Wechsel von Feed zu Kanban war er weg, und ein Klick auf
 * ein Tag konnte nirgendwo hinfuehren, weil das Ziel den Filter des Absenders
 * gar nicht sah.
 *
 * `searchText` liegt mit hier, obwohl die Spec nur `tags` und `types` nennt:
 * Das Suchfeld sitzt jetzt im Kopf der Modulflaeche und nicht mehr im Modul,
 * also braucht es dieselbe Lebensdauer wie der Rest der Leiste.
 *
 * Modul-Extras (`chipsExtra`/`drawerExtra` — „Nur meine", Ort, Zuweisung)
 * bleiben BEIM MODUL (Spec, Regel 2). Sie bedeuten je Modul etwas anderes.
 */
export interface SharedFilterValue {
  value: FilterBarValue
  setValue(next: FilterBarValue): void
  searchText: string
  setSearchText(next: string): void
  /** Filter und Suchtext gemeinsam zuruecksetzen. */
  clear(): void
}

const FilterContext = createContext<SharedFilterValue | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const wert = useFilterValue()
  return <FilterContext.Provider value={wert}>{children}</FilterContext.Provider>
}

/** Der Zustand selbst — geteilt vom Provider, lokal vom Rueckfall unten. */
function useFilterValue(): SharedFilterValue {
  const [value, setValue] = useState<FilterBarValue>(emptyFilterBarValue)
  const [searchText, setSearchText] = useState("")
  const clear = useCallback(() => {
    setValue(emptyFilterBarValue)
    setSearchText("")
  }, [])
  return useMemo(
    () => ({ value, setValue, searchText, setSearchText, clear }),
    [value, searchText, clear],
  )
}

/** Der geteilte Filter. Wirft ohne Provider — wie `useModulePanel`. */
export function useSharedFilter(): SharedFilterValue {
  const ctx = useContext(FilterContext)
  if (!ctx) {
    throw new Error("useSharedFilter must be called inside <FilterProvider>")
  }
  return ctx
}

/** Weiche Variante — `null` ohne Provider. */
export function useOptionalSharedFilter(): SharedFilterValue | null {
  return useContext(FilterContext)
}

/**
 * Der geteilte Filter, wenn es einen gibt — sonst ein lokaler daneben.
 *
 * Fuer Flaechen, die BEIDES koennen muessen: in der App unter dem Provider
 * (dort teilen sie), in Story und Test allein (dort filtern sie fuer sich).
 * Ohne diesen Rueckfall waere jede Story einer Modulflaeche ein Absturz — und
 * ein Provider in jeder Story waere eine zweite Stelle, die den Vertrag kennt.
 */
export function useModuleFilter(): SharedFilterValue {
  // Der lokale Zustand wird immer angelegt (Hook-Regeln) und nur benutzt,
  // wenn kein Provider da ist. Er kostet nichts weiter als zwei Slots.
  const lokal = useFilterValue()
  const geteilt = useContext(FilterContext)
  return geteilt ?? lokal
}
