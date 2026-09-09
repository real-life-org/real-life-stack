"use client"

import { useEffect, useState } from "react"

/**
 * Die Raender, die offene Panels dem Inhalt gerade wegnehmen, in CSS-Pixeln.
 */
export interface PanelInsets {
  leftInset: number
  rightInset: number
}

const KEINE: PanelInsets = { leftInset: 0, rightInset: 0 }

function pixelWert(roh: string): number {
  const zahl = Number.parseFloat(roh)
  return Number.isFinite(zahl) && zahl > 0 ? zahl : 0
}

/**
 * `AdaptivePanel` veroeffentlicht seinen Platzbedarf an genau einer Stelle: den
 * CSS-Variablen `--adaptive-panel-margin-left/right`. Flaechen, die sich
 * einruecken lassen, konsumieren sie als Padding; wer sie in JavaScript braucht
 * — etwa eine Karte, die ihr Zentrum korrigieren muss —, liest sie hier, statt
 * Panelbreiten selbst zu kennen.
 */
export function readPanelInsets(): PanelInsets {
  if (typeof window === "undefined" || typeof document === "undefined") return KEINE
  const stil = window.getComputedStyle(document.documentElement)
  return {
    leftInset: pixelWert(stil.getPropertyValue("--adaptive-panel-margin-left")),
    rightInset: pixelWert(stil.getPropertyValue("--adaptive-panel-margin-right")),
  }
}

/**
 * Dieselben Raender, aber reaktiv: Ein Panel oeffnet in einem eigenen Effekt,
 * also erst NACH dem Klick, der es ausgeloest hat. Wer nur einmal liest, sieht
 * in genau diesem Moment noch 0px und richtet sich nach einem Zustand, den es
 * eine Zehntelsekunde spaeter nicht mehr gibt.
 *
 * Der Wert behaelt seine Referenz, solange sich die Zahlen nicht aendern —
 * sonst waere er als Effekt-Abhaengigkeit unbrauchbar.
 */
export function usePanelInsets(): PanelInsets {
  const [insets, setInsets] = useState<PanelInsets>(KEINE)

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return
    const pruefen = () => {
      const naechste = readPanelInsets()
      setInsets((bisher) =>
        bisher.leftInset === naechste.leftInset && bisher.rightInset === naechste.rightInset
          ? bisher
          : naechste,
      )
    }
    pruefen()
    // Die Variablen stehen im `style`-Attribut des Wurzelelements; das Panel
    // setzt sie direkt dort.
    const beobachter = new MutationObserver(pruefen)
    beobachter.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] })
    return () => beobachter.disconnect()
  }, [])

  return insets
}
