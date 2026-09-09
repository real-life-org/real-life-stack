// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import {
  FilterProvider,
  FilterScope,
  ModuleFilterBar,
  useSharedFilter,
} from "../src/components/filter"
import { CalendarView } from "../src/components/calendar/calendar-view"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))
// Der Kalender scrollt das aktive Element in den Blick; jsdom kennt das nicht.
Element.prototype.scrollIntoView ??= () => {}

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

const rendere = (node: ReactNode) => act(() => root.render(node))

/** Tippen ins Suchfeld — React liest den Wert ueber den Prototyp-Setter. */
function tippe(feld: HTMLInputElement, text: string) {
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!
  act(() => {
    setzer.call(feld, text)
    feld.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

const event = (id: string, title: string): Item =>
  ({
    id,
    type: "event",
    tags: [],
    data: { title, start: "2026-07-08T10:00:00.000Z", end: "2026-07-08T11:00:00.000Z" },
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    createdBy: "u",
  }) as unknown as Item

/**
 * Der Filter hat GENAU EINEN Besitzer. Ein stiller lokaler Rueckfall pro
 * Hook-Aufruf hatte zwei: Die Leiste schrieb in ihren Zustand, der Inhalt las
 * einen anderen. Sichtbar wurde das am Kalender ohne App-Shell — „Garten" stand
 * im Suchfeld, gefiltert wurde nichts.
 */
describe("Eine eingebettete Flaeche bringt ihren Filter selbst mit", () => {
  it("filtert im Kalender ohne App-Provider", () => {
    rendere(
      createElement(CalendarView, {
        events: [event("a", "Gartentreffen"), event("b", "Bauwagen streichen")],
        initialVisibleDate: "2026-07-08T12:00:00.000Z",
        initialDate: "2026-07-08T12:00:00.000Z",
        initialViewMode: "list" as const,
      }),
    )
    expect(host.textContent).toContain("Gartentreffen")
    expect(host.textContent).toContain("Bauwagen streichen")

    tippe(host.querySelector("input")!, "Garten")

    expect(host.textContent).toContain("Gartentreffen")
    expect(host.textContent).not.toContain("Bauwagen streichen")
  })
})

describe("FilterScope", () => {
  it("legt unter einem vorhandenen Provider keinen zweiten an", () => {
    function Probe() {
      const { searchText, setSearchText } = useSharedFilter()
      return createElement(
        "button",
        { "data-probe": true, onClick: () => setSearchText("innen") },
        searchText,
      )
    }
    function Aussen() {
      const { searchText } = useSharedFilter()
      return createElement("span", { "data-aussen": true }, searchText)
    }
    rendere(
      createElement(
        FilterProvider,
        null,
        createElement(Aussen),
        createElement(FilterScope, null, createElement(Probe)),
      ),
    )
    act(() => {
      host.querySelector<HTMLButtonElement>("[data-probe]")!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      )
    })
    // Ein zweiter Provider haette den Schreibvorgang eingesperrt.
    expect(host.querySelector("[data-aussen]")!.textContent).toBe("innen")
  })
})

describe("ModuleFilterBar ohne Besitzer", () => {
  it("wirft, statt still in einen eigenen Zustand zu schreiben", () => {
    const stumm = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => rendere(createElement(ModuleFilterBar, {}))).toThrow(/FilterProvider/)
    stumm.mockRestore()
  })
})
