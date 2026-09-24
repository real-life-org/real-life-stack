import * as React from "react"

const MOBILE_BREAKPOINT = 768
const COMPACT_BREAKPOINT = 1024

function useBelowBreakpoint(breakpoint: number) {
  const [below, setBelow] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const onChange = () => setBelow(window.innerWidth < breakpoint)
    mql.addEventListener("change", onChange)
    setBelow(window.innerWidth < breakpoint)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return !!below
}

/**
 * Ist die Flaeche in diesem Augenblick schmal (< 1024px)? Synchron, fuer
 * Entscheidungen beim Einhaengen — `useIsCompact` meldet sich erst nach dem
 * ersten Render, und ein `autoFocus` ist dann laengst gesetzt.
 */
export function istKompaktJetzt(): boolean {
  return typeof window !== "undefined" && window.innerWidth < COMPACT_BREAKPOINT
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
