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

export function AppShellMain({
  children,
  className,
  withBottomNav = false,
  inset = true,
}: AppShellMainProps) {
  return (
    <main
      className={cn(
        "@container flex-1 overflow-y-auto",
        "transition-[padding] duration-300 ease-out [.adaptive-panel-resizing_&]:transition-none",
        withBottomNav && "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0",
        className
      )}
      style={
        // `inset={false}`: die Flaeche bleibt stehen, das Panel legt sich
        // darueber. Fuer Module, deren Flaeche der Inhalt IST — eine Karte,
        // die beim Oeffnen eines Details schmaler wird, zeigt weniger Welt.
        // Die schwebenden Controls ruecken trotzdem ein, sie lesen die
        // Variable selbst.
        inset
          ? {
              paddingRight: "var(--adaptive-panel-margin-right, 0px)",
              paddingLeft: "var(--adaptive-panel-margin-left, 0px)",
            }
          : undefined
      }
    >
      {children}
    </main>
  )
}
