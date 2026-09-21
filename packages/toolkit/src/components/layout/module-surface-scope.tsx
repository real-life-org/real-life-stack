"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Item } from "@real-life-stack/data-interface"

import { useSurfaceFilteredItems } from "../../hooks/use-filterable-items"
import { FilterScope } from "../filter/filter-store"
import { ModuleFrame, useOptionalModuleHead, type ModuleLayout } from "./module-frame"

export interface ModuleSurfaceScopeProps extends Partial<ModuleLayout> {
  /**
   * Die Items der Ansicht, roh. Die Flaeche wendet den geteilten Filter an
   * (Suche, Tags, Typen) und gibt sie ueber `useSurfaceItems()` zurueck; aus
   * ihnen entsteht ohne Connector auch das Vokabular.
   */
  items?: readonly Item[]
  /** @deprecated Seit 21.09.2026 `items` — dieselbe Liste, ein Name. */
  fallbackItems?: readonly Item[]
  children: ReactNode
}

const SurfaceItemsContext = createContext<Item[] | null>(null)

/**
 * Die Items dieser Flaeche, gefiltert wie der Kopf es anzeigt. Eine Lens
 * liest sie hier, statt den Filter selbst anzuwenden — dann kann sie ihn
 * nicht vergessen (Anton, 21.09.2026: die freistehende Liste suchte ins
 * Leere, weil nur das Modul darueber filterte).
 */
export function useSurfaceItems(): Item[] {
  const items = useContext(SurfaceItemsContext)
  if (!items) throw new Error("useSurfaceItems: kein <ModuleSurfaceScope items={…}> — die Flaeche stellt die gefilterten Items.")
  return items
}

function SurfaceItems({ items, children }: { items: readonly Item[]; children: ReactNode }) {
  const gefiltert = useSurfaceFilteredItems(items)
  return <SurfaceItemsContext.Provider value={gefiltert}>{children}</SurfaceItemsContext.Provider>
}

/**
 * Alles, was eine Modulflaeche braucht und normalerweise die App stellt:
 * einen Besitzer fuer den Filter, die Flaeche selbst (Kopf und schwebende
 * Ecke) — und das ANWENDEN des Filters auf die Items.
 *
 * **Warum EINE Huelle und nicht zwei.** Beide sagen dasselbe — „bring mit, was
 * sonst die App stellt" — und sie gehoeren zusammen, weil das eine ohne das
 * andere kaputt ist: Eine eingebettete Flaeche mit Frame, aber ohne
 * Filter-Besitzer, wirft in dem Moment, in dem ihre `ModuleToolbar` rendert.
 * Wer die eine Huelle setzt und die andere vergisst, haette also genau den
 * Fehler gebaut, den sie verhindern soll.
 *
 * Unter der App-Shell reicht sie beides durch: Der `FilterScope` findet den
 * app-weiten Zustand, und ein vorhandener Frame-Kontext heisst, dass die
 * Flaeche schon da ist. Ein zweiter Frame darin haette einen zweiten Kopf und
 * eine zweite Ecke — genau die Doppelung, gegen die der Frame gebaut ist.
 * Die Items filtert sie auch dort — idempotent, denn der Host hat es schon
 * getan; so haengt die Lens an keiner Annahme darueber, wer ueber ihr steht.
 *
 * Die Layout-Angaben (`fill`, `panelFit`, `maxWidth`) gibt der Aufrufer
 * direkt: Ausserhalb der App gibt es keine Registereintrag-Id, an der sie
 * haengen koennten.
 */
export function ModuleSurfaceScope({ children, items, fallbackItems, ...layout }: ModuleSurfaceScopeProps) {
  const flaeche = useOptionalModuleHead()
  const roh = items ?? fallbackItems ?? []
  const inhalt = <SurfaceItems items={roh}>{children}</SurfaceItems>
  return (
    <FilterScope>
      {flaeche ? inhalt : <ModuleFrame {...layout} fallbackItems={roh}>{inhalt}</ModuleFrame>}
    </FilterScope>
  )
}
