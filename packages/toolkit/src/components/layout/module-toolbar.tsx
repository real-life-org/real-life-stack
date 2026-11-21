"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"

import { useOptionalSharedFilter } from "../filter/filter-store"
import { cn } from "../../lib/utils"
import { useOptionalModuleHead } from "./module-frame"

export interface ModuleToolbarProps {
  /**
   * Modul-eigene Abschnitte in der Filterkarte (Ort, Zuweisung).
   *
   * Wie `chipsExtra` nur uebergeben, wenn es etwas zu zeigen gibt: Ohne
   * Filter-Besitzer ueber der Flaeche gibt es keine Filterkarte, und ein
   * uebergebener Abschnitt wird als verloren gemeldet (rls#570) — ein leeres
   * Fragment laesst sich von aussen nicht von einem vollen unterscheiden.
   */
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

  // Beitraege ohne Ziel werden gezeichnet oder gemeldet, nie still verworfen
  // (rls#570). Die Aktionen und eigenen Chips zeichnet der Kopf auch ohne
  // Filter-Besitzer; zwei Faelle bleiben, die nur eine Meldung retten kann.
  const siehtBesitzer = !!useOptionalSharedFilter()
  const hatDrawerExtra = !!drawerExtra
  const ohneBesitzer = !!kopf && !kopf.hatFilterBesitzer
  const gemeldet = useRef(false)
  useEffect(() => {
    if (!ohneBesitzer || gemeldet.current) return
    const meldung = warnungOhneBesitzer({ fehlverschachtelt: siehtBesitzer, drawerExtra: hatDrawerExtra })
    if (!meldung) return
    gemeldet.current = true
    console.warn(meldung)
  }, [ohneBesitzer, siehtBesitzer, hatDrawerExtra])

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

// i18n-exempt: Konsolenwarnung an Modul-Autoren
const ABHILFE =
  "Abhilfe: FilterScope außerhalb von ModuleFrame setzen, um Leiste UND Inhalt herum " +
  "(oder ModuleSurfaceScope, das beides mitbringt)."

/**
 * Der Text der Warnung, wenn die Flaeche keinen Filter-Besitzer hat — `null`,
 * wenn es nichts zu melden gibt.
 *
 * Zwei Faelle:
 *
 *   - **Fehlverschachtelt.** Das Modul sieht einen Besitzer, die Flaeche
 *     nicht: Ein `FilterScope` steht innerhalb des `ModuleFrame` (so im
 *     Karabirrdt). Der Kopf zeichnet die Aktionen zwar, aber Suche, Chips und
 *     Pille fehlen, und niemand merkt warum.
 *   - **`drawerExtra` ohne Ziel.** Ohne Besitzer gibt es keine Pille und damit
 *     keine Filterkarte; der Abschnitt haette keinen Ort.
 *
 * Ein nackter Frame ohne Besitzer, dessen Modul nur Aktionen oder Chips
 * reicht, ist KEIN Fall: Das ist der Test- und Story-Fall aus Spec 01,
 * Regel 4, und alles, was er beitraegt, steht.
 */
// i18n-exempt: Konsolenwarnung an Modul-Autoren
function warnungOhneBesitzer(fall: { fehlverschachtelt: boolean; drawerExtra: boolean }): string | null {
  if (fall.fehlverschachtelt) {
    return (
      "[rls] ModuleToolbar: Das Modul hat einen Filter-Besitzer, seine ModuleFrame nicht — " +
      "Suche, aktive Filter und Filter-Pille fehlen. " +
      ABHILFE
    )
  }
  if (fall.drawerExtra) {
    return (
      "[rls] ModuleToolbar: drawerExtra hat kein Ziel — ohne Filter-Besitzer über der " +
      "ModuleFrame gibt es keine Filterkarte. " +
      ABHILFE
    )
  }
  return null
}
