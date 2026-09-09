// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AdaptivePanel } from "../src/components/layout/adaptive-panel"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

let root: Root | null = null
let host: HTMLElement | null = null
afterEach(() => {
  act(() => root?.unmount()); host?.remove(); root = null; host = null
  document.documentElement.style.removeProperty("--safe-area-inset-top")
})

const naechsteBilder = () => act(async () => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
})

/** Das Blatt selbst: das Element, dessen Hoehe in dvh angegeben ist. */
function blattHoehe(): string {
  const el = [...document.querySelectorAll<HTMLElement>("[style]")].find((e) => e.style.height.endsWith("dvh"))
  expect(el, "kein Blatt mit dvh-Hoehe gefunden").toBeDefined()
  return el!.style.height
}

function setzeFenster(hoehe: number) {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: hoehe })
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 })
}

/**
 * Die Zone ist in Pixeln, das Blatt rechnet in Prozent. Aendert sich das
 * Fenster, aendert sich der Prozentwert der Kante — ein maximiertes Blatt
 * muss dann mitwandern, sonst haengt es wieder hinter der Statusleiste (#333).
 */
describe("Das maximierte Blatt folgt der Schutzzone", () => {
  async function oeffneMaximiert() {
    document.documentElement.style.setProperty("--safe-area-inset-top", "48px")
    setzeFenster(800)
    host = document.createElement("div"); document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root!.render(createElement(AdaptivePanel, {
        open: true, onClose: () => {}, allowedModes: ["drawer"], drawerInitialHeight: 1,
      }, "Inhalt"))
    })
    await naechsteBilder()
    expect(blattHoehe()).toBe("94dvh") // 48/800 = 6% Zone
  }

  it("klemmt nach, wenn das Fenster niedriger wird", async () => {
    await oeffneMaximiert()
    setzeFenster(400)
    act(() => { window.dispatchEvent(new Event("resize")) })
    expect(blattHoehe()).toBe("88dvh") // 48/400 = 12% Zone
  })

  it("klemmt nach, wenn die Zone hoeher wird", async () => {
    await oeffneMaximiert()
    document.documentElement.style.setProperty("--safe-area-inset-top", "80px")
    act(() => { window.dispatchEvent(new Event("resize")) })
    expect(blattHoehe()).toBe("90dvh") // 80/800 = 10% Zone
  })
})
