"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"

import { ModuleFilterBar, type ModuleFilterBarProps } from "../filter/module-filter-bar"
import { cn } from "../../lib/utils"
import { useOptionalModuleHead } from "./module-frame"

export interface ModuleToolbarProps extends Omit<ModuleFilterBarProps, "searchLabel"> {
  className?: string
}

/**
 * Der Beitrag eines Moduls zum Kopf der Modulflaeche — Filter, Suche,
 * Ansichtswechsel.
 *
 * **Warum Kopf und nicht mehr `sticky`.** Die Leiste klebte frueher IM
 * Scrollbereich des Moduls. Sichtbar wurde das an der Scrollleiste: Sie lief
 * hinter der Leiste bis zur Navbar hoch, obwohl dort nichts mehr scrollt. Und
 * jedes Modul musste den Container-Abstand selbst ausgleichen
 * (`-mx-4 -mt-4 pt-4 pb-4 mb-0!`) — vier Module, vier Rechnungen, die
 * auseinanderlaufen (Spec 01, Regel 2: „die Flaeche besitzt den Kopf").
 *
 * **Warum die Geometrie aus einer Funktion kommt.** Der erste Versuch mit
 * eigenem Kopf scheiterte daran, dass Kopf und Inhalt je ihre eigene
 * Zentrierung trugen. Beide holen sie jetzt aus `moduleContainerClass`, und
 * beide reservieren dieselbe Scrollleistenrinne (siehe `ModuleFrame`).
 *
 * Der ZUSTAND bleibt beim Modul: Die Leiste wird per Portal in den Kopf
 * gereicht, nicht als Datenpaket nach oben gegeben. Ein Ansichtswechsel im
 * Kopf schaltet damit weiter den State des Moduls, das ihn besitzt.
 *
 * Ohne Flaeche darueber (Story, Test, eingebettete Ansicht) rendert sie an
 * Ort und Stelle, statt spurlos zu verschwinden (Spec 01, Regel 3).
 */
export function ModuleToolbar({ className, ...leiste }: ModuleToolbarProps) {
  const kopf = useOptionalModuleHead()

  // Nur die Anmeldung geht nach oben — ein Zaehler, kein Inhalt. Daran
  // entscheidet die Flaeche, ob der Kopf ueberhaupt eine Zeile bekommt
  // (Spec 01, Regel 4), ohne dass ein neu erzeugter ReactNode pro Render
  // eine Endlosschleife aus Beitrag und Neu-Render ausloest.
  const anmelden = kopf?.anmelden
  useEffect(() => anmelden?.(), [anmelden])

  const inhalt = <ModuleFilterBar {...leiste} />

  if (kopf) return kopf.element ? createPortal(inhalt, kopf.element) : null
  return (
    <div data-module-toolbar className={cn(className)}>
      {inhalt}
    </div>
  )
}
