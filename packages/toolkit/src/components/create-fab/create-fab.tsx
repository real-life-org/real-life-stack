"use client"

import { useEffect, useState, type RefObject } from "react"
import { Plus } from "lucide-react"
import { cn } from "../../lib/utils"

export interface CreateFabProps {
  onClick: () => void
  label?: string
  /**
   * Solange dieses Element im Scrollbereich der Modulflaeche sichtbar ist,
   * bleibt der FAB weg — zwei Einstiege nebeneinander waeren einer zu viel.
   *
   * Gedacht fuer den Feed: Dort ist die Composer-Pille der eigentliche
   * Einstieg (Spec shared-components → „Feed-Sonderfall"), aber sie scrollt
   * mit. Ohne die Angabe steht der FAB wie ueberall sonst dauerhaft.
   */
  hideWhileVisible?: RefObject<Element | null>
  className?: string
}

/**
 * Ist das beobachtete Element gerade AUS dem Scrollbereich gescrollt?
 *
 * Gemessen wird gegen den Scrollbereich der Modulflaeche, nicht gegen das
 * Fenster: Was aus IHM herausgescrollt ist, entscheidet — neben einem
 * schwebenden Panel oder unter der Navbar deckt sich das nicht. Die Wurzel
 * wird am beobachteten Element gesucht (`closest`), weil der FAB selbst
 * `fixed` sitzt und den Scrollbereich von dort aus nicht sieht.
 */
function useAusDemBild(ziel: RefObject<Element | null> | undefined): boolean {
  const [aus, setAus] = useState(false)
  useEffect(() => {
    const element = ziel?.current
    // Kein Ziel: nichts zu beobachten — der Aufrufer will den FAB dauerhaft.
    if (!element) return
    // Umgebungen ohne IntersectionObserver (jsdom, aeltere WebViews) zeigen
    // den FAB lieber, als den Einstieg unerreichbar zu verstecken.
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
 * Floating Action Button for "create new item" — sits bottom-right of
 * its containing module surface. All four module views use the same
 * FAB so the create entry point is at one consistent screen location.
 *
 * The button positions itself with `fixed`. On mobile it sits ~12px above
 * the `BottomNav` (fixed bottom-0, `md:hidden`): the 5.25rem offset clears
 * the nav's content height with a small gap, and the added
 * `env(safe-area-inset-bottom)` mirrors the nav's own safe-area padding so
 * the gap stays consistent on notched devices (the nav height is not fixed —
 * it's content + that inset). From `md` up there is no BottomNav, so it
 * drops back to a normal corner offset. Its right edge follows the shared
 * panel via the `--adaptive-panel-edge-right` CSS variable, so an open panel
 * pushes the FAB left to sit beside it instead of being covered by it.
 * Use inside a relative or full-screen container; the z-index keeps it above
 * Leaflet panes but below modal sheets / drawers.
 */
export function CreateFab({ onClick, label = "Erstellen", hideWhileVisible, className }: CreateFabProps) {
  const zielWeg = useAusDemBild(hideWhileVisible)
  // Der FAB ist die Ausnahme, nicht die Regel: Nur wer ein Ziel nennt,
  // bekommt ihn ueberhaupt versteckt.
  if (hideWhileVisible && !zielWeg) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      // Right edge tracks the panel's EDGE, not the larger content inset:
      // that inset already contains the gap beside a floating panel, so adding
      // the FAB's own 1rem on top of it would count the gap twice (measured:
      // 32px of air instead of 16px). Against the edge the FAB keeps exactly
      // the offset it has against the window border.
      style={{ right: "calc(1rem + var(--adaptive-panel-edge-right, 0px))" }}
      className={cn(
        // Desktop offset is 1rem on both axes so it matches the right inline
        // offset (1rem) and lines up with the other module/map corner controls.
        "fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 ease-out in-[.adaptive-panel-resizing]:transition-none hover:scale-105 hover:shadow-xl active:scale-95 md:bottom-[calc(1rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
