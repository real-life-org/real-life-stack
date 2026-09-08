// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"
import { focusOffsetFor, readPanelInsets } from "../src/components/map/focus-offset"

/**
 * Wohin die Kamera zielt, wenn Teile der Karte verdeckt sind.
 *
 * Der Fall, der das noetig machte: Module mit `panelFit: "overlay"` bleiben
 * beim Oeffnen eines Details voll breit - das Panel legt sich darueber. Klickt
 * jemand einen Marker im rechten Bereich, geht das Panel GENAU DARUEBER auf.
 * Ohne Verschiebung sieht man das Detail zu einem Punkt, den man nicht mehr
 * sieht.
 */
describe("Zielpunkt bei verdeckter Karte", () => {
  it("verschiebt nichts, wenn nichts verdeckt ist", () => {
    expect(focusOffsetFor({})).toEqual([0, 0])
  })

  it("hebt den Punkt ueber ein Blatt am unteren Rand", () => {
    // Halbe verdeckte Strecke: dann sitzt der Punkt mittig im Sichtbaren.
    expect(focusOffsetFor({ bottomInset: 400 })).toEqual([0, -200])
  })

  it("schiebt den Punkt nach links, wenn rechts ein Panel steht", () => {
    expect(focusOffsetFor({ rightInset: 392 })).toEqual([-196, 0])
  })

  it("schiebt den Punkt nach rechts, wenn links ein Panel steht", () => {
    expect(focusOffsetFor({ leftInset: 392 })).toEqual([196, 0])
  })

  it("hebt sich auf, wenn beide Seiten gleich verdeckt sind", () => {
    expect(focusOffsetFor({ leftInset: 300, rightInset: 300 })).toEqual([0, 0])
  })

  it("verrechnet waagerecht und senkrecht zusammen", () => {
    expect(focusOffsetFor({ rightInset: 392, bottomInset: 400 })).toEqual([-196, -200])
  })

  it("ignoriert unsinnige Werte, statt die Kamera zu verwerfen", () => {
    expect(focusOffsetFor({ rightInset: Number.NaN })).toEqual([0, 0])
    expect(focusOffsetFor({ bottomInset: -50 })).toEqual([0, 0])
  })
})

describe("readPanelInsets", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--adaptive-panel-margin-left")
    document.documentElement.style.removeProperty("--adaptive-panel-margin-right")
  })

  it("liest die Raender, die ein offenes Panel veroeffentlicht", () => {
    document.documentElement.style.setProperty("--adaptive-panel-margin-right", "392px")
    expect(readPanelInsets()).toEqual({ leftInset: 0, rightInset: 392 })
  })

  it("meldet ohne offenes Panel keinen Rand", () => {
    expect(readPanelInsets()).toEqual({ leftInset: 0, rightInset: 0 })
  })

  it("ein rechtes Panel schiebt das Ziel nach links", () => {
    document.documentElement.style.setProperty("--adaptive-panel-margin-right", "392px")
    expect(focusOffsetFor(readPanelInsets())).toEqual([-196, 0])
  })
})
