"use client"

import type { ReactNode } from "react"
import { Layers } from "lucide-react"

import { cn } from "../../lib/utils"
import { TagChip } from "../tag/tag-chip"
import { FilterChip } from "./filter-building-blocks"
import { useSharedFilter } from "./filter-store"
import type { FilterTypeOption } from "./types"

export interface ModuleFilterChipsProps {
  /** Labels der Typen — ohne sie stuende im Chip die rohe Id. */
  availableTypes?: readonly FilterTypeOption[]
  /** Modul-eigene Chips (z.B. „Nur meine"). */
  chipsExtra?: ReactNode
  className?: string
}

/**
 * Die aktiven Filter, im Kopf der Modulflaeche — jeder einzeln entfernbar.
 *
 * **Warum oben und nicht unten bei der Pille.** Was gerade filtert, gehoert in
 * Blickrichtung des Inhalts, den es beschneidet: Wer eine kurze Liste sieht,
 * liest die Erklaerung dafuer ueber der Liste, nicht in der unteren Ecke. Die
 * Pille unten oeffnet die Auswahl, sie traegt sie nicht.
 *
 * `empty:hidden`, nicht `length > 0`: Ob die Zeile Platz braucht, entscheidet
 * das DOM — Module uebergeben `chipsExtra` oft als Fragment, in dem gerade
 * nichts steckt.
 */
export function ModuleFilterChips({ availableTypes, chipsExtra, className }: ModuleFilterChipsProps) {
  const { value, setValue } = useSharedFilter()
  const label = new Map((availableTypes ?? []).map((t) => [t.id, t.label]))
  return (
    <div
      data-filter-chips
      className={cn("flex flex-wrap items-center gap-1.5 empty:hidden", className)}
    >
      {[...new Set(value.tags)].map((tag) => (
        <TagChip
          key={`tag-${tag}`}
          tag={tag}
          size="md"
          onRemove={() => setValue({ ...value, tags: value.tags.filter((t) => t !== tag) })}
        />
      ))}
      {[...new Set(value.types)].map((typ) => (
        <FilterChip
          key={`type-${typ}`}
          label={label.get(typ) ?? typ}
          icon={<Layers className="h-3 w-3" />}
          onRemove={() => setValue({ ...value, types: value.types.filter((t) => t !== typ) })}
        />
      ))}
      {chipsExtra}
    </div>
  )
}
