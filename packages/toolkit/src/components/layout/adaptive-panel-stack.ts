import { PANEL_Z_INDEX_BASE, PANEL_Z_INDEX_CEILING } from "../../lib/z-layers"

export type AdaptivePanelStackMode = "modal" | "sidebar" | "drawer" | "floating"

export interface AdaptivePanelStackEntry {
  mode: AdaptivePanelStackMode
  side: "left" | "right"
  /**
   * Breite, die dieses Panel dem Inhalt wegnimmt. Bei `sidebar` ist das ihre
   * eigene Breite, bei `floating` ihre Breite plus die Raender links und
   * rechts daneben — die Karte schwebt zwar ueber dem Inhalt, aber er soll
   * nicht unter ihr verschwinden.
   */
  sidebarWidth: number
  /**
   * Wo die Kante des Panels liegt, gemessen vom Fensterrand.
   *
   * Fuer ein Panel, das am Rand klebt (`sidebar`), ist das seine Breite — der
   * Vorgabewert. Eine schwebende Karte steht dagegen eingerueckt: ihre Kante
   * liegt naeher am Rand als der Platz, den sie dem Inhalt wegnimmt.
   *
   * Schwebende Bedienelemente richten sich hieran aus, nicht an
   * {@link sidebarWidth} — sie bringen ihren eigenen Rand mit, und der zaehlte
   * sonst doppelt.
   */
  edgeOffset?: number
  insetActive?: boolean
}

const ADAPTIVE_PANEL_Z_INDEX_BASE = PANEL_Z_INDEX_BASE
const ADAPTIVE_PANEL_Z_INDEX_CEILING = PANEL_Z_INDEX_CEILING
const ADAPTIVE_PANEL_Z_INDEX_CAPACITY =
  ADAPTIVE_PANEL_Z_INDEX_CEILING - ADAPTIVE_PANEL_Z_INDEX_BASE

/**
 * Keeps the active panel at the top of the adaptive-panel layer without
 * crossing into the dialog layer at z-index 65. Stacks that exceed the normal
 * five slots grow downward, preserving a distinct visual order for every
 * panel.
 */
export function getAdaptivePanelZIndex(order: number, stackSize: number): number {
  const overflow = Math.max(0, stackSize - ADAPTIVE_PANEL_Z_INDEX_CAPACITY)
  return ADAPTIVE_PANEL_Z_INDEX_BASE + order - overflow
}

/**
 * Tracks open panels in presentation order. Modal and drawer overlays must not
 * erase the layout inset owned by an open sidebar or floating card underneath
 * them.
 */
export class AdaptivePanelStack {
  private entries: Array<AdaptivePanelStackEntry & {
    id: symbol
    order: number
    onOrderChange?: (order: number, stackSize: number) => void
  }> = []

  upsert(
    id: symbol,
    entry: AdaptivePanelStackEntry,
    onOrderChange?: (order: number, stackSize: number) => void,
  ): number {
    const index = this.entries.findIndex((candidate) => candidate.id === id)
    if (index === -1) {
      const order = this.entries.length + 1
      this.entries.push({ id, order, onOrderChange, ...entry })
      this.notifyOrderChanges()
      return order
    }
    const order = this.entries[index].order
    const notify = onOrderChange ?? this.entries[index].onOrderChange
    this.entries[index] = { id, order, onOrderChange: notify, ...entry }
    notify?.(order, this.entries.length)
    return order
  }

  remove(id: symbol): void {
    const index = this.entries.findIndex((entry) => entry.id === id)
    if (index === -1) return

    this.entries.splice(index, 1)
    this.notifyOrderChanges()
  }

  private notifyOrderChanges(): void {
    const stackSize = this.entries.length
    this.entries.forEach((entry, index) => {
      const order = index + 1
      entry.order = order
      entry.onOrderChange?.(order, stackSize)
    })
  }

  isTopmost(id: symbol): boolean {
    return this.entries.at(-1)?.id === id
  }

  /** Wieviel Platz die offenen Panels dem Inhalt wegnehmen. */
  getInsets(): { left: number; right: number } {
    return this.sammle((entry) => entry.sidebarWidth)
  }

  /**
   * Wo die Kanten der offenen Panels liegen — der Bereich, den sie wirklich
   * ueberdecken. Schwebende Bedienelemente setzen ihren eigenen Rand hierauf,
   * genau wie sie es am Fensterrand tun.
   */
  getEdges(): { left: number; right: number } {
    return this.sammle((entry) => entry.edgeOffset ?? entry.sidebarWidth)
  }

  private sammle(breite: (entry: AdaptivePanelStackEntry) => number): { left: number; right: number } {
    let left = 0
    let right = 0

    for (const entry of this.entries) {
      // `sidebar` und `floating` verdraengen beide den Inhalt; `modal` und
      // `drawer` legen sich darueber, ohne Platz zu beanspruchen.
      const verdraengt = entry.mode === "sidebar" || entry.mode === "floating"
      if (!verdraengt || entry.insetActive === false) continue
      if (entry.side === "left") left = breite(entry)
      else right = breite(entry)
    }

    return { left, right }
  }
}

export const adaptivePanelStack = new AdaptivePanelStack()

export interface ScrollLockTarget {
  style: { overflow: string }
}

export class AdaptivePanelScrollLock {
  private holders = new Set<symbol>()
  private previousOverflow: string | null = null

  acquire(id: symbol, target: ScrollLockTarget): void {
    if (this.holders.has(id)) return
    if (this.holders.size === 0) {
      this.previousOverflow = target.style.overflow
      target.style.overflow = "hidden"
    }
    this.holders.add(id)
  }

  release(id: symbol, target: ScrollLockTarget): void {
    if (!this.holders.delete(id) || this.holders.size > 0) return
    target.style.overflow = this.previousOverflow ?? ""
    this.previousOverflow = null
  }
}

export const adaptivePanelScrollLock = new AdaptivePanelScrollLock()
