// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FilterProvider, FilterScope } from "../src/components/filter/filter-store"
import { ModuleFrame } from "../src/components/layout/module-frame"
import { ModuleToolbar } from "../src/components/layout/module-toolbar"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

let host: HTMLDivElement
let root: Root
let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  warn = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  warn.mockRestore()
})

function rendere(node: React.ReactNode) {
  act(() => root.render(node))
}

const kopf = () => host.querySelector("[data-module-head]")
const aktionen = () => host.querySelector("[data-module-head-actions]")
const heute = () => createElement("button", { "data-heute": true }, "Heute")
const warnungen = () => warn.mock.calls.map((aufruf) => String(aufruf[0]))

/**
 * rls#570: Ein `ModuleFrame` ohne Filter-Besitzer verschluckte die
 * `trailingActions` seines Moduls. Der Aktionsplatz war das `trailing` der
 * Suche, und die Suche rendert ohne Besitzer nichts: kein Portal-Ziel, aber
 * ein angemeldeter, leerer Kopf. Spec 01, Regel 3 und 4: Was das Modul
 * beitraegt, verschwindet nicht spurlos; leer ist ein Kopf nur, wenn wirklich
 * nichts darin steht.
 */
describe("Der Modulkopf ohne Filter-Besitzer", () => {
  it("zeichnet die Aktionen des Moduls, auch ohne Suche", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { trailingActions: heute() }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(aktionen()!.querySelector("[data-heute]")).not.toBeNull()
    // Keine Suche und keine Pille: Die gehoeren dem Besitzer, und den gibt es nicht.
    expect(host.querySelector("input")).toBeNull()
    expect(host.querySelector("[data-filter-pill-trigger]")).toBeNull()
  })

  it("stellt sie rechtsbuendig, wie neben der Suche", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { trailingActions: heute() }),
      ),
    )
    expect(aktionen()!.className).toContain("ml-auto")
    // Der Platz steht in einer eigenen Zeile des Kopfes, nicht im Inhalt.
    expect(aktionen()!.closest("[data-module-head-content]")).not.toBeNull()
  })

  it("zeichnet sie auch ueber einer ueberlagerten Flaeche", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "map" },
        "KARTE",
        createElement(ModuleToolbar, { trailingActions: heute() }),
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(aktionen()!.querySelector("[data-heute]")).not.toBeNull()
  })

  it("verschwindet weiter, wenn auch das Modul nichts beitraegt", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    expect(kopf()!.hasAttribute("hidden")).toBe(true)
    expect(warnungen()).toEqual([])
  })

  it("verschwindet wieder, wenn das Modul seine Aktionen zurueckzieht", () => {
    const baum = (mitAktion: boolean) =>
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { trailingActions: mitAktion ? heute() : undefined }),
      )
    rendere(baum(true))
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    rendere(baum(false))
    expect(kopf()!.hasAttribute("hidden")).toBe(true)
    expect(aktionen()!.childNodes.length).toBe(0)
  })

  it("zeichnet die eigenen Chips des Moduls", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, {
          chipsExtra: createElement("span", { "data-extra": true }, "Nur meine"),
        }),
      ),
    )
    expect(host.querySelector("[data-module-head-chips] [data-extra]")).not.toBeNull()
  })
})

/**
 * Die Ursache im Karabirrdt: `FilterScope` stand INNERHALB des `ModuleFrame`.
 * Das Modul sah einen Besitzer, der Frame nicht. Seit Variante A zeichnet der
 * Kopf die Aktionen trotzdem, und das koennte die Fehlverschachtelung
 * verdecken. Darum meldet sie sich und nennt die Abhilfe.
 */
describe("Die Warnung bei fehlendem Filter-Besitzer", () => {
  it("nennt die Abhilfe, wenn FilterScope innerhalb von ModuleFrame steht", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(
          FilterScope,
          null,
          createElement(ModuleToolbar, { trailingActions: heute() }),
        ),
      ),
    )
    const texte = warnungen()
    expect(texte.length).toBe(1)
    expect(texte[0]).toContain("FilterScope")
    expect(texte[0]).toContain("außerhalb von ModuleFrame")
  })

  it("meldet eine Filterkarten-Erweiterung, die kein Ziel findet", () => {
    // Ohne Besitzer gibt es keine Pille und damit keine Filterkarte: Das
    // `drawerExtra` haette keinen Ort und ginge still verloren.
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, {
          drawerExtra: createElement("section", { "data-ort": true }, "Ort"),
        }),
      ),
    )
    const texte = warnungen()
    expect(texte.length).toBe(1)
    expect(texte[0]).toContain("drawerExtra")
    expect(texte[0]).toContain("außerhalb von ModuleFrame")
  })

  it("meldet sich nur einmal, nicht bei jedem Rendern", () => {
    const baum = (text: string) =>
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(
          FilterScope,
          null,
          createElement(ModuleToolbar, { trailingActions: createElement("button", null, text) }),
        ),
      )
    rendere(baum("eins"))
    rendere(baum("zwei"))
    rendere(baum("drei"))
    expect(warnungen().length).toBe(1)
  })

  it("schweigt im Normalfall mit dem Besitzer ueber der Flaeche", () => {
    rendere(
      createElement(
        FilterProvider,
        null,
        createElement(
          ModuleFrame,
          { moduleId: "feed" },
          createElement(ModuleToolbar, {
            trailingActions: heute(),
            drawerExtra: createElement("section", null, "Ort"),
          }),
        ),
      ),
    )
    expect(warnungen()).toEqual([])
  })

  it("schweigt bei einer nackten Steuerleiste ohne Flaeche", () => {
    rendere(createElement(ModuleToolbar, { trailingActions: heute(), drawerExtra: "Ort" }))
    expect(warnungen()).toEqual([])
  })
})
