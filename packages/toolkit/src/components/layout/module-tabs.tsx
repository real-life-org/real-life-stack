"use client"

import { useLayoutEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import type { ModuleEntry } from "@/lib/module-register"

/**
 * Was ein Tab braucht — abgeleitet vom Registereintrag (Spec 01), damit es
 * keinen zweiten Icon-Vertrag gibt.
 */
export type Module = Pick<ModuleEntry, "id" | "label" | "icon">

/**
 * Passen die Tabs mit Text in den Platz, den die Kopfzeile ihnen laesst?
 *
 * Bis zum 24.09.2026 entschied das eine feste Schwelle (`lg`, 1024px). Die
 * kann nicht stimmen, weil die Breite an der Zahl der Module haengt: Ein Space
 * mit drei Modulen hat bei 1024px reichlich Platz, einer mit sieben lief dort
 * in das Nutzer-Menue. Gemessen statt geraten.
 */
export function tabsZeigenText(breiteMitText: number, platz: number): boolean {
  return breiteMitText <= platz
}

interface ModuleTabsProps {
  modules: Module[]
  activeModule: string
  onModuleChange: (moduleId: string) => void
  className?: string
}

export function ModuleTabs({
  modules,
  activeModule,
  onModuleChange,
  className,
}: ModuleTabsProps) {
  const leiste = useRef<HTMLElement>(null)
  const [mitText, setMitText] = useState(true)
  // Die Breite mit Text merken wir uns aus dem Zustand, in dem sie zu sehen
  // war — ohne Text koennten wir sie nicht mehr messen und wuessten nie, wann
  // der Text wieder passt.
  const breiteMitText = useRef<number | null>(null)

  useLayoutEffect(() => {
    breiteMitText.current = null
    setMitText(true)
  }, [modules])

  useLayoutEffect(() => {
    const nav = leiste.current
    if (!nav) return
    const platzgeber = nav.parentElement ?? nav
    const messen = () => {
      if (mitText) breiteMitText.current = nav.scrollWidth
      const noetig = breiteMitText.current
      const platz = platzgeber.clientWidth
      // Solange die Kopfzeile ausgeblendet ist (Telefon: `hidden md:flex`),
      // misst niemand etwas Sinnvolles.
      if (noetig == null || platz === 0) return
      setMitText(tabsZeigenText(noetig, platz))
    }
    messen()
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(platzgeber)
    return () => beobachter.disconnect()
  }, [mitText, modules])

  return (
    <nav ref={leiste} className={cn("hidden md:flex items-center gap-1", className)}>
      {modules.map((module) => {
        const Icon = module.icon
        const isActive = activeModule === module.id

        return (
          <button
            key={module.id}
            onClick={() => onModuleChange(module.id)}
            title={module.label}
            aria-label={module.label}
            className={cn(
              // `shrink-0`, damit die Messung stimmt: Ein Tab, der sich selbst
              // zusammendrueckt, meldet keinen Platzmangel.
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {/* Reicht der Platz nicht, tragen die Symbole allein; der Name
                steht als Titel daran. */}
            {mitText && <span>{module.label}</span>}
          </button>
        )
      })}
    </nav>
  )
}
