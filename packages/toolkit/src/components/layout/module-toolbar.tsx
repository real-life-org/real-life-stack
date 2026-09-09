"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { FilterPill } from "../filter/filter-pill"
import { ModuleFilterChips } from "../filter/module-filter-chips"
import { ModuleSearchBar } from "../filter/module-search-bar"
import { useSharedFilter } from "../filter/filter-store"
import type { FilterTypeOption } from "../filter/types"
import { cn } from "../../lib/utils"
import { useOptionalModuleHead } from "./module-frame"

export interface ModuleToolbarProps {
  /** Tags zur Auswahl in der Filter-Karte. */
  availableTags?: readonly string[]
  /** Welche Typ-Chips dieses Modul anbietet (Spec shared-components, Regel 4). */
  availableTypes?: readonly FilterTypeOption[]
  /** Modul-eigene Abschnitte in der Filter-Karte. */
  drawerExtra?: ReactNode
  /**
   * Modul-eigene Chips in der Chip-Zeile des Kopfes.
   *
   * **Nur uebergeben, wenn wirklich etwas aktiv ist** (`myItemsOnly ? <…/> :
   * undefined`) — nie ein Fragment, das gerade nichts rendert. Daran haengt,
   * ob der Kopf ueberhaupt eine Zeile bekommt (Spec 01, Regel 4); ein leeres
   * Fragment liesse sich von aussen nicht von einem vollen unterscheiden und
   * ergaebe eine unsichtbare Zeile mit sichtbarem Polster.
   */
  chipsExtra?: ReactNode
  /** Rechtsbuendige Modul-Aktionen im Kopf (Ansicht, Einstellungen, „Heute"). */
  trailingActions?: ReactNode
  /** Beschriftung des Suchfelds — benennt die Flaeche, die es durchsucht. */
  searchLabel?: string
  /**
   * Hat dieses Modul oben links eigene Bedienelemente (Zoom der Karte)?
   *
   * Dann rueckt die schwebende Kopfzeile daneben. Eine Angabe des Moduls, kein
   * zweiter Kopf: Die Flaeche bleibt der einzige Wirt.
   */
  clearsTopLeft?: boolean
  /**
   * Sucht dieses Modul? Standard ja.
   *
   * `false` fuer Flaechen, in denen ein Suchfeld nichts zu tun haette — dann
   * bleibt der Kopf leer und verschwindet, waehrend die Filter-Pille steht.
   */
  search?: boolean
  className?: string
}

/**
 * Der eine Beitrag eines Moduls zu seiner Flaeche — und ihre Verteilung auf
 * zwei Orte (Design-Board 2a/2g):
 *
 *   - **Kopf** (oben): Suche und Modul-Aktionen in der ersten Zeile, darunter
 *     die aktiven Filter als entfernbare Chips.
 *   - **Schwebende Ecke** (unten links): die Filter-Pille, die die Auswahl
 *     oeffnet.
 *
 * **Warum der Filter-KNOPF nicht mehr im Kopf steht.** Er ist ein Werkzeug,
 * kein Zustand: Im Ruhezustand nimmt er als Pille eine Ecke ein statt einer
 * Zeile ueber dem Inhalt. Was gerade FILTERT, bleibt dagegen oben — in
 * Blickrichtung des Inhalts, den es beschneidet.
 *
 * Der ZUSTAND bleibt beim Modul: Beides wird per Portal hineingereicht, nicht
 * als Datenpaket nach oben gegeben. Ein Ansichtswechsel im Kopf schaltet
 * damit weiter den State des Moduls, das ihn besitzt.
 *
 * Ohne Flaeche darueber (Story, Test, eingebettete Ansicht) rendert sie beides
 * an Ort und Stelle, statt spurlos zu verschwinden (Spec 01, Regel 3).
 */
export function ModuleToolbar({
  availableTags,
  availableTypes,
  drawerExtra,
  chipsExtra,
  trailingActions,
  searchLabel,
  search = true,
  clearsTopLeft = false,
  className,
}: ModuleToolbarProps) {
  const kopf = useOptionalModuleHead()

  const { value } = useSharedFilter()
  // Der Kopf bekommt nur eine Zeile, wenn etwas hineingehoert (Spec 01,
  // Regel 4): Suche, Modul-Aktionen oder ein aktiver Filter. Die Pille zaehlt
  // nicht mit — sie haengt nicht am Kopf.
  const hatZeile = search || !!trailingActions
  const hatChips = value.tags.length > 0 || value.types.length > 0 || !!chipsExtra
  const hatKopfInhalt = hatZeile || hatChips

  const anmelden = kopf?.anmelden
  useEffect(() => {
    if (!hatKopfInhalt) return
    return anmelden?.({ raeumtObenLinks: clearsTopLeft })
  }, [anmelden, hatKopfInhalt, clearsTopLeft])

  const kopfinhalt = hatKopfInhalt ? (
    <div className="flex flex-col gap-2">
      {hatZeile && (
        <ModuleSearchBar search={search} searchLabel={searchLabel} trailingActions={trailingActions} />
      )}
      <ModuleFilterChips availableTypes={availableTypes} chipsExtra={chipsExtra} />
    </div>
  ) : null
  const pille = (
    <FilterPill
      availableTags={availableTags}
      availableTypes={availableTypes}
      drawerExtra={drawerExtra}
    />
  )

  if (kopf) {
    return (
      <>
        {kopfinhalt && kopf.element ? createPortal(kopfinhalt, kopf.element) : null}
        {kopf.controlsElement ? createPortal(pille, kopf.controlsElement) : null}
      </>
    )
  }

  return (
    <div data-module-toolbar className={cn("flex flex-col gap-3", className)}>
      {kopfinhalt}
      {pille}
    </div>
  )
}
