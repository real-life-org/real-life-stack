// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest"

import {
  clampDrawerY,
  drawerHeightFromY,
  drawerMinY,
  readSafeAreaTop,
} from "../src/components/layout/adaptive-panel"

afterEach(() => {
  document.documentElement.style.removeProperty("--safe-area-inset-top")
  document.documentElement.style.removeProperty("--safe-top")
})

/**
 * Der Befund vom Android-Geraet (randlos seit Android 15): Das Blatt ganz nach
 * oben gezogen begann bei y=0 — hinter der Statusleiste. Griff und ✕ lagen
 * darunter, und es liess sich nicht mehr schliessen.
 */
describe("Die obere Schutzzone des Blattes", () => {
  it("hoert dort auf, wo die Statusleiste anfaengt", () => {
    // 48px Zone auf 800px Schirm sind 6% — so weit und keinen Punkt weiter.
    expect(drawerMinY(48, 800)).toBeCloseTo(6)
  })

  it("bleibt ohne Zone bei null — wie bisher am Schreibtisch", () => {
    expect(drawerMinY(0, 800)).toBe(0)
    expect(drawerMinY(48, 0)).toBe(0)
  })

  it("klemmt ein Ziehen darueber hinaus", () => {
    expect(clampDrawerY(-10, 6)).toBe(6)
    expect(clampDrawerY(3, 6)).toBe(6)
    expect(clampDrawerY(40, 6)).toBe(40)
    // Nach unten bleibt es, wie es war: 100 heisst zu.
    expect(clampDrawerY(140, 6)).toBe(100)
  })

  it("meldet die Hoehe ohne die Zone", () => {
    // Die Zone gehoert nicht zum Blatt: Was die Flaeche darunter ausweichen
    // muss, ist nur, was wirklich verdeckt ist.
    expect(drawerHeightFromY(drawerMinY(48, 800), 800)).toBe(752)
  })
})

/**
 * Woher die Zone kommt: Capacitor schreibt sie auf Android selbst in die
 * Wurzel (`--safe-area-inset-top`), weil `env()` dort nichts liefert. Auf iOS
 * und im Web bleibt `env()` die Quelle.
 */
describe("Das Lesen der Schutzzone", () => {
  it("nimmt, was die Plattform gemeldet hat", () => {
    document.documentElement.style.setProperty("--safe-area-inset-top", "48px")
    expect(readSafeAreaTop()).toBe(48)
  })

  it("nimmt die App-Variable, wenn sie eine gerechnete Zahl traegt", () => {
    document.documentElement.style.setProperty("--safe-top", "24px")
    expect(readSafeAreaTop()).toBe(24)
  })

  it("ist null, wo niemand etwas meldet", () => {
    expect(readSafeAreaTop()).toBe(0)
  })
})
