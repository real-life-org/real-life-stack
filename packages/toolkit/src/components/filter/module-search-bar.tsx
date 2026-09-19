"use client"

import type { ReactNode } from "react"
import { Search } from "lucide-react"

import { cn } from "../../lib/utils"
import { Input } from "../primitives/input"
import { useOptionalSharedFilter } from "./filter-store"

export interface ModuleSearchBarProps {
  /** Beschriftung des Suchfelds — benennt, was es durchsucht. */
  searchLabel?: string
  /**
   * Rechtsbuendiger Platz fuer die Steuerelemente des Moduls.
   *
   * Die Flaeche reicht hier ihr Portal-Ziel herein, das Modul portalt seine
   * Knoepfe hinein. Sie stehen damit in DERSELBEN Zeile wie die Suche, ohne
   * dass die Suche dem Modul gehoert.
   */
  trailing?: ReactNode
  className?: string
}

/**
 * Die Suche der Modulflaeche — eine Zeile, links das Feld, rechts die
 * Steuerelemente des Moduls.
 *
 * **Die Suche gehoert der Flaeche, nicht dem Modul** (Anton, 19.09.2026). Sie
 * zieht sich ausnahmslos durch alle Module und Linsen, hat mit dem
 * `FilterProvider` ohnehin schon einen flaechenweiten Zustand und wird deshalb
 * genau einmal gerendert: von der `ModuleFrame`. Vorher brachte jedes Modul
 * sie mit, und wo zwei Beitraege in denselben Kopf portalten — eine Fassung
 * vom Modul, eine von der Linse — standen zwei Suchfelder untereinander.
 *
 * Was das Modul beitraegt, sind seine EIGENEN Steuerelemente: Ansichtswechsel,
 * „Heute", der Ortungsknopf. Die kommen ueber `trailing` in dieselbe Zeile.
 *
 * Ohne Filter-Besitzer rendert sie nichts. Eine Flaeche ohne Besitzer hat
 * keine Suche; das ist kein Fehler, sondern der Fall „nackter `ModuleFrame` im
 * Test".
 */
export function ModuleSearchBar({ searchLabel = "Inhalte durchsuchen", trailing, className }: ModuleSearchBarProps) {
  const filter = useOptionalSharedFilter()
  if (!filter) return null
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Suche…"
          aria-label={searchLabel}
          value={filter.searchText}
          onChange={(event) => filter.setSearchText(event.target.value)}
          className="h-8 w-full rounded-md pl-8 text-[13px] sm:w-[220px]"
        />
      </div>
      {trailing}
    </div>
  )
}
