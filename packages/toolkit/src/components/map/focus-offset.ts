/** Verdeckte Raender der Kartenflaeche, in CSS-Pixeln. */
export interface MapFocusInsets {
  /** Blatt am unteren Rand (mobiler Drawer). */
  bottomInset?: number
  /** Panel am rechten Rand. */
  rightInset?: number
  /** Panel am linken Rand. */
  leftInset?: number
}

function gueltig(wert: number | undefined): number {
  return Number.isFinite(wert) && (wert as number) > 0 ? (wert as number) : 0
}

/**
 * Um wie viel der Zielpunkt verschoben wird, damit er in der Mitte des
 * SICHTBAREN Kartenbereichs landet statt in der Mitte der ganzen Flaeche.
 *
 * Jeweils die halbe verdeckte Strecke, weil der Punkt sonst am Rand des
 * Sichtbaren klebt statt darin zu liegen. Waagerecht heben sich gleich breite
 * Raender auf.
 *
 * Vorzeichen wie bei MapLibres `offset`: negatives x nach links, negatives y
 * nach oben.
 */
export function focusOffsetFor(insets: MapFocusInsets): [number, number] {
  const links = gueltig(insets.leftInset)
  const rechts = gueltig(insets.rightInset)
  const unten = gueltig(insets.bottomInset)
  // `-0` vermeiden: `-0 / 2` ist `-0`, und das ist zwar rechnerisch null,
  // vergleicht sich aber nicht gleich (Object.is(-0, 0) === false). Aufrufer,
  // die auf "keine Verschiebung" pruefen, laegen sonst falsch.
  return [(links - rechts) / 2, unten > 0 ? -unten / 2 : 0]
}

function pixelWert(roh: string): number {
  const zahl = Number.parseFloat(roh)
  return Number.isFinite(zahl) && zahl > 0 ? zahl : 0
}

/**
 * Liest die Raender, die offene Panels gerade beanspruchen, aus den
 * CSS-Variablen `--adaptive-panel-margin-left/right`. Sie sind der eine Ort,
 * an dem `AdaptivePanel` seinen Platzbedarf veroeffentlicht — Module, die sich
 * nicht einruecken lassen (`panelFit: "overlay"`, etwa die Karte), muessen ihn
 * hier abholen, statt Panelbreiten selbst zu kennen.
 */
export function readPanelInsets(): { leftInset: number; rightInset: number } {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { leftInset: 0, rightInset: 0 }
  }
  const stil = window.getComputedStyle(document.documentElement)
  return {
    leftInset: pixelWert(stil.getPropertyValue("--adaptive-panel-margin-left")),
    rightInset: pixelWert(stil.getPropertyValue("--adaptive-panel-margin-right")),
  }
}
