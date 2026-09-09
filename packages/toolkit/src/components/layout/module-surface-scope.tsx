"use client"

import type { ReactNode } from "react"

import { FilterScope } from "../filter/filter-store"
import { ModuleFrame, useOptionalModuleHead, type ModuleLayout } from "./module-frame"

export interface ModuleSurfaceScopeProps extends Partial<ModuleLayout> {
  children: ReactNode
}

/**
 * Alles, was eine Modulflaeche braucht und normalerweise die App stellt:
 * einen Besitzer fuer den Filter und die Flaeche selbst (Kopf und schwebende
 * Ecke).
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
 *
 * Die Layout-Angaben (`fill`, `panelFit`, `maxWidth`) gibt der Aufrufer
 * direkt: Ausserhalb der App gibt es keine Registereintrag-Id, an der sie
 * haengen koennten.
 */
export function ModuleSurfaceScope({ children, ...layout }: ModuleSurfaceScopeProps) {
  const flaeche = useOptionalModuleHead()
  return (
    <FilterScope>
      {flaeche ? children : <ModuleFrame {...layout}>{children}</ModuleFrame>}
    </FilterScope>
  )
}
