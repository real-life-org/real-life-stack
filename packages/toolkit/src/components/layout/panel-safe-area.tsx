"use client"

import type { ReactNode, CSSProperties } from "react"
import { cn } from "../../lib/utils"

export interface PanelSafeAreaProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Der Bereich einer vollflaechigen Modulflaeche, den ein offenes Panel NICHT
 * verdeckt.
 *
 * Module mit `panelFit: "overlay"` (Karte, Graph) bleiben absichtlich stehen,
 * wenn ein Panel aufgeht — ihre Flaeche IST der Inhalt. Alles, was AUF dieser
 * Flaeche schwebt, muss dagegen ausweichen: Suchleiste, Filter, Hinweise,
 * Ladeanzeige, FAB. Sonst liegt es unter dem Panel oder zentriert sich auf
 * eine Mitte, die halb verdeckt ist.
 *
 * Diese Flaeche macht das EINMAL statt an jedem Overlay: sie spannt sich ueber
 * die Modulflaeche, zieht die Panel-Insets ab, und alles darin rechnet wieder
 * mit normalem Layout — `justify-center` zentriert im Sichtbaren, `right-4`
 * sitzt am sichtbaren Rand.
 *
 * ```tsx
 * <PanelSafeArea className="z-20">
 *   <div className="flex justify-center p-3">…</div>
 * </PanelSafeArea>
 * ```
 *
 * Sie reicht Zeiger-Ereignisse durch (`pointer-events-none`); die Kinder
 * nehmen sie selbst wieder an, damit die Karte darunter bedienbar bleibt.
 */
export function PanelSafeArea({ children, className, style }: PanelSafeAreaProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-y-0 **:pointer-events-auto", className)}
      style={{
        left: "var(--adaptive-panel-margin-left, 0px)",
        right: "var(--adaptive-panel-margin-right, 0px)",
        // Dieselbe Dauer wie das Einruecken des Inhalts in AppShellMain, damit
        // Flaeche und Overlays sich gemeinsam bewegen statt nacheinander.
        transition: "left 300ms ease-out, right 300ms ease-out",
        ...style,
      }}
    >
      {children}
    </div>
  )
}
