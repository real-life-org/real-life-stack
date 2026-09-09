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

/**
 * Der geteilte Filter. Wirft ohne Provider — wie `useModulePanel`.
 *
 * Bewusst KEIN stiller Rueckfall auf lokalen Zustand: Jeder Aufrufer bekaeme
 * seinen eigenen, und der Filterzustand haette zwei Besitzer. Genau das ist
 * passiert — die Leiste schrieb in ihren, der Inhalt las einen anderen; im
 * Suchfeld stand „Garten", gefiltert wurde nichts. Wer ohne App-Shell rendert,
 * setzt einen `FilterScope` an die Wurzel seiner Flaeche.
 */
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
 * Der Besitzer fuer eine Flaeche, die auch AUSSERHALB der App laeuft.
 *
 * Unter der App-Shell ist der `FilterProvider` schon da; dann reicht dieser
 * Scope die Kinder unveraendert durch — ein zweiter Provider spaerrte die
 * Flaeche vom app-weiten Filter ab, und ein im Feed gesetztes Tag erreichte
 * sie nicht mehr. Ohne Provider (Story, Test, eingebettete Ansicht,
 * apps/network) legt er GENAU EINEN an.
 *
 * Er gehoert an die **Wurzel der Flaeche**, um Leiste UND Inhalt herum — nie
 * an die Leiste allein: Dann besaesse die Leiste einen Zustand, den der Inhalt
 * nicht sieht, und man tippte in eine Suche, die nichts filtert.
 */
export function FilterScope({ children }: { children: ReactNode }) {
  const vorhanden = useContext(FilterContext)
  if (vorhanden) return <>{children}</>
  return <FilterProvider>{children}</FilterProvider>
}
