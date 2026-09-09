// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Item } from "@real-life-stack/data-interface"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CalendarView } from "../src/components/calendar/calendar-view"
import { MapView } from "../src/components/map/map-view"
import { ModuleFrame } from "../src/components/layout/module-frame"
import type { MapAdapter } from "../src/components/map/adapter"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })),
})
Element.prototype.scrollIntoView ??= () => {}

const ort: Item = {
  id: "a", type: "place", createdAt: "2026-07-17T00:00:00.000Z", createdBy: "test",
  data: { title: "a", position: { type: "Point", coordinates: [13.4, 52.5] } },
} as unknown as Item

const termin: Item = {
  id: "e", type: "event", tags: [], createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
  createdBy: "test", data: { title: "Gartentreffen", start: "2026-07-08T10:00:00.000Z" },
} as unknown as Item

function fakeAdapter(): MapAdapter {
  return {
    mount: async () => undefined, unmount: async () => undefined,
    setMarkers: vi.fn(), setView: vi.fn(), fitBounds: vi.fn(), focusOn: vi.fn(), resize: vi.fn(),
    getView: () => ({ center: [13.4, 52.5], zoom: 6, bounds: { west: 13, south: 52, east: 14, north: 53 } }),
    observeView: () => () => undefined,
    observeClicks: () => () => undefined,
    observeMarkerClicks: () => () => undefined,
  }
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

async function rendere(node: React.ReactNode) {
  await act(async () => {
    root.render(node)
    await Promise.resolve()
    await Promise.resolve()
  })
}

const karte = () =>
  createElement(MapView, {
    items: [ort], itemsLoading: false, inventoryKey: "space-a", createAdapter: fakeAdapter,
    initialView: { center: [13.4, 52.5], zoom: 6 }, viewportMode: "bbox-module" as const,
  })

const rahmen = () => host.querySelectorAll("[data-module-frame]")
const kopfSlot = () => host.querySelector("[data-module-head-slot]")
const controls = () => host.querySelector("[data-module-controls]")

/**
 * Eine Flaeche, die AUSSERHALB der App laeuft (Story, Test, apps/network),
 * bringt ihre Modulflaeche selbst mit — so wie sie seit #320 ihren
 * Filter-Besitzer mitbringt. Sonst faellt die `ModuleToolbar` auf ihren
 * Notausgang zurueck und die Pille steht mitten in der Schutzzone der Karte,
 * statt unten links.
 */
describe("Eine eingebettete Modulflaeche", () => {
  it("bringt der Karte Kopf und Ecke mit", async () => {
    await rendere(karte())
    expect(rahmen()).toHaveLength(1)
    expect(kopfSlot()!.querySelector("input")).not.toBeNull()
    expect(controls()!.querySelector("[data-filter-pill-trigger]")).not.toBeNull()
    // Kein Notausgang mehr: Die Leiste steht nicht an Ort und Stelle.
    expect(host.querySelector("[data-module-toolbar]")).toBeNull()
  })

  it("legt unter einer vorhandenen Flaeche keine zweite an", async () => {
    await rendere(createElement(ModuleFrame, { moduleId: "map" }, karte()))
    expect(rahmen()).toHaveLength(1)
    expect(controls()!.querySelector("[data-filter-pill-trigger]")).not.toBeNull()
  })

  it("bringt sie auch dem Kalender mit", async () => {
    await rendere(
      createElement(CalendarView, {
        events: [termin],
        initialVisibleDate: "2026-07-08T12:00:00.000Z",
        initialDate: "2026-07-08T12:00:00.000Z",
      }),
    )
    expect(rahmen()).toHaveLength(1)
    expect(kopfSlot()!.querySelector("input")).not.toBeNull()
    expect(controls()!.querySelector("[data-filter-pill-trigger]")).not.toBeNull()
    expect(host.textContent).toContain("Gartentreffen")
  })
})
