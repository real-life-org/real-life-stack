"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { FilterPill } from "../filter/filter-pill"
import { ModuleFilterChips } from "../filter/module-filter-chips"
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
  /**
   * Hat dieses Modul oben links eigene Bedienelemente (Zoom der Karte)?
   *
   * Dann rueckt die schwebende Kopfzeile daneben. Eine Angabe des Moduls, kein
   * zweiter Kopf: Die Flaeche bleibt der einzige Wirt.
   */
  clearsTopLeft?: boolean
  className?: string
}

/**
 * Der Beitrag eines Moduls zu seiner Flaeche — und seine Verteilung auf zwei
 * Orte (Design-Board 2a/2g):
 *
 *   - **Kopf** (oben): die eigenen Steuerelemente des Moduls rechts neben der
 *     Suche, darunter die aktiven Filter als entfernbare Chips.
 *   - **Schwebende Ecke** (unten links): die Filter-Pille, die die Auswahl
 *     oeffnet.
 *
 * **Die Suche ist hier NICHT dabei.** Sie zieht sich ausnahmslos durch alle
 * Module und Linsen und gehoert deshalb der Flaeche, die sie genau einmal
 * rendert (Anton, 19.09.2026). Vorher brachte jedes Modul sie mit — und wo
 * zwei Beitraege in denselben Kopf portalten, einer vom Modul und einer von
 * der Linse, standen zwei Suchfelder untereinander.
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
 * Ohne Flaeche darueber rendert sie beides an Ort und Stelle, statt spurlos zu
 * verschwinden (Spec 01, Regel 3). Das ist der Notausgang fuer die NACKTE
 * Leiste in Story und Test: Eine eingebettete Modulflaeche (Karte, Kalender in
 * apps/network) bringt ihre Flaeche mit `ModuleSurfaceScope` selbst mit — dort
 * stuende die Pille sonst oben unter der Suche statt unten links.
 */
export function ModuleToolbar({
  availableTags,
  availableTypes,
  drawerExtra,
  chipsExtra,
  trailingActions,
  clearsTopLeft = false,
  className,
}: ModuleToolbarProps) {
  const kopf = useOptionalModuleHead()

  const { value } = useSharedFilter()
  // Der Kopf bekommt nur wegen des Moduls eine Zeile, wenn das Modul etwas
  // beitraegt (Spec 01, Regel 4): eigene Steuerelemente oder ein aktiver
  // Filter. Die Suche zaehlt hier NICHT mit — sie gehoert der Flaeche und
  // steht ohnehin. Die Pille zaehlt auch nicht mit, sie haengt nicht am Kopf.
  const hatChips = value.tags.length > 0 || value.types.length > 0 || !!chipsExtra
  const hatKopfInhalt = !!trailingActions || hatChips

  const anmelden = kopf?.anmelden
  useEffect(() => {
    if (!hatKopfInhalt) return
    return anmelden?.({ raeumtObenLinks: clearsTopLeft })
  }, [anmelden, hatKopfInhalt, clearsTopLeft])

  const chips = hatKopfInhalt ? (
    <ModuleFilterChips availableTypes={availableTypes} chipsExtra={chipsExtra} />
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
        {trailingActions && kopf.actionsElement
          ? createPortal(trailingActions, kopf.actionsElement)
          : null}
        {chips && kopf.element ? createPortal(chips, kopf.element) : null}
        {kopf.controlsElement ? createPortal(pille, kopf.controlsElement) : null}
      </>
    )
  }

  // Ohne Flaeche darueber steht alles an Ort und Stelle. Die Suche fehlt hier
  // bewusst: Sie gehoert der Flaeche, und wo keine ist, gibt es sie nicht.
  return (
    <div data-module-toolbar className={cn("flex flex-col gap-3", className)}>
      {trailingActions && <div className="flex items-center justify-end gap-2">{trailingActions}</div>}
      {chips}
      {pille}
    </div>
  )
}
