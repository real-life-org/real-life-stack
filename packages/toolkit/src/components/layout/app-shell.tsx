"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: React.ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn("h-dvh flex flex-col bg-background overflow-hidden", className)}>
      {children}
    </div>
  )
}

interface AppShellMainProps {
  children: React.ReactNode
  className?: string
  /** Add padding at bottom for mobile bottom navigation */
  withBottomNav?: boolean
  /**
   * Weicht die Flaeche einem offenen Panel aus? Standard `true`.
   *
   * `false` fuer Module, deren Flaeche der Inhalt IST (Karte, Graph): das
   * Panel legt sich darueber, statt sie schmaler zu machen. Siehe
   * `ModulePanelFit` im Modul-Register.
   */
  inset?: boolean
}

/**
 * Die Padding-Animation gehoert dem Panel: sie zeigt, wie die Flaeche einem
 * auf- oder zugehenden Panel ausweicht. Wechselt dagegen die REGEL — weil ein
 * anderes Modul aktiv wird und `inset` umspringt — aendert sich das Padding,
 * ohne dass am Panel irgendetwas passiert waere. Animiert sieht man dann, wie
 * ein zu breit gestartetes Modul zusammenschnurrt (Karte -> Kalender) oder ein
 * zu schmales sich auf die volle Breite streckt (Kalender -> Karte). Deshalb:
 * beim Regelwechsel einmal ohne Uebergang setzen, danach wieder animiert.
 */
function useSprungOhneUebergang(wert: boolean): boolean {
  const [springt, setSpringt] = React.useState(false)
  const vorheriger = React.useRef(wert)

  // Vor dem Zeichnen, damit der Browser den neuen Wert gar nicht erst mit
  // eingeschaltetem Uebergang zu sehen bekommt.
  React.useLayoutEffect(() => {
    if (vorheriger.current === wert) return
    vorheriger.current = wert
    setSpringt(true)
  }, [wert])

  React.useEffect(() => {
    if (!springt) return
    // Zwei Bilder: das erste liegt noch VOR dem Zeichnen des Sprungs. Erst im
    // zweiten ist der neue Wert gemalt, und der Uebergang darf zurueck, ohne
    // ihn nachtraeglich doch noch zu animieren.
    let inneres = 0
    const aeusseres = requestAnimationFrame(() => {
      inneres = requestAnimationFrame(() => setSpringt(false))
    })
    return () => {
      cancelAnimationFrame(aeusseres)
      cancelAnimationFrame(inneres)
    }
  }, [springt])

  return springt
}

export function AppShellMain({
  children,
  className,
  withBottomNav = false,
  inset = true,
}: AppShellMainProps) {
  const springt = useSprungOhneUebergang(inset)
  return (
    <main
      className={cn(
        "@container flex-1 overflow-y-auto",
        "transition-[margin] duration-300 ease-out [.adaptive-panel-resizing_&]:transition-none",
        springt && "transition-none",
        withBottomNav && "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0",
        className
      )}
      style={
        // MARGIN, nicht Padding: Padding schob nur den INHALT ein, waehrend die
        // Flaeche selbst bis zum Fensterrand reichte — und mit ihr die
        // Scrollleiste, die dadurch im schmalen Spalt rechts neben dem Panel
        // klemmte. Als Margin endet die Flaeche dort, wo der Platz endet.
        //
        // `inset={false}`: die Flaeche bleibt stehen, das Panel legt sich
        // darueber. Fuer Module, deren Flaeche der Inhalt IST — eine Karte,
        // die beim Oeffnen eines Details schmaler wird, zeigt weniger Welt.
        // Die schwebenden Controls ruecken trotzdem ein, sie lesen die
        // Variable selbst.
        inset
          ? {
              marginRight: "var(--adaptive-panel-margin-right, 0px)",
              marginLeft: "var(--adaptive-panel-margin-left, 0px)",
            }
          : undefined
      }
    >
      {children}
    </main>
  )
}
