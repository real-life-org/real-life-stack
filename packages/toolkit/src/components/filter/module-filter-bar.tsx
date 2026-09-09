"use client"

import type { ReactNode } from "react"
import { Search } from "lucide-react"

import { Input } from "../primitives/input"
import { FilterBar } from "./filter-bar"
import { useSharedFilter } from "./filter-store"
import type { FilterTypeOption } from "./types"

export interface ModuleFilterBarProps {
  /** Tags zur Auswahl — sonst zeigt der Picker seinen Leerzustand. */
  availableTags?: readonly string[]
  /** Welche Typ-Chips dieses Modul anbietet (Spec shared-components, Regel 4). */
  availableTypes?: readonly FilterTypeOption[]
  /** Modul-eigene Chips (aktiver Zustand). */
  chipsExtra?: ReactNode
  /** Modul-eigene Abschnitte im Auswahl-Panel. */
  drawerExtra?: ReactNode
  /** Rechtsbuendige Modul-Aktionen (Ansichtswechsel, Einstellungen, „Heute"). */
  trailingActions?: ReactNode
  /** Beschriftung des Suchfelds — benennt die Flaeche, die es durchsucht. */
  searchLabel?: string
  className?: string
}

/**
 * Die `FilterBar` gegen den geteilten Zustand: Filter-Knopf, Suchfeld, Chips.
 *
 * Warum eine eigene Komponente und nicht fuenfmal dieselbe Verdrahtung: Suche
 * und Filter lagen bis hierher in jedem Modul erneut — mit je eigenem
 * `useState`, je eigenem Eingabefeld und leicht abweichender Optik. Hier steht
 * die Verdrahtung einmal; Module reichen nur noch bei, was ihnen gehoert.
 *
 * Sie braucht einen Besitzer ueber sich (`FilterProvider`). Flaechen, die auch
 * ausserhalb der App laufen, setzen dafuer einen `FilterScope` an ihre Wurzel —
 * um Leiste UND Inhalt, nie nur um die Leiste.
 */
export function ModuleFilterBar({
  availableTags,
  availableTypes,
  chipsExtra,
  drawerExtra,
  trailingActions,
  searchLabel = "Inhalte durchsuchen",
  className,
}: ModuleFilterBarProps) {
  const { value, setValue, searchText, setSearchText } = useSharedFilter()
  return (
    <FilterBar
      value={value}
      onChange={setValue}
      availableTags={availableTags}
      availableTypes={availableTypes}
      chipsExtra={chipsExtra}
      drawerExtra={drawerExtra}
      trailingActions={trailingActions}
      className={className}
      leadingActions={
        // Suche gehoert neben den Filter-Knopf (Spec shared-components →
        // „Suche"), nicht an den rechten Rand.
        <div className="relative min-w-0 flex-1 sm:flex-none">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suche…"
            aria-label={searchLabel}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="h-8 w-full pl-7 text-xs sm:w-40"
          />
        </div>
      }
    />
  )
}
