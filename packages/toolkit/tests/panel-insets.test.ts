// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"

import { readPanelInsets } from "../src/components/layout/panel-insets"

/**
 * `AdaptivePanel` veroeffentlicht seinen Platzbedarf an genau einer Stelle.
 * Wer ihn in JavaScript braucht, liest ihn hier — statt Panelbreiten selbst zu
 * kennen und mit jeder Aenderung stillschweigend falsch zu liegen.
 */
afterEach(() => {
  document.documentElement.style.removeProperty("--adaptive-panel-margin-left")
  document.documentElement.style.removeProperty("--adaptive-panel-margin-right")
})

describe("readPanelInsets", () => {
  it("liest den Rand, den ein offenes Panel veroeffentlicht", () => {
    document.documentElement.style.setProperty("--adaptive-panel-margin-right", "392px")
    expect(readPanelInsets()).toEqual({ leftInset: 0, rightInset: 392 })
  })

  it("liest beide Seiten", () => {
    document.documentElement.style.setProperty("--adaptive-panel-margin-left", "280px")
    document.documentElement.style.setProperty("--adaptive-panel-margin-right", "392px")
    expect(readPanelInsets()).toEqual({ leftInset: 280, rightInset: 392 })
  })

  it("meldet ohne offenes Panel keinen Rand", () => {
    expect(readPanelInsets()).toEqual({ leftInset: 0, rightInset: 0 })
  })

  it("verwirft unsinnige Werte, statt sie durchzureichen", () => {
    document.documentElement.style.setProperty("--adaptive-panel-margin-right", "auto")
    expect(readPanelInsets().rightInset).toBe(0)
  })
})
