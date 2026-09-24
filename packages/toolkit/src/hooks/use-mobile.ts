import * as React from "react"

const MOBILE_BREAKPOINT = 768
const COMPACT_BREAKPOINT = 1024

/** Ist die Flaeche in diesem Augenblick schmaler als `breakpoint`? */
export function istBreiteUnter(breakpoint: number): boolean {
  return typeof window !== "undefined" && window.innerWidth < breakpoint
}

function useBelowBreakpoint(breakpoint: number) {
  // Synchron aus der aktuellen Breite, nicht erst im Effekt: Entscheidungen
  // beim Einhaengen — `autoFocus` etwa — fallen im ersten Render, und ein
  // Wert, der erst danach kommt, ist dort noch falsch (rls#481). Der Effekt
  // haelt ihn aktuell, damit ein Groessen- oder Lagewechsel ankommt.
  const [below, setBelow] = React.useState(() => istBreiteUnter(breakpoint))

  React.useEffect(() => {
    const onChange = () => setBelow(istBreiteUnter(breakpoint))
    // `matchMedia` fehlt in jsdom und aelteren Umgebungen; dort traegt
    // `resize` allein. Beide zu hoeren kostet nichts: React verwirft eine
    // Zuweisung desselben Werts.
    const mql = typeof window.matchMedia === "function" ? window.matchMedia(`(max-width: ${breakpoint - 1}px)`) : null
    mql?.addEventListener("change", onChange)
    window.addEventListener("resize", onChange)
    onChange()
    return () => {
      mql?.removeEventListener("change", onChange)
      window.removeEventListener("resize", onChange)
    }
  }, [breakpoint])

  return below
}

/**
 * Narrower than 768px?
 *
 * @answers `boolean`
 * @without —
 * @group environment
 * @see story rls-foundations-hooks--environment
 * @see spec docs/spec/11-runtime-config-und-branding.md
 */
export function useIsMobile() {
  return useBelowBreakpoint(MOBILE_BREAKPOINT)
}

/**
 * Below 1024px, where the panel becomes a drawer?
 *
 * True below the panel breakpoint — i.e. where the AdaptivePanel switches from
 * a sidebar to a drawer (and a suspended panel is actually hidden).
 *
 * @answers `boolean`
 * @without —
 * @group environment
 * @see story rls-foundations-hooks--environment
 * @see spec docs/spec/11-runtime-config-und-branding.md
 */
export function useIsCompact() {
  return useBelowBreakpoint(COMPACT_BREAKPOINT)
}
