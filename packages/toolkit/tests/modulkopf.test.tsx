// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FilterProvider } from "../src/components/filter/filter-store"
import { ModuleFrame, moduleContainerClass } from "../src/components/layout/module-frame"
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

/**
 * Der Filter hat einen Besitzer, und der steht ueber der Flaeche — in der App
 * die Shell, hier der Test. Die Leiste bringt ihn NICHT selbst mit: Dann
 * saehen Leiste und Inhalt verschiedene Werte.
 */
function rendere(node: React.ReactNode) {
  act(() => root.render(createElement(FilterProvider, null, node)))
}

const kopf = () => host.querySelector("[data-module-head]")
const kopfInhalt = () => host.querySelector("[data-module-head-slot]")
const scrollbereich = () => host.querySelector("[data-module-scroll]")

/**
 * Die Modulflaeche ist eine Spalte: fester Kopf, darunter der Scrollbereich
 * (Spec 01 → „Die Modulflaeche ist eine Spalte"). Der Kopf gehoert der
 * Flaeche, das Modul reicht seine Steuerleiste hinein.
 */
describe("Der Modulkopf", () => {
  it("bleibt leer, wenn das Modul nichts hineinreicht", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    // Der Kopf-Slot ist als Portal-Ziel immer da, aber ohne Beitrag leer —
    // eine leere Zeile waere schlimmer als kein Kopf (Spec 01, Regel 4).
    expect(kopfInhalt()).not.toBeNull()
    expect(kopfInhalt()!.childNodes.length).toBe(0)
    expect(kopf()!.hasAttribute("hidden")).toBe(true)
  })

  it("nimmt die Steuerleiste des Moduls auf, statt sie im Scrollbereich zu lassen", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { availableTags: ["garten"] }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(kopfInhalt()!.querySelector("[data-filter-chips]")).not.toBeNull()
    expect(scrollbereich()!.querySelector("[data-filter-chips]")).toBeNull()
  })

  it("faellt ohne Flaeche darueber an seinen Ort zurueck", () => {
    // Story, Test, eingebettete Ansicht (Spec 01, Regel 3): Die Leiste
    // verschwindet nicht spurlos, wenn es keinen Kopf gibt.
    rendere(createElement(ModuleToolbar, { availableTags: ["garten"] }))
    const leiste = host.querySelector("[data-module-toolbar]")
    expect(leiste).not.toBeNull()
    expect(leiste!.querySelector("[data-filter-chips]")).not.toBeNull()
  })

  it("gibt es fuer ueberlagerte Flaechen gar nicht", () => {
    // `panelFit: "overlay"` (Karte, Graph): Die Steuerung schwebt ueber der
    // Flaeche, ein Kopf wuerde sie beschneiden (Spec 01, Regel 5).
    rendere(createElement(ModuleFrame, { moduleId: "map" }, "KARTE"))
    expect(kopf()).toBeNull()
    expect(host.textContent).toContain("KARTE")
  })
})

/**
 * Der Punkt, an dem der erste Versuch scheiterte: Kopf und Scrollbereich
 * trugen je eine eigene Geometrie. Die Leiste sass am Fensterrand, waehrend
 * die Karten zentriert standen — und die Scrollleiste verschob die
 * Zentrierung des Inhalts um weitere Pixel gegen den Kopf.
 */
describe("Die Geometrie der Spalte", () => {
  it("kommt fuer Kopf und Inhalt aus einer Funktion", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    const geometrie = moduleContainerClass("feed")!
    for (const klasse of geometrie.split(/\s+/)) {
      expect(kopfInhalt()!.className).toContain(klasse)
      expect(scrollbereich()!.firstElementChild!.className).toContain(klasse)
    }
  })

  it("traegt kein vertikales Polster — das gehoert Kopf und Scrollbereich", () => {
    // Sonst polsterte der Kopf oben UND der Inhalt darunter nochmal.
    expect(moduleContainerClass("feed")).not.toMatch(/\bp[ty]-/)
  })

  it("haelt in beiden dieselbe Scrollleistenbreite frei", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    expect(kopf()!.className).toContain("[scrollbar-gutter:stable]")
    expect(scrollbereich()!.className).toContain("[scrollbar-gutter:stable]")
    // Der Kopf scrollt nicht — er reserviert nur dieselbe Rinne.
    expect(kopf()!.className).toContain("overflow-hidden")
  })

  it("laesst randlose Module ohne Container fuellen", () => {
    // `fill: "bleed"` (Liste, Karte): kein Container, das Modul scrollt selbst.
    expect(moduleContainerClass("collection")).toBeUndefined()
    rendere(createElement(ModuleFrame, { moduleId: "collection" }, "LISTE"))
    expect(scrollbereich()).toBeNull()
    expect(host.querySelector("[data-module-fill]")).not.toBeNull()
  })
})
