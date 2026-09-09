"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Filter } from "lucide-react"

import { cn } from "../../lib/utils"
import { FilterCardSections } from "./filter-card"
import { useSharedFilter } from "./filter-store"
import type { FilterTypeOption } from "./types"

export interface FilterPillProps {
  availableTags?: readonly string[]
  availableTypes?: readonly FilterTypeOption[]
  /** Modul-eigene Abschnitte in der Karte. */
  drawerExtra?: ReactNode
  className?: string
}

/**
 * Der Filter einer Modulflaeche: eine Pille unten links, die bei einem Klick
 * an Ort und Stelle zur Karte morpht (Design-Board 2a → 2g).
 *
 * **Warum unten und nicht im Kopf.** Der Kopf ist die Zeile ueber dem Inhalt;
 * alles, was dort steht, verkleinert ihn. Filtern ist aber ein Werkzeug, kein
 * Inhalt — es schwebt ueber der Flaeche, wie die Steuerung der Karte, und
 * nimmt ihr im Ruhezustand 48px in einer Ecke weg statt eine ganze Zeile.
 *
 * Die Pille OEFFNET nur; was gerade filtert, steht als Chip-Zeile im Kopf der
 * Flaeche (`ModuleFilterChips`) — in Blickrichtung des Inhalts, den es
 * beschneidet. In der offenen Karte sind dieselben Filter zusaetzlich als
 * gewaehlte Chips zu sehen.
 *
 * **Die Form springt, der Inhalt blendet ein.** Erst wanderten Breite, Radius
 * und Schatten ueber 300ms — und den ganzen Weg lang stand der Karteninhalt im
 * schmalen Pillen-Umriss mit 99px-Radius: Es sah eine Sekunde lang kaputt aus.
 * Inhalt darf erst erscheinen, wenn die Form fertig ist; von den beiden
 * Moeglichkeiten (Form animieren und Inhalt verzoegert einblenden ODER Form
 * setzen und kurz ueberblenden) ist die zweite die ehrliche: Eine wachsende
 * leere Huelle waere auch nur ein anderer Zwischenzustand, und ihre Hoehe
 * spraenge beim Erscheinen des Inhalts trotzdem.
 */
export function FilterPill({
  availableTags,
  availableTypes,
  drawerExtra,
  className,
}: FilterPillProps) {
  const { value, setValue } = useSharedFilter()
  const [offen, setOffen] = useState(false)
  const huelle = useRef<HTMLDivElement | null>(null)

  // Escape und ein Klick daneben schliessen — beides, weil die Karte kein
  // Modal ist: Sie liegt ueber dem Inhalt, den man weiter bedienen darf.
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

  // Der Fokus geht in die Karte, sonst bliebe er auf einer Pille, die es
  // gerade nicht mehr gibt — und Escape liefe ins Leere.
  useEffect(() => {
    if (!offen) return
    huelle.current?.querySelector<HTMLElement>("[aria-label='Filter schließen']")?.focus()
  }, [offen])

  return (
    <div className={cn("flex items-end", className)}>
      <div
        ref={huelle}
        data-filter-pill
        className={cn(
          "overflow-hidden border border-border bg-card text-foreground",
          // Die Form steht sofort; nur der Inhalt blendet kurz ein (unten).
          offen ? "w-[232px] rounded-2xl shadow-xl" : "w-auto rounded-full shadow-lg",
        )}
      >
        {offen ? (
          <div
            data-filter-card
            // Hoehe begrenzt: Ein Space mit vielen Tags liesse die Karte
            // sonst oben aus der Flaeche laufen — sie waechst von unten.
            className="flex max-h-[70vh] animate-in flex-col overflow-y-auto fade-in duration-150 motion-reduce:animate-none"
          >
            <FilterCardSections
              value={value}
              onChange={setValue}
              availableTags={availableTags}
              availableTypes={availableTypes}
              extra={drawerExtra}
              onClose={() => setOffen(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            data-filter-pill-trigger
            onClick={() => setOffen(true)}
            aria-expanded={false}
            className="flex h-12 items-center gap-2 px-[18px] text-sm font-medium"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        )}
      </div>

    </div>
  )
}
