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
/** Der ganze Kopfbereich: Suchzeile plus Chip-Zeile. Er traegt die Geometrie. */
const kopfBereich = () => host.querySelector("[data-module-head-content]")
/** Der Platz NEBEN der Suche, in den das Modul seine Knoepfe portalt. */
const aktionen = () => host.querySelector("[data-module-head-actions]")
/** Die Chip-Zeile unter der Suche — sie gehoert der Flaeche. */
const chipZeile = () => host.querySelector("[data-filter-chips]")
/** Der Platz IN der Chip-Zeile, in den das Modul seine eigenen Chips portalt. */
const chipSlot = () => host.querySelector("[data-module-head-chips]")
const scrollbereich = () => host.querySelector("[data-module-scroll]")

/**
 * Die Modulflaeche ist eine Spalte: fester Kopf, darunter der Scrollbereich
 * (Spec 01 → „Die Modulflaeche ist eine Spalte"). Der Kopf gehoert der
 * Flaeche, das Modul reicht seine Steuerleiste hinein.
 */
describe("Der Modulkopf", () => {
  it("zeigt die Suche auch dann, wenn das Modul nichts beitraegt", () => {
    // Die Suche gehoert der FLAECHE und zieht sich ausnahmslos durch alle
    // Module (Anton, 19.09.2026). Sie steht also, bevor irgendein Modul etwas
    // hineinreicht.
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(kopfBereich()!.querySelector("input")).not.toBeNull()
    // Die Slots des Moduls sind als Portal-Ziele da, aber leer.
    expect(chipSlot()!.childNodes.length).toBe(0)
    expect(aktionen()!.childNodes.length).toBe(0)
    // Die Chip-Zeile selbst gehoert der Flaeche und steht schon bereit.
    expect(chipZeile()).not.toBeNull()
  })

  it("stellt die Knoepfe des Moduls NEBEN die Suche, nicht darunter", () => {
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
    // Suche und Knopf teilen sich eine Zeile: der Knopf liegt im Platz neben
    // der Suche, und beide haben denselben Elternteil.
    const feld = kopfBereich()!.querySelector("input")!
    const heute = aktionen()!.querySelector("[data-heute]")
    expect(heute).not.toBeNull()
    expect(feld.closest("[data-module-head-content]")!.contains(aktionen()!)).toBe(true)
    // Der Filter-KNOPF ist unten (Board 2g) — die aktiven Filter bleiben oben.
    expect(kopfBereich()!.querySelector("[data-filter-pill-trigger]")).toBeNull()
    expect(chipZeile()).not.toBeNull()
  })

  it("gibt es genau einmal, auch wenn zwei Leisten in denselben Kopf reichen", () => {
    // Der Befund, der zu dieser Umstellung fuehrte (Anton, 19.09.2026): Im
    // Kalender stand die Suche zweimal untereinander, weil die Linse eine
    // Leiste mitbrachte und die Flaeche darueber eine zweite. Seit die Suche
    // der Flaeche gehoert, kann das nicht mehr passieren — egal wie viele
    // Leisten hineinreichen.
    //
    // Nur fuer die SUCHE. Die Chip-Zeile kann weiter doppelt stehen, weil sie
    // die geteilten Filterwerte liest, aber vom Modul gerendert wird — sie
    // gehoert aus demselben Grund der Flaeche und wandert mit dem
    // Typ-Vokabular hoch (Schritt A des Folge-PRs).
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { availableTags: ["garten"] }),
        createElement(ModuleToolbar, {
          trailingActions: createElement("button", { "data-heute": true }, "Heute"),
        }),
        "INHALT",
      ),
    )
    expect(host.querySelectorAll("input").length).toBe(1)
    expect(aktionen()!.querySelector("[data-heute]")).not.toBeNull()
  })

  it("verschwindet nur ohne Filter-Besitzer", () => {
    // Ohne Besitzer gibt es keine Suche, und ohne Beitrag des Moduls auch
    // sonst nichts — dann waere eine leere Zeile schlimmer als kein Kopf
    // (Spec 01, Regel 4).
    act(() => root.render(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT")))
    expect(kopf()!.hasAttribute("hidden")).toBe(true)
  })

  it("laesst die Chip-Zeile leer, wenn das Modul-Extra gerade nichts rendert", () => {
    // Ein leeres Fragment als `chipsExtra` hielt frueher den Kopf am Leben:
    // eine unsichtbare Zeile mit 32px Polster (Copilot-Befund). Der Kopf steht
    // heute wegen der Suche — die CHIP-Zeile muss trotzdem leer bleiben.
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { chipsExtra: undefined }),
        "INHALT",
      ),
    )
    expect(chipSlot()!.childNodes.length).toBe(0)
  })

  it("fuellt die Chip-Zeile, sobald ein Modul-Extra aktiv ist", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, {
          chipsExtra: createElement("span", { "data-extra": true }, "Nur meine"),
        }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(chipSlot()!.querySelector("[data-extra]")).not.toBeNull()
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
    // Story, Test, eingebettete Ansicht (Spec 01, Regel 3): Was das MODUL
    // beitraegt, verschwindet nicht spurlos, wenn es keinen Kopf gibt. Was der
    // FLAECHE gehoert, gibt es dort nicht — weder Suche noch Filterkarte noch
    // die Chips der aktiven Filter.
    rendere(
      createElement(ModuleToolbar, {
        trailingActions: createElement("button", { "data-heute": true }, "Heute"),
        chipsExtra: createElement("span", { "data-extra": true }, "Nur meine"),
      }),
    )
    const leiste = host.querySelector("[data-module-toolbar]")
    expect(leiste).not.toBeNull()
    expect(leiste!.querySelector("[data-heute]")).not.toBeNull()
    expect(leiste!.querySelector("[data-extra]")).not.toBeNull()
    expect(leiste!.querySelector("[data-filter-pill-trigger]")).toBeNull()
    expect(leiste!.querySelector("input")).toBeNull()
  })

  it("haelt die Kartenecke frei, auch wenn das Modul sonst nichts beitraegt", () => {
    // Codex-Review zu #405: Die Anmeldung von `clearsTopLeft` hing am
    // Kopf-Beitrag. Seit die Suche der Flaeche gehoert, zaehlt sie nicht mehr
    // als Beitrag — eine Karte ohne Ortungsknopf (kein navigator.geolocation)
    // und ohne aktive Filter meldete deshalb nichts an, und die Suche lag auf
    // den Zoom-Knoepfen. Dass das Modul dort Knoepfe fuehrt, ist eine Aussage
    // ueber seine Flaeche und unabhaengig vom Kopf-Beitrag.
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "map" },
        "KARTE",
        createElement(ModuleToolbar, { clearsTopLeft: true }),
      ),
    )
    const schutzzone = kopf()!.closest("[data-panel-safe-area]") ?? kopf()!.parentElement!
    expect(schutzzone.className).toContain("pl-16")
    // Die Suche steht trotzdem — sie gehoert der Flaeche.
    expect(kopfBereich()!.querySelector("input")).not.toBeNull()
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
    expect(kopfBereich()!.querySelector("input")).not.toBeNull()
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
    const chips = chipZeile()
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
      expect(kopfBereich()!.className).toContain(klasse)
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
