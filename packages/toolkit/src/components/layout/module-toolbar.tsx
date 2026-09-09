"use client"

import { createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"

/**
 * Das DOM-Element im Kopf der Modulflaeche, in das ein Modul seine
 * Steuerleiste legt. `null`, wenn keine Flaeche darueber liegt (Story, Test,
 * eingebettete Ansicht).
 */
export const ModuleToolbarSlotContext = createContext<HTMLElement | null>(null)

export interface ModuleToolbarProps {
  children: ReactNode
}

/**
 * Die Steuerleiste eines Moduls — Filter, Suche, Ansichtswechsel.
 *
 * **Warum sie nicht einfach oben im Inhalt steht.** Dort scrollte sie mit weg:
 * Wer weit unten in einer langen Liste nach etwas filtern will, muss erst nach
 * oben zurueck. Sie gehoert also aus dem Scrollbereich heraus.
 *
 * Sie oben im Modul `sticky` zu machen waere der billigere Weg gewesen — aber
 * dann loest ihn jedes Modul selbst, und die sieben Loesungen driften
 * auseinander. Stattdessen besitzt die Flaeche ihren Kopf, und das Modul
 * reicht hinein. Ohne Flaeche darueber bleibt die Leiste an Ort und Stelle,
 * statt spurlos zu verschwinden.
 *
 * Schwester von `PanelHeaderActions`: dort reicht ein Inhalt in die
 * Knopfleiste des Panels, hier in den Kopf der Modulflaeche.
 */
export function ModuleToolbar({ children }: ModuleToolbarProps) {
  const slot = useContext(ModuleToolbarSlotContext)
  if (!slot) return <>{children}</>
  return createPortal(children, slot)
}
