"use client"

import { useEffect, useState } from "react"

/**
 * Wo die Kanten der offenen Panels liegen, gemessen vom jeweiligen
 * Fensterrand in CSS-Pixeln — also der Bereich, den sie UEBERDECKEN, nicht der
 * groessere Abstand, den eingerueckter Inhalt zu ihnen haelt.
 */
export interface PanelEdges {
  left: number
  right: number
}

const KEINE: PanelEdges = { left: 0, right: 0 }

function pixelWert(roh: string): number {
  const zahl = Number.parseFloat(roh)
  return Number.isFinite(zahl) && zahl > 0 ? zahl : 0
}

/**
 * `AdaptivePanel` veroeffentlicht zwei Groessen: `--adaptive-panel-margin-*`
 * (wieviel Platz dem Inhalt genommen wird, Luft eingerechnet) und
 * `--adaptive-panel-edge-*` (wo die Kante liegt). Hier zaehlt die Kante: Wer
 * fragt, was verdeckt ist — eine Karte, die ihr Zentrum korrigiert, eine
 * Schutzzone fuer schwebende Bedienelemente —, meint den Bereich hinter dem
 * Panel, nicht den Abstand, den eingerueckter Inhalt haelt.
 */
export function readPanelEdges(): PanelEdges {
  if (typeof window === "undefined" || typeof document === "undefined") return KEINE
  const stil = window.getComputedStyle(document.documentElement)
  return {
    left: pixelWert(stil.getPropertyValue("--adaptive-panel-edge-left")),
    right: pixelWert(stil.getPropertyValue("--adaptive-panel-edge-right")),
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
export function usePanelEdges(): PanelEdges {
  const [kanten, setKanten] = useState<PanelEdges>(KEINE)

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return
    const pruefen = () => {
      const naechste = readPanelEdges()
      setKanten((bisher) =>
        bisher.left === naechste.left && bisher.right === naechste.right ? bisher : naechste,
      )
    }
    pruefen()
    // Die Variablen stehen im `style`-Attribut des Wurzelelements; das Panel
    // setzt sie direkt dort.
    const beobachter = new MutationObserver(pruefen)
    beobachter.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] })
    return () => beobachter.disconnect()
  }, [])

  return kanten
}
