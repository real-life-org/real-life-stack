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

/**
 * Waechst die Verdeckung auf einer Achse, oder wechselt sie die Seite?
 *
 * Nur dann muss die Karte einen bereits gezeigten Punkt nachholen. Schrumpft
 * sie — das Panel geht zu —, ist nichts mehr verdeckt, und ein Zurueckschwenken
 * waere eine Bewegung, die niemand angefordert hat.
 */
function mehrVerdeckt(vorher: number, jetzt: number): boolean {
  if (jetzt === 0) return false
  if (Math.abs(jetzt) > Math.abs(vorher)) return true
  return Math.sign(jetzt) !== Math.sign(vorher)
}

/**
 * Muss ein Punkt, der schon im Blick ist, neu zentriert werden, weil sich die
 * verdeckten Raender geaendert haben?
 *
 * Der Fall, fuer den es das gibt: Jemand klickt einen Marker an, das Panel
 * oeffnet erst danach — und legt sich dann genau auf den Punkt, den es
 * beschreibt.
 */
export function focusNeedsRecentering(
  vorher: readonly [number, number] | null,
  jetzt: readonly [number, number],
): boolean {
  if (!vorher) return jetzt[0] !== 0 || jetzt[1] !== 0
  return mehrVerdeckt(vorher[0], jetzt[0]) || mehrVerdeckt(vorher[1], jetzt[1])
}
