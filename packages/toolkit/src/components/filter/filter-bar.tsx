"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Filter, Layers } from "lucide-react"
import { Button } from "../primitives/button"
import { cn } from "../../lib/utils"
import { TagChip } from "../tag/tag-chip"
import { FilterChip } from "./filter-building-blocks"
import { FilterCardSections } from "./filter-card"
import type { FilterBarValue, FilterTypeOption } from "./types"

/**
 * `FilterBar` — shared filter surface for every Space Module.
 *
 * Spec: `docs/spec/modules/shared-components.md` → `FilterBar`.
 *
 * **Nicht die Steuerung einer Modulflaeche** — die ist seit dem Design-Board
 * die schwebende `FilterPill` unten links. Diese Leiste bleibt fuer Flaechen,
 * die ihren Filterwert selbst halten (Stories, eingebettete Ansichten,
 * apps/network): Knopf + Auswahl als Popover darunter, aktive Chips in einer
 * eigenen Zeile.
 *
 * Layout pattern (chosen with Anton on 11.06.2026):
 * - A row of active-filter chips with `✕` to remove individually.
 *   When no filter is active the row collapses.
 * - A trigger button opens the filter sections in a popover below it —
 *   denselben Inhalt wie die Filter-Karte (`FilterCardSections`).
 *
 * Controlled component: `value` lives in the caller, the bar emits
 * partial updates via `onChange`. View-specific persistence (URL
 * params, localStorage, etc.) stays the caller's job.
 *
 * Module-specific filters compose via two slots:
 * - `chipsExtra`: shown after the common chips. Reuse `<FilterChip>`
 *   for visual consistency.
 * - `drawerExtra`: beliebiger Inhalt unter den gemeinsamen Sektionen des
 *   Popovers. Die Bausteine `<FilterSection>` + `<FilterMultiSelect>` /
 *   `<FilterToggle>` gelten dort weiter — die Sektionen der Karte tragen
 *   dieselbe Anatomie (Label 11px, gesperrt, Grossbuchstaben; Optionen als
 *   umbrechende Chips), also fuegt sich ein damit gebautes Extra ein, statt
 *   daneben zu stehen.
 */
export interface FilterBarProps {
  value: FilterBarValue
  onChange: (next: FilterBarValue) => void
  /** Tags available for selection (e.g. derived from current items). */
  availableTags?: readonly string[]
  /** Item-type options the module wants to expose. */
  availableTypes?: readonly FilterTypeOption[]
  /** Optional active-state chips for module-specific filters. */
  chipsExtra?: ReactNode
  /** Modul-eigene Sektionen im Popover (siehe Kopfkommentar). */
  drawerExtra?: ReactNode
  /**
   * Optional actions directly next to the Filter button (left side).
   * Search belongs here — Sebastian-Konsens 12.06.2026: Filter und Suche
   * gehören visuell zusammen.
   */
  leadingActions?: ReactNode
  /** Optional trailing actions in the trigger row (e.g. "Multiselect"). */
  trailingActions?: ReactNode
  className?: string
}

export function FilterBar({
  value,
  onChange,
  availableTags,
  availableTypes,
  chipsExtra,
  drawerExtra,
  leadingActions,
  trailingActions,
  className,
}: FilterBarProps) {
  const [offen, setOffen] = useState(false)
  const huelle = useRef<HTMLDivElement | null>(null)

  // Escape und Klick daneben schliessen — die Auswahl ist ein Popover, kein
  // Modal: Der Inhalt darunter bleibt bedienbar.
  useEffect(() => {
    if (!offen) return
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false)
    }
    const daneben = (e: Event) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false)
    }
    document.addEventListener("keydown", taste)
    document.addEventListener("pointerdown", daneben)
    return () => {
      document.removeEventListener("keydown", taste)
      document.removeEventListener("pointerdown", daneben)
    }
  }, [offen])

  const typeLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of availableTypes ?? []) map.set(t.id, t.label)
    return map
  }, [availableTypes])

  const updateTags = (next: string[]) => onChange({ ...value, tags: next })
  const updateTypes = (next: string[]) => onChange({ ...value, types: next })

  // Dedupe before rendering — a caller that accidentally passes the
  // same tag/type twice would otherwise produce duplicate React keys
  // and visible duplicate chips. Filter logic already treats both as
  // sets.
  const uniqueTagIds = useMemo(() => Array.from(new Set(value.tags)), [value.tags])
  const uniqueTypeIds = useMemo(() => Array.from(new Set(value.types)), [value.types])

  const activeTagChips = uniqueTagIds.map((tag) => (
    <TagChip
      key={`tag-${tag}`}
      tag={tag}
      size="md"
      onRemove={() => updateTags(value.tags.filter((t) => t !== tag))}
    />
  ))

  const activeTypeChips = uniqueTypeIds.map((typeId) => (
    <FilterChip
      key={`type-${typeId}`}
      label={typeLabelById.get(typeId) ?? typeId}
      icon={<Layers className="h-3 w-3" />}
      onRemove={() => updateTypes(value.types.filter((t) => t !== typeId))}
    />
  ))

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Controls — one row that never wraps: the Filter button and the
          trailing actions keep their size while the leading actions (search)
          flex to fill the remaining width on mobile, so the trailing buttons
          can't get pushed onto a second line. */}
      <div className="flex items-center gap-2">
        {/* Die Auswahl haengt unter ihrem Knopf, statt das app-weite Panel zu
            belegen: Diese Leiste laeuft auch dort, wo es keins gibt (Story,
            eingebettete Ansicht) — und ein Filter, der die Detailflaeche
            verdraengt, kostet mehr, als er zeigt. Denselben Inhalt zeigt die
            Filter-Karte der Modulflaeche (`FilterCardSections`). */}
        <div ref={huelle} className="relative shrink-0">
          <Button
            variant="outline"
            size="sm"
            aria-expanded={offen}
            onClick={() => setOffen((war) => !war)}
          >
            <Filter className="h-4 w-4 mr-1.5" />
            Filter
          </Button>
          {offen && (
            <div
              data-filter-card
              className="absolute left-0 top-full z-40 mt-2 flex w-[232px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
            >
              <FilterCardSections
                value={value}
                onChange={onChange}
                availableTags={availableTags}
                availableTypes={availableTypes}
                extra={drawerExtra}
                onClose={() => setOffen(false)}
              />
            </div>
          )}
        </div>

        {leadingActions && (
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">{leadingActions}</div>
        )}

        {trailingActions && (
          <div className="ml-auto flex shrink-0 items-center gap-2">{trailingActions}</div>
        )}
      </div>

      {/* Active-filter chips on their own row so they wrap freely without
          crowding the controls.

          `empty:hidden`, nicht `hasAnyChips`: Kanban und Kalender uebergeben
          `chipsExtra` immer als Fragment, auch wenn darin gerade nichts aktiv
          ist. Eine Zeile ohne Kinder nahm dann 0px ein, aber die 8px Luecke
          davor blieb — die Steuerleiste war dort 8px hoeher als im Feed.
          Ob die Zeile Platz braucht, entscheidet das DOM, nicht der Aufrufer. */}
      <div data-filter-chips className="flex flex-wrap items-center gap-1.5 empty:hidden">
        {activeTagChips}
        {activeTypeChips}
        {chipsExtra}
      </div>

    </div>
  )
}
