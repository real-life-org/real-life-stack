"use client"

import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { cn } from "../../lib/utils"
import { useOptionalModuleHead } from "./module-frame"

export interface ModuleToolbarProps {
  /** Modul-eigene Abschnitte in der Filterkarte (Ort, Zuweisung). */
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
   * Dann rueckt die schwebende Kopfzeile daneben. Eine Angabe des Moduls ueber
   * SEINE Flaeche — unabhaengig davon, ob es gerade etwas in den Kopf reicht
   * (Codex-Review zu rls#405).
   */
  clearsTopLeft?: boolean
  className?: string
}

/**
 * Was ein Modul zu seiner Flaeche beitraegt — und nur das.
 *
 * Drei Dinge, an drei Orte gereicht:
 *
 *   - `trailingActions` → rechts NEBEN der Suche, in derselben Zeile
 *   - `chipsExtra` → neben die aktiven Filter, in der Chip-Zeile
 *   - `drawerExtra` → in die Filterkarte, unter die Tags und Typen
 *
 * **Was NICHT mehr dazugehoert.** Suche, Filterkarte, die Chips der aktiven
 * Filter und das Vokabular (welche Tags und Typen es gibt) gehoeren der
 * FLAECHE (Spec 01, Regel 2a). Sie ziehen sich durch alle Module, lesen den
 * geteilten Filterzustand und werden genau einmal gerendert. Vorher brachte
 * jedes Modul sie mit: `availableTags` stand siebenmal im Code,
 * `availableTypes` viermal — Kanban sortierte nicht, der Kalender gab keine
 * Farbe mit, und die Karte nannte den Typ „event" anders als alle anderen.
 *
 * Ohne Flaeche darueber rendert sie den Beitrag an Ort und Stelle, statt
 * spurlos zu verschwinden (Spec 01, Regel 3). Was der Flaeche gehoert, gibt es
 * dort nicht — auch keine Filterkarte.
 */
export function ModuleToolbar({
  drawerExtra,
  chipsExtra,
  trailingActions,
  clearsTopLeft = false,
  className,
}: ModuleToolbarProps) {
  const kopf = useOptionalModuleHead()

  // Der Kopf bekommt nur WEGEN DES MODULS eine Zeile, wenn das Modul etwas
  // beitraegt (Spec 01, Regel 4). Suche und aktive Filter zaehlen nicht mit —
  // sie gehoeren der Flaeche und stehen ohnehin.
  const hatKopfInhalt = !!trailingActions || !!chipsExtra

  const anmelden = kopf?.anmelden
  useEffect(() => {
    if (!hatKopfInhalt) return
    return anmelden?.()
  }, [anmelden, hatKopfInhalt])

  // Getrennt vom Kopf-Beitrag: Dass die Karte oben links ihre Zoom-Knoepfe
  // fuehrt, gilt auch dann, wenn sie gerade nichts in den Kopf reicht.
  const raeumeObenLinks = kopf?.raeumeObenLinks
  useEffect(() => {
    if (!clearsTopLeft) return
    return raeumeObenLinks?.()
  }, [raeumeObenLinks, clearsTopLeft])

  if (kopf) {
    return (
      <>
        {trailingActions && kopf.actionsElement
          ? createPortal(trailingActions, kopf.actionsElement)
          : null}
        {chipsExtra && kopf.chipsElement ? createPortal(chipsExtra, kopf.chipsElement) : null}
        {drawerExtra && kopf.drawerElement ? createPortal(drawerExtra, kopf.drawerElement) : null}
      </>
    )
  }

  return (
    <div data-module-toolbar className={cn("flex flex-col gap-3", className)}>
      {trailingActions && <div className="flex items-center justify-end gap-2">{trailingActions}</div>}
      {chipsExtra && <div className="flex flex-wrap items-center gap-1.5">{chipsExtra}</div>}
      {drawerExtra}
    </div>
  )
}
