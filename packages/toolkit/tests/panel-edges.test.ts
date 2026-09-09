// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"

import { readPanelEdges } from "../src/components/layout/panel-edges"

/**
 * `AdaptivePanel` veroeffentlicht zwei Groessen: den Platz, den es dem Inhalt
 * wegnimmt (`--adaptive-panel-margin-*`, Luft daneben eingerechnet), und die
 * Lage seiner Kante (`--adaptive-panel-edge-*`). Hier zaehlt die Kante — sie
 * beantwortet die Frage, was verdeckt ist. Wer beides verwechselt, rechnet den
 * Rand doppelt.
 */
afterEach(() => {
  document.documentElement.style.removeProperty("--adaptive-panel-edge-left")
  document.documentElement.style.removeProperty("--adaptive-panel-edge-right")
})

describe("readPanelEdges", () => {
  it("liest die Kante eines offenen Panels", () => {
    document.documentElement.style.setProperty("--adaptive-panel-edge-right", "376px")
    expect(readPanelEdges()).toEqual({ left: 0, right: 376 })
  })

  it("liest beide Seiten", () => {
    document.documentElement.style.setProperty("--adaptive-panel-edge-left", "280px")
    document.documentElement.style.setProperty("--adaptive-panel-edge-right", "376px")
    expect(readPanelEdges()).toEqual({ left: 280, right: 376 })
  })

  it("meldet ohne offenes Panel keine Kante", () => {
    expect(readPanelEdges()).toEqual({ left: 0, right: 0 })
  })

  it("verwirft unsinnige Werte, statt sie durchzureichen", () => {
    document.documentElement.style.setProperty("--adaptive-panel-edge-right", "auto")
    expect(readPanelEdges().right).toBe(0)
  })
})
