// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FilterProvider, useSharedFilter } from "../src/components/filter/filter-store"
import {
  ModuleFrame,
  moduleContainerClass,
  resolveModuleLayout,
} from "../src/components/layout/module-frame"
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

  it("zeigt Suche und Modul-Aktionen, aber keinen Filter mehr", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, {
          availableTags: ["garten"],
          trailingActions: createElement("button", { "data-heute": true }, "Heute"),
        }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(kopfInhalt()!.querySelector("input")).not.toBeNull()
    expect(kopfInhalt()!.querySelector("[data-heute]")).not.toBeNull()
    // Der Filter-KNOPF ist unten (Board 2g) — die aktiven Filter bleiben oben.
    expect(kopfInhalt()!.querySelector("[data-filter-pill-trigger]")).toBeNull()
    expect(kopfInhalt()!.querySelector("[data-filter-chips]")).not.toBeNull()
  })

  it("verschwindet ohne Suche und ohne Modul-Aktionen, obwohl es Filter gibt", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { availableTags: ["garten"], search: false }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(true)
    // Die Pille steht trotzdem — sie haengt nicht am Kopf.
    expect(host.querySelector("[data-module-controls] [data-filter-pill-trigger]")).not.toBeNull()
  })

  it("zeigt Modul-Aktionen ohne Suche, wenn das Modul nicht sucht", () => {
    // `search={false}` schaltete die ganze Zeile ab oder gar nichts — die
    // Suche kam trotzdem mit, sobald es Aktionen gab (#322).
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, {
          search: false,
          trailingActions: createElement("button", { "data-heute": true }, "Heute"),
        }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(kopfInhalt()!.querySelector("[data-heute]")).not.toBeNull()
    expect(kopfInhalt()!.querySelector("input")).toBeNull()
  })

  it("bleibt leer, wenn das Modul-Extra gerade nichts rendert", () => {
    // Ein leeres Fragment als `chipsExtra` hielt den Kopf am Leben: eine
    // unsichtbare Zeile mit 32px Polster (Copilot-Befund).
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { search: false, chipsExtra: undefined }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(true)
  })

  it("kommt zurueck, sobald ein Modul-Extra aktiv ist", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, {
          search: false,
          chipsExtra: createElement("span", { "data-extra": true }, "Nur meine"),
        }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(kopfInhalt()!.querySelector("[data-extra]")).not.toBeNull()
  })

  it("stellt die Filter-Pille in die schwebende Ecke, nicht in den Scrollbereich", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { availableTags: ["garten"] }),
        "INHALT",
      ),
    )
    expect(host.querySelector("[data-module-controls] [data-filter-pill-trigger]")).not.toBeNull()
    expect(scrollbereich()!.querySelector("[data-filter-pill-trigger]")).toBeNull()
  })

  it("faellt ohne Flaeche darueber an seinen Ort zurueck", () => {
    // Story, Test, eingebettete Ansicht (Spec 01, Regel 3): Kopfzeile und
    // Pille verschwinden nicht spurlos, wenn es keinen Kopf gibt.
    rendere(createElement(ModuleToolbar, { availableTags: ["garten"] }))
    const leiste = host.querySelector("[data-module-toolbar]")
    expect(leiste).not.toBeNull()
    expect(leiste!.querySelector("input")).not.toBeNull()
    expect(leiste!.querySelector("[data-filter-pill-trigger]")).not.toBeNull()
  })

  it("schwebt bei ueberlagerten Flaechen, statt zu verschwinden", () => {
    // `panelFit: "overlay"` (Karte, Graph): Die Flaeche IST der Inhalt, ein
    // Kopf im Fluss wuerde ihr Welt wegnehmen. Dieselben Bausteine schweben
    // deshalb darueber — gehostet von derselben Flaeche (Spec 01, Regel 5).
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "map" },
        "KARTE",
        createElement(ModuleToolbar, { availableTags: ["garten"] }),
      ),
    )
    expect(host.textContent).toContain("KARTE")
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(kopfInhalt()!.querySelector("input")).not.toBeNull()
    expect(host.querySelector("[data-module-controls] [data-filter-pill-trigger]")).not.toBeNull()
    // Kein zweiter Wirt: Suche und Pille gibt es genau einmal.
    expect(host.querySelectorAll("input").length).toBe(1)
    expect(host.querySelectorAll("[data-filter-pill]").length).toBe(1)
  })

  it("zeigt auch ueber einer Karte die aktiven Filter", () => {
    // Der Befund, der dazu fuehrte: Im Graphen fehlte die Chip-Zeile, weil
    // ueberlagerte Module ihre Steuerung selbst rendern mussten.
    function Aktiv() {
      const { value, setValue } = useSharedFilter()
      return createElement("button", {
        "data-setzen": true,
        onClick: () => setValue({ ...value, tags: ["garten"] }),
      })
    }
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "map" },
        createElement(Aktiv),
        createElement(ModuleToolbar, { availableTags: ["garten"] }),
      ),
    )
    act(() => {
      host.querySelector<HTMLButtonElement>("[data-setzen]")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      )
    })
    const chips = kopfInhalt()!.querySelector("[data-filter-chips]")
    expect(chips).not.toBeNull()
    expect(chips!.textContent).toContain("garten")
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
    const geometrie = moduleContainerClass(resolveModuleLayout({ moduleId: "feed" }))!
    for (const klasse of geometrie.split(/\s+/)) {
      expect(kopfInhalt()!.className).toContain(klasse)
      expect(scrollbereich()!.firstElementChild!.className).toContain(klasse)
    }
  })

  it("traegt kein vertikales Polster — das gehoert Kopf und Scrollbereich", () => {
    // Sonst polsterte der Kopf oben UND der Inhalt darunter nochmal.
    expect(moduleContainerClass(resolveModuleLayout({ moduleId: "feed" }))).not.toMatch(/\bp[ty]-/)
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
    expect(moduleContainerClass(resolveModuleLayout({ moduleId: "collection" }))).toBeUndefined()
    rendere(createElement(ModuleFrame, { moduleId: "collection" }, "LISTE"))
    expect(scrollbereich()).toBeNull()
    expect(host.querySelector("[data-module-fill]")).not.toBeNull()
  })
})
