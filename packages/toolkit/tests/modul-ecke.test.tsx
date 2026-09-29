// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import * as layout from "../src/components/layout"
import { FilterProvider } from "../src/components/filter/filter-store"
import { ModuleFrame, useOptionalModuleHead } from "../src/components/layout/module-frame"
import { ModuleToolbar } from "../src/components/layout/module-toolbar"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function rendere(node: React.ReactNode) {
  act(() => root.render(createElement(FilterProvider, null, node)))
}

const frame = () => host.querySelector<HTMLElement>("[data-module-frame]")!
const ecke = () => host.querySelector<HTMLElement>("[data-module-controls]")!
/** Die Schutzzone um die Ecke: sie traegt das Polster nach unten. */
const eckZone = () => ecke().parentElement!

/**
 * rls#567, Variante 2 aus dem Layout-Konzept (Anton, 29.09.2026): Die
 * schwebende Ecke unten links gehoert der Filter-Pille, gegenueber steht der
 * Erstellen-Knopf. Knoepfe eines Moduls gehen in den Kopf
 * (`ModuleToolbar.trailingActions`, Spec 01, Regel 2), nicht in eine zweite
 * Schutzzone ueber der Pille.
 */
describe("Die Ecke unten links", () => {
  it("ist kein oeffentlicher Baustein mehr", () => {
    // `ModuleControls` legte bei jedem Aufruf eine EIGENE Schutzzone an; zwei
    // Aufrufe stapelten Knoepfe auf die Pille (Karabirrdt, Luecke 10).
    expect(layout).not.toHaveProperty("ModuleControls")
  })

  it("bietet kein Portal-Ziel fuer Beitraege an", () => {
    let kopf: ReturnType<typeof useOptionalModuleHead> = null
    function Lauscher() {
      kopf = useOptionalModuleHead()
      return null
    }
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, createElement(Lauscher)))
    expect(kopf).not.toBeNull()
    expect(kopf).not.toHaveProperty("controlsElement")
  })

  it("traegt genau die Pille, und Modul-Knoepfe stehen im Kopf", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "kanban" },
        createElement(ModuleToolbar, {
          trailingActions: createElement("button", { "data-zoom": true }, "Einpassen"),
        }),
        "BRETT",
      ),
    )
    expect(ecke().querySelectorAll("[data-filter-pill-trigger]").length).toBe(1)
    expect(ecke().querySelector("[data-zoom]")).toBeNull()
    expect(host.querySelector("[data-module-head-actions] [data-zoom]")).not.toBeNull()
    // Genau eine Schutzzone unten: keine zweite, die sich darueberlegt.
    expect(host.querySelectorAll("[data-module-controls]").length).toBe(1)
  })
})

/**
 * Wie viel Platz die Ecke belegt, stand nirgends; das Karabirrdt schaetzte es
 * (`SCHWEBEND`). Der Frame meldet es als CSS-Variable an seiner Wurzel, und
 * das Polster der Ecke liest DIESELBE Angabe: Zwei Zahlen fuer eine Sache
 * liefen auseinander.
 */
describe("Die gemeldete Hoehe der Ecke", () => {
  it("steht als --module-controls-block an der Wurzel der Flaeche", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    expect(frame().className).toContain(
      "[--module-controls-block:calc(var(--module-controls-inset)+var(--module-controls-row))]",
    )
  })

  it("rechnet mit der Zeilenhoehe des hoechsten Bewohners", () => {
    // Unter md der Erstellen-Knopf (h-13 = 52px), ab md die Pille (h-12 plus
    // 1px Rand oben und unten = 50px; der Knopf hat dort 48px).
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    expect(frame().className).toContain("[--module-controls-row:3.25rem]")
    expect(frame().className).toContain("md:[--module-controls-row:calc(3rem+2px)]")
  })

  it("polstert die Ecke aus derselben Angabe", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    expect(eckZone().className).toContain("pb-(--module-controls-inset)")
  })

  it("nimmt ohne Ueberlagerung die Grundlinie ueber der Bottom-Nav (0.25rem, ab md 1rem)", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    expect(frame().className).toContain("[--module-controls-inset:0.25rem]")
    expect(frame().className).toContain("md:[--module-controls-inset:1rem]")
  })

  it("traegt bei der Karte den ganzen Abstand zur Bottom-Nav selbst", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "map" },
        "KARTE",
        createElement(ModuleToolbar, { clearsTopLeft: true }),
      ),
    )
    expect(frame().className).toContain("[--module-controls-inset:calc(5.25rem+env(safe-area-inset-bottom))]")
    expect(frame().className).toContain("md:[--module-controls-inset:1rem]")
  })
})
