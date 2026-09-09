"use client"

import { useEffect, useState, type RefObject } from "react"
import { createPortal } from "react-dom"
import { Plus } from "lucide-react"

import { ModuleFilterBar, type ModuleFilterBarProps } from "../filter/module-filter-bar"
import { Button } from "../primitives/button"
import { cn } from "../../lib/utils"
import { useOptionalModuleHead } from "./module-frame"

/**
 * Der Einstieg ins Erstellen im Kopf der Flaeche.
 *
 * Der Feed ist das einzige Modul ohne `CreateFab`: Sein Einstieg ist die
 * Composer-Pille oben im Scrollbereich (Spec shared-components →
 * „Feed-Sonderfall"). Scrollt sie weg, ist der Einstieg weg. Der Kopf bleibt
 * stehen — also uebernimmt er ihn dann.
 */
export interface ModuleCreateAction {
  onCreate(): void
  /** Was der Knopf tut, ausgesprochen — er zeigt nur ein Pluszeichen. */
  label: string
  /**
   * Solange dieses Element im Scrollbereich sichtbar ist, bleibt der Knopf
   * weg: Zwei Einstiege nebeneinander waeren einer zu viel. Ohne Angabe steht
   * er dauerhaft — so koennen Module ohne eigene Pille ihn ebenfalls nutzen.
   */
  hideWhileVisible?: RefObject<Element | null>
}

export interface ModuleToolbarProps extends Omit<ModuleFilterBarProps, "searchLabel"> {
  create?: ModuleCreateAction
  className?: string
}

/**
 * Ist das beobachtete Element gerade AUS dem Scrollbereich gescrollt?
 *
 * Gemessen wird gegen den Scrollbereich der Modulflaeche, nicht gegen das
 * Fenster: Der Kopf steht ueber diesem Bereich, und was aus IHM
 * herausgescrollt ist, entscheidet — beim schwebenden Panel oder auf Mobile
 * deckt sich das nicht mit dem Bildschirm. Die Wurzel wird am beobachteten
 * Element gesucht (`closest`), weil die Leiste selbst im Kopf sitzt und den
 * Scrollbereich von dort aus nicht sieht.
 */
function useAusDemBild(ziel: RefObject<Element | null> | undefined): boolean {
  const [aus, setAus] = useState(false)
  useEffect(() => {
    const element = ziel?.current
    // Kein Ziel: nichts zu beobachten — der Aufrufer will den Knopf dauerhaft.
    if (!element) return
    // Umgebungen ohne IntersectionObserver (jsdom, aeltere WebViews) lassen
    // den Knopf lieber stehen als ihn unerreichbar zu verstecken.
    if (typeof IntersectionObserver === "undefined") {
      setAus(true)
      return
    }
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        const letzter = eintraege[eintraege.length - 1]
        if (letzter) setAus(!letzter.isIntersecting)
      },
      { root: element.closest("[data-module-scroll]") },
    )
    beobachter.observe(element)
    return () => beobachter.disconnect()
  }, [ziel])
  return aus
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
export function ModuleToolbar({ className, create, ...leiste }: ModuleToolbarProps) {
  const kopf = useOptionalModuleHead()
  const pilleWeg = useAusDemBild(create?.hideWhileVisible)
  const zeigeKnopf = create && (!create.hideWhileVisible || pilleWeg)

  // Nur die Anmeldung geht nach oben — ein Zaehler, kein Inhalt. Daran
  // entscheidet die Flaeche, ob der Kopf ueberhaupt eine Zeile bekommt
  // (Spec 01, Regel 4), ohne dass ein neu erzeugter ReactNode pro Render
  // eine Endlosschleife aus Beitrag und Neu-Render ausloest.
  const anmelden = kopf?.anmelden
  useEffect(() => anmelden?.(), [anmelden])

  const inhalt = (
    <ModuleFilterBar
      {...leiste}
      trailingActions={
        (leiste.trailingActions || zeigeKnopf) && (
          <>
            {leiste.trailingActions}
            {zeigeKnopf && (
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 w-8 shrink-0 p-0"
                aria-label={create.label}
                onClick={create.onCreate}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </>
        )
      }
    />
  )

  if (kopf) return kopf.element ? createPortal(inhalt, kopf.element) : null
  return (
    <div data-module-toolbar className={cn(className)}>
      {inhalt}
    </div>
  )
}
