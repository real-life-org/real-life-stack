// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

import { LeafletMapAdapter } from "../src/components/map/adapters/leaflet"

/**
 * Eine Fake-Karte, die genug von Leaflet nachbildet: Ereignisse, Container und
 * die beiden Ebenen des Standorts.
 */
function fakeLeaflet() {
  const container = document.createElement("div")
  const ebenen = new Set<unknown>()
  const listener = new Map<string, Set<(e?: unknown) => void>>()
  const karte = {
    getContainer: () => container,
    on(typ: string, cb: (e?: unknown) => void) {
      for (const t of typ.split(" ")) {
        if (!listener.has(t)) listener.set(t, new Set())
        listener.get(t)!.add(cb)
      }
    },
    off() {},
    remove: vi.fn(),
    hasLayer: (ebene: unknown) => ebenen.has(ebene),
    removeLayer: (ebene: unknown) => ebenen.delete(ebene),
    setView: vi.fn(),
    fitBounds: vi.fn(),
    getCenter: () => ({ lat: 0, lng: 0 }),
    getZoom: () => 5,
    getBounds: () => ({ getNorth: () => 1, getSouth: () => 0, getEast: () => 1, getWest: () => 0 }),
    emit: (typ: string, e?: unknown) => listener.get(typ)?.forEach((cb) => cb(e)),
    ebenen,
    container,
  }
  const ebene = () => {
    const self = {
      addTo: (ziel: typeof karte) => {
        ziel.ebenen.add(self)
        return self
      },
      setLatLng: vi.fn(),
      setRadius: vi.fn(),
    }
    return self
  }
  const leaflet = { circle: () => ebene(), circleMarker: () => ebene() }
  return { karte, leaflet }
}

/** Hängt Fake-Karte und Fake-Leaflet in einen Adapter, ohne echtes Mounten. */
function mitFakeKarte(adapter: LeafletMapAdapter, karte: unknown, leaflet: unknown) {
  const innen = adapter as unknown as { mapInstance: unknown; leafletInstance: unknown }
  innen.mapInstance = karte
  innen.leafletInstance = leaflet
  return adapter
}

/**
 * Zwei Befunde mit einem Grund: Der Adapter hielt Ortungs-Zustand über das
 * Ende seiner Karte hinaus — die Ebenen des Standorts und die Gesten-Hörer.
 * Beim nächsten Mount aktualisierte er dann abgelöste Ebenen auf einer toten
 * Karte, statt neue anzulegen.
 */
describe("Leaflet: der Standort gehört zur Karte, nicht zum Adapter", () => {
  it("legt ihn nach einem Remount auf der NEUEN Karte an", async () => {
    const adapter = new LeafletMapAdapter()
    const erste = fakeLeaflet()
    mitFakeKarte(adapter, erste.karte, erste.leaflet)
    adapter.setUserPosition({ lng: 8.6, lat: 50.1, accuracy: 25 })
    expect(erste.karte.ebenen.size).toBe(2)

    await adapter.unmount()

    const zweite = fakeLeaflet()
    mitFakeKarte(adapter, zweite.karte, zweite.leaflet)
    adapter.setUserPosition({ lng: 8.7, lat: 50.2, accuracy: 30 })
    expect(zweite.karte.ebenen.size).toBe(2)
  })

  it("vergisst die Gesten-Hoerer der alten Karte", async () => {
    const adapter = new LeafletMapAdapter()
    const karte = fakeLeaflet()
    mitFakeKarte(adapter, karte.karte, karte.leaflet)
    const gesehen = vi.fn()
    adapter.observeUserGesture(gesehen)

    await adapter.unmount()
    const innen = adapter as unknown as { gestureListeners: Set<() => void> }
    expect(innen.gestureListeners.size).toBe(0)
  })
})

/**
 * Das Rad kommt am Container an, nicht an der Karte: Leaflets ScrollWheelZoom
 * bindet den Container selbst, `map.on("wheel", …)` bekam nie ein Ereignis —
 * die Ortung folgte nach dem Zoomen von Hand einfach weiter.
 */
describe("Leaflet: das Rad zählt als Geste", () => {
  it("meldet ein echtes Wheel-Ereignis am Container", async () => {
    const adapter = new LeafletMapAdapter()
    const karte = fakeLeaflet()
    mitFakeKarte(adapter, karte.karte, karte.leaflet)
    // Die Verdrahtung passiert beim Mounten; hier direkt der Pfad, den sie legt.
    const innen = adapter as unknown as { verdrahteGesten(map: unknown): void }
    innen.verdrahteGesten(karte.karte)

    const gesehen = vi.fn()
    adapter.observeUserGesture(gesehen)
    karte.karte.container.dispatchEvent(new WheelEvent("wheel", { bubbles: true }))
    expect(gesehen).toHaveBeenCalledTimes(1)

    // Eine programmatische Fahrt ist keine Geste.
    karte.karte.emit("zoomstart")
    karte.karte.emit("movestart")
    expect(gesehen).toHaveBeenCalledTimes(1)

    await adapter.unmount()
    karte.karte.container.dispatchEvent(new WheelEvent("wheel", { bubbles: true }))
    expect(gesehen).toHaveBeenCalledTimes(1)
  })
})
