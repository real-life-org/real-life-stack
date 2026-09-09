// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FilterProvider, useSharedFilter } from "../src/components/filter/filter-store"
import { FilterPill } from "../src/components/filter/filter-pill"
import type { FilterTypeOption } from "../src/components/filter/types"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

const TYPEN: FilterTypeOption[] = [
  { id: "event", label: "Termin" },
  { id: "task", label: "Aufgabe" },
  { id: "place", label: "Ort" },
]

/** Liest den geteilten Filter mit, damit der Test sieht, was ein Klick tat. */
function Probe() {
  const { value } = useSharedFilter()
  return createElement(
    "span",
    { "data-typen": value.types.join(","), "data-tags": value.tags.join(",") },
    null,
  )
}

function rendere(extra?: ReactNode) {
  act(() =>
    root.render(
      createElement(
        FilterProvider,
        null,
        createElement(FilterPill, {
          availableTags: ["garten", "ernte"],
          availableTypes: TYPEN,
          drawerExtra: extra,
        }),
        createElement(Probe),
      ),
    ),
  )
}

const klick = (el: Element | null | undefined) =>
  act(() => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })

const pille = () => host.querySelector("[data-filter-pill-trigger]")
const karte = () => host.querySelector("[data-filter-card]")
const typChip = (label: string) =>
  [...host.querySelectorAll("[data-filter-card] button")].find((b) => b.textContent?.trim() === label)
const typen = () => host.querySelector("[data-typen]")!.getAttribute("data-typen")

/**
 * Der Filter ist eine Pille unten links, die an Ort und Stelle zur Karte wird
 * (Design-Board 2a/2g). Kein Filter-Knopf mehr im Kopf — was gerade filtert,
 * bleibt dagegen oben in der Chip-Zeile des Kopfes.
 */
describe("Die Filter-Pille", () => {
  it("zeigt geschlossen den Trichter mit Label", () => {
    rendere()
    expect(pille()).not.toBeNull()
    expect(pille()!.textContent).toContain("Filter")
    expect(karte()).toBeNull()
  })

  it("wird bei Klick zur Karte — und die Pille verschwindet dabei", () => {
    rendere()
    klick(pille())
    expect(karte()).not.toBeNull()
    // Im Board gibt es keinen Zustand mit Pille UND Karte.
    expect(pille()).toBeNull()
  })

  it("schliesst ueber das ✕", () => {
    rendere()
    klick(pille())
    klick(host.querySelector("[data-filter-card] [aria-label='Filter schließen']"))
    expect(karte()).toBeNull()
    expect(pille()).not.toBeNull()
  })

  it("schliesst mit Escape", () => {
    rendere()
    klick(pille())
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    expect(karte()).toBeNull()
  })

  it("schliesst bei einem Klick daneben", () => {
    rendere()
    klick(pille())
    act(() => {
      document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }))
    })
    expect(karte()).toBeNull()
  })

  it("nimmt die Extras des Moduls als weitere Sektion auf", () => {
    rendere(createElement("div", { "data-extra": true }, "Nur meine"))
    klick(pille())
    expect(host.querySelector("[data-filter-card] [data-extra]")).not.toBeNull()
  })
})

/**
 * Typ-Chips sind alle aktiv, solange nichts gewaehlt ist: Der leere Wert
 * bedeutet „kein Filter" — gezeigt wird also alles, und das Abwaehlen eines
 * Typs blendet ihn aus (Board 2g).
 */
describe("Die Typ-Chips", () => {
  it("stehen alle aktiv, wenn nichts gewaehlt ist", () => {
    rendere()
    klick(pille())
    for (const typ of TYPEN) {
      expect(typChip(typ.label)!.getAttribute("aria-pressed")).toBe("true")
    }
  })

  it("setzt beim Abwaehlen den Rest", () => {
    rendere()
    klick(pille())
    klick(typChip("Termin"))
    expect(typen()).toBe("task,place")
  })

  it("faellt beim Abwaehlen des letzten auf leer zurueck", () => {
    rendere()
    klick(pille())
    klick(typChip("Termin"))
    klick(typChip("Aufgabe"))
    expect(typen()).toBe("place")
    klick(typChip("Ort"))
    expect(typen()).toBe("")
  })
})

describe("Aktive Filter", () => {
  it("stehen in der Karte als gewaehlte Chips — und NICHT neben der Pille", () => {
    rendere()
    klick(pille())
    klick([...host.querySelectorAll("[data-filter-card] button")].find((b) => b.textContent?.trim() === "garten"))
    expect(
      [...host.querySelectorAll("[data-filter-card] button")]
        .find((b) => b.textContent?.trim() === "garten")!
        .getAttribute("aria-pressed"),
    ).toBe("true")

    klick(host.querySelector("[data-filter-card] [aria-label='Filter schließen']"))
    // Die Pille oeffnet nur; was filtert, steht oben im Kopf der Flaeche.
    expect(host.querySelector("[data-filter-chips]")).toBeNull()
  })
})

describe("Ohne Besitzer", () => {
  it("wirft, statt still in einen eigenen Zustand zu schreiben", () => {
    const stumm = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => act(() => root.render(createElement(FilterPill, {})))).toThrow(/FilterProvider/)
    stumm.mockRestore()
  })
})
