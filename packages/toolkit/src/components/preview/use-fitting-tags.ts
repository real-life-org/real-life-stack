"use client"

import { useLayoutEffect, useRef, useState, type RefObject } from "react"

/**
 * Wie viele Chips passen in `available` Pixel, wenn die übrigen als „+N"
 * dahinter stehen? Alle, wenn alle passen (dann ohne „+N"); sonst so viele,
 * dass „+N" noch daneben passt. `null` ohne Messung (Breite 0: kein Layout,
 * etwa beim ersten Rendern auf dem Server oder in jsdom).
 */
export function fitCount(
  available: number,
  widths: readonly number[],
  gap: number,
  plusWidth: (hidden: number) => number,
): number | null {
  if (available <= 0) return null
  const total = widths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0)
  if (total <= available) return widths.length
  let used = 0
  let best = 0
  for (let i = 0; i < widths.length; i++) {
    used += widths[i]! + (i > 0 ? gap : 0)
    const hidden = widths.length - (i + 1)
    if (used + gap + plusWidth(hidden) <= available) best = i + 1
    else break
  }
  return best
}

/**
 * Misst die Tag-Zeile einer Karte: `rowRef` ist die ganze Zeile, `fixedRef`
 * der Teil, der seinen Platz behält (Urheber), `measureRef` eine unsichtbare
 * Zeile mit allen Chips und einem „+N"-Muster. Gemessen wird vor dem ersten
 * Bild (useLayoutEffect) und nach jeder Größenänderung (ResizeObserver) —
 * die Karte springt nicht. Ohne Messung gilt `fallback`.
 */
export function useFittingTags(
  count: number,
  fallback: number,
  gapBetweenGroups: number,
): {
  visible: number
  /** Die Messzeile gibt es erst im Browser (nie im Server-Markup). */
  measuring: boolean
  rowRef: RefObject<HTMLDivElement | null>
  fixedRef: RefObject<HTMLDivElement | null>
  measureRef: RefObject<HTMLDivElement | null>
} {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const fixedRef = useRef<HTMLDivElement | null>(null)
  const measureRef = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(Math.min(count, fallback))
  // Erst nach dem Einhängen messen: Die Messzeile erscheint im selben
  // synchronen Durchlauf vor dem ersten Bild, also ohne Springen — und
  // Server-Markup trägt sie nie.
  const [measuring, setMeasuring] = useState(false)
  useLayoutEffect(() => setMeasuring(true), [])

  useLayoutEffect(() => {
    if (!measuring) return
    const row = rowRef.current
    const measure = measureRef.current
    if (!row || !measure) return
    const update = () => {
      const fixed = fixedRef.current?.offsetWidth ?? 0
      const available = row.offsetWidth - (fixed > 0 ? fixed + gapBetweenGroups : 0)
      const chips = [...measure.querySelectorAll<HTMLElement>('[data-measure="tag-chip"]')].map((c) => c.offsetWidth)
      const plus = measure.querySelector<HTMLElement>('[data-measure="tag-plus"]')?.offsetWidth ?? 0
      const gap = parseFloat(getComputedStyle(measure).columnGap) || 6
      const n = fitCount(available, chips, gap, () => plus)
      setVisible(n ?? Math.min(count, fallback))
    }
    update()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(update)
    observer.observe(row)
    return () => observer.disconnect()
  }, [count, fallback, gapBetweenGroups, measuring])

  return { visible, measuring, rowRef, fixedRef, measureRef }
}
