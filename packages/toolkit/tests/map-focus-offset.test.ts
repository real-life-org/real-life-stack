import { describe, expect, it } from "vitest"
import { focusNeedsRecentering, focusOffsetFor } from "../src/components/map/focus-offset"

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

/**
 * Ein Panel oeffnet erst NACH dem Klick, der es ausgeloest hat. Die Karte muss
 * den schon gezeigten Punkt darum nachholen koennen — aber nur, wenn wirklich
 * mehr verdeckt wird.
 */
describe("focusNeedsRecentering", () => {
  it("zentriert erstmalig, sobald ueberhaupt etwas verdeckt ist", () => {
    expect(focusNeedsRecentering(null, [-196, 0])).toBe(true)
    expect(focusNeedsRecentering(null, [0, 0])).toBe(false)
  })

  it("holt den Punkt nach, wenn sich ein Panel nachtraeglich darueber legt", () => {
    expect(focusNeedsRecentering([0, 0], [-196, 0])).toBe(true)
  })

  it("schwenkt beim Schliessen des Panels nicht zurueck", () => {
    expect(focusNeedsRecentering([-196, 0], [0, 0])).toBe(false)
  })

  it("laesst eine unveraenderte Verdeckung in Ruhe", () => {
    expect(focusNeedsRecentering([-196, 0], [-196, 0])).toBe(false)
  })

  it("reagiert auf ein breiter werdendes Panel", () => {
    expect(focusNeedsRecentering([-196, 0], [-240, 0])).toBe(true)
  })

  it("reagiert auf einen Seitenwechsel bei gleicher Breite", () => {
    expect(focusNeedsRecentering([-196, 0], [196, 0])).toBe(true)
  })

  it("sieht auch ein Blatt, das unten aufzieht, waehrend das Panel bleibt", () => {
    expect(focusNeedsRecentering([-196, 0], [-196, -300])).toBe(true)
  })
})
