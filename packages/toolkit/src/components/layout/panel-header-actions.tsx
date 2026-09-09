"use client"

import { createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"

/**
 * Das DOM-Element in der Knopfleiste des umgebenden Panels, in das Inhalte
 * ihre eigenen Kopf-Aktionen legen duerfen. `null`, wenn kein Panel darueber
 * liegt (Story, Test, eingebettete Ansicht).
 */
export const PanelHeaderSlotContext = createContext<HTMLElement | null>(null)

export interface PanelHeaderActionsProps {
  children: ReactNode
}

/**
 * Haengt Aktionen in die Knopfleiste des umgebenden Panels — links neben
 * dessen eigene Knoepfe (Modus, Schliessen).
 *
 * **Warum nicht einfach oben in den Inhalt zeichnen.** Das Panel legt seine
 * Knoepfe absolut in die obere rechte Ecke. Ein Inhalt, der dort ebenfalls
 * etwas hinstellt, laeuft darunter — das ⋮-Menue lag genau unter dem ✕. Wieviel
 * Platz zu lassen waere, kann der Inhalt auch nicht wissen: Je nach Modus zeigt
 * das Panel einen, zwei oder drei Knoepfe.
 *
 * Also besitzt das Panel seine Leiste, und der Inhalt reicht hinein. Ohne Panel
 * darueber bleiben die Aktionen an Ort und Stelle, statt zu verschwinden.
 */
export function PanelHeaderActions({ children }: PanelHeaderActionsProps) {
  const slot = useContext(PanelHeaderSlotContext)
  if (!slot) return <>{children}</>
  return createPortal(children, slot)
}
