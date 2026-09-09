"use client"

import type { ReactNode } from "react"
import { Search } from "lucide-react"

import { cn } from "../../lib/utils"
import { Input } from "../primitives/input"
import { useSharedFilter } from "./filter-store"

export interface ModuleSearchBarProps {
  /**
   * Zeigt die Zeile ein Suchfeld? Standard ja.
   *
   * Getrennt von den Aktionen schaltbar: Eine Flaeche, in der eine Suche
   * nichts zu tun haette, soll trotzdem ihre Modul-Aktionen zeigen koennen.
   */
  search?: boolean
  /** Beschriftung des Suchfelds — benennt die Flaeche, die es durchsucht. */
  searchLabel?: string
  /** Rechtsbuendige Modul-Aktionen (Ansichtswechsel, Einstellungen, „Heute"). */
  trailingActions?: ReactNode
  className?: string
}

/**
 * Suche links, Modul-Aktionen rechts — der ganze Inhalt des Modulkopfes.
 *
 * Der Filter ist hier NICHT mehr dabei: Er schwebt als Pille unten links
 * (`FilterPill`, Design-Board 2a/2g). Was bleibt, ist die Zeile, die im Board
 * oben links steht: ein 220px breites Feld, 32px hoch.
 *
 * Sie liest den geteilten Suchtext (`FilterProvider`), damit ein Wort, das im
 * Feed eingetippt wurde, im Kanban weiterfiltert.
 */
export function ModuleSearchBar({
  search = true,
  searchLabel = "Inhalte durchsuchen",
  trailingActions,
  className,
}: ModuleSearchBarProps) {
  const { searchText, setSearchText } = useSharedFilter()
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {search && (
      <div className="relative min-w-0 flex-1 sm:flex-none">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Suche…"
          aria-label={searchLabel}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          className="h-8 w-full rounded-md pl-8 text-[13px] sm:w-[220px]"
        />
      </div>
      )}
      {trailingActions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">{trailingActions}</div>
      )}
    </div>
  )
}
