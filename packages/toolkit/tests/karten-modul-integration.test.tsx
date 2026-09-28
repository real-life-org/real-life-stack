// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { FilterProvider } from "../src/components/filter/filter-store"
import { MemoryFocusProvider } from "../src/hooks/use-item-focus"
import { CreateHostProvider } from "../src/components/host/create-host"
import { DetailHostProvider } from "../src/components/host/detail-host"
import { ModuleHost } from "../src/components/host/module-host"
import { MapAdapterProvider, MapModule } from "../src/modules/map-module"
import type { MapAdapter, MapMarkerSpec, MapMountOptions } from "../src/components/map/adapter"
import type { ModuleEntry } from "../src/lib/module-register"
import { Map as MapIcon } from "lucide-react"

/**
 * Integration (S4b, Brief „Struktur statt Einzelfixes"): das gemountete
 * Karten-Modul gegen einen echten Connector. Vertrag map.md → „Karten-
 * Inventar als Projektion" und „Abgeleitete Position": Was die Karte zeigt,
 * folgt der aktuellen Abfrage und den lebenden Items — über Ortswechsel,
 * Kantenwechsel, Löschen und Ausschnittwechsel hinweg, ohne alten Marker.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

type Bounds = { west: number; south: number; east: number; north: number }

class ProbeAdapter implements MapAdapter {
  readonly markerSets: MapMarkerSpec[][] = []
  bounds: Bounds = { west: 13, south: 52, east: 14, north: 53 }
  private viewListeners = new Set<() => void>()
  mount = vi.fn(async (_c: HTMLElement, _o: MapMountOptions) => {})
  unmount = vi.fn(async () => {})
  setMarkers = vi.fn((markers: MapMarkerSpec[]) => { this.markerSets.push(markers) })
  setView = vi.fn()
  fitBounds = vi.fn()
  focusOn = vi.fn()
  resize = vi.fn()
  getView() { return { center: [13.4, 52.5] as [number, number], zoom: 12, bounds: this.bounds } }
  observeView(cb: () => void) { this.viewListeners.add(cb); return () => { this.viewListeners.delete(cb) } }
  observeClicks() { return () => undefined }
  observeMarkerClicks() { return () => undefined }
  moveTo(bounds: Bounds) { this.bounds = bounds; for (const cb of this.viewListeners) cb() }
  last(): Map<string, [number, number]> {
    return new Map((this.markerSets.at(-1) ?? []).map((m) => [m.id, m.position as [number, number]]))
  }
}

const ME = "u1"
const item = (id: string, type: string, data: Record<string, unknown>, relations: Item["relations"] = []): Item =>
  ({ id, type, createdAt: "2026-09-21T10:00:00.000Z", createdBy: ME, data, relations }) as Item
const point = (lng: number, lat: number) => ({ type: "Point", coordinates: [lng, lat] })

const HALLE = item("halle", "place", { title: "Halle", position: point(13.4, 52.5) })
const AM_ORT = item("ev-ort", "event", { title: "Am Ort" }, [{ predicate: "locatedAt", target: "item:halle" }])
const EIGEN = item("ev-eigen", "event", { title: "Eigene Position", position: point(13.6, 52.6) })

let host: HTMLDivElement
let root: Root
let adapter: ProbeAdapter
let connector: MockConnector

beforeEach(async () => {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host)
  connector = new MockConnector(
    {
      items: [HALLE, AM_ORT, EIGEN],
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: ME, displayName: "Uli" }],
      groupMembers: { g: [ME] },
      groupItems: { g: [HALLE.id, AM_ORT.id, EIGEN.id] },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("g")
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers() })

async function settle(ms = 20) {
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, ms)) })
}

async function mount() {
  adapter = new ProbeAdapter()
  const entry: ModuleEntry = { id: "map", label: "Karte", icon: MapIcon, fill: "bleed", presents: ["position"], loads: "module", view: MapModule }
  const tree: ReactNode = createElement(ConnectorProvider, { connector: connector as never },
    createElement(FilterProvider, null,
      createElement(MemoryFocusProvider, { module: "map", scope: "g" } as never,
        createElement(DetailHostProvider, null,
          createElement(CreateHostProvider, null,
            createElement(MapAdapterProvider, { createAdapter: () => adapter },
              createElement(ModuleHost, { entry, groupId: "g", active: true })))))))
  await act(async () => { root.render(tree) })
  await settle()
}

describe("Karten-Modul: Projektion und abgeleitete Position (Integration)", () => {
  it("Ort bewegt, Kante umgehängt und entfernt, Event gelöscht, Ausschnitt gewechselt — nie ein alter Marker", async () => {
    await mount()
    expect(adapter.last().get("halle")).toEqual([13.4, 52.5])
    expect(adapter.last().get("ev-ort")).toEqual([13.4, 52.5])
    expect(adapter.last().get("ev-eigen")).toEqual([13.6, 52.6])

    // Der Ort zieht um: das Event folgt.
    await act(async () => { await connector.updateItem("halle", { data: { title: "Halle", position: point(13.5, 52.7) } }) })
    await settle()
    expect(adapter.last().get("ev-ort")).toEqual([13.5, 52.7])

    // Ein Event mit eigener Position wird an den Ort umgehängt: kein Marker an der alten Stelle.
    await act(async () => { await connector.updateItem("ev-eigen", { data: { title: "Eigene Position" }, relations: [{ predicate: "locatedAt", target: "item:halle" }] }) })
    await settle()
    expect(adapter.last().get("ev-eigen")).toEqual([13.5, 52.7])

    // Die Kante entfällt: kein Marker mehr.
    await act(async () => { await connector.updateItem("ev-ort", { relations: [] }) })
    await settle()
    expect(adapter.last().has("ev-ort")).toBe(false)

    // Ausschnitt weg und zurück: nichts Altes, nur der aktuelle Stand.
    await act(async () => { adapter.moveTo({ west: 0, south: 0, east: 1, north: 1 }) })
    await settle(100)
    expect([...adapter.last().keys()]).toEqual([])
    await act(async () => { adapter.moveTo({ west: 13, south: 52, east: 14, north: 53 }) })
    await settle(100)
    expect([...adapter.last().keys()].sort()).toEqual(["ev-eigen", "halle"])

    // Das Event wird gelöscht: kein Marker.
    await act(async () => { await connector.deleteItem("ev-eigen") })
    await settle()
    expect([...adapter.last().keys()]).toEqual(["halle"])
  })
})
