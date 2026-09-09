// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Item } from "@real-life-stack/data-interface"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MapView, type MapViewProps } from "../src/components/map/map-view"
import type {
  GlobeCapable,
  MapAdapter,
  MapMountOptions,
  UserGestureCapable,
  UserPosition,
  UserPositionCapable,
} from "../src/components/map/adapter"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})

const initialView: MapMountOptions = { center: [13.4, 52.5], zoom: 6 }
const punkt: Item = {
  id: "a",
  type: "place",
  createdAt: "2026-07-17T00:00:00.000Z",
  createdBy: "test",
  data: { title: "a", position: { type: "Point", coordinates: [13.4, 52.5] } },
} as unknown as Item

class ProbeAdapter implements MapAdapter {
  mount = vi.fn(async () => undefined)
  unmount = vi.fn(async () => undefined)
  setMarkers = vi.fn()
  setView = vi.fn()
  fitBounds = vi.fn()
  focusOn = vi.fn()
  resize = vi.fn()
  getView() {
    return { center: [13.4, 52.5] as [number, number], zoom: 6, bounds: { west: 13, south: 52, east: 14, north: 53 } }
  }
  observeView() { return () => undefined }
  observeClicks() { return () => undefined }
  observeMarkerClicks() { return () => undefined }
}

/** Adapter, der den Globus kann — wie MapLibre. */
class GlobusAdapter extends ProbeAdapter implements GlobeCapable {
  setProjection = vi.fn()
}

/** Adapter, der die eigene Position zeigen und Gesten melden kann. */
class OrtungsAdapter extends ProbeAdapter implements UserPositionCapable, UserGestureCapable {
  setUserPosition = vi.fn<(position: UserPosition | null) => void>()
  geste: (() => void) | null = null
  observeUserGesture(callback: () => void) {
    this.geste = callback
    return () => {
      this.geste = null
    }
  }
}

/** Ein gestubbtes `watchPosition`, das der Test von Hand weiterlaufen laesst. */
function stubbeOrtung() {
  const clearWatch = vi.fn()
  let melde: ((position: GeolocationPosition) => void) | null = null
  let scheitere: ((fehler: GeolocationPositionError) => void) | null = null
  const watchPosition = vi.fn((erfolg: PositionCallback, fehler?: PositionErrorCallback) => {
    melde = erfolg as (position: GeolocationPosition) => void
    scheitere = fehler as ((fehler: GeolocationPositionError) => void) | null
    return 7
  })
  vi.stubGlobal("navigator", { ...navigator, geolocation: { watchPosition, clearWatch }, permissions: undefined })
  return {
    watchPosition,
    clearWatch,
    fix: (lng: number, lat: number, accuracy = 25) =>
      act(() => {
        melde?.({ coords: { longitude: lng, latitude: lat, accuracy } } as GeolocationPosition)
      }),
    fehler: () =>
      act(() => {
        scheitere?.({ code: 1, message: "denied" } as GeolocationPositionError)
      }),
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
  vi.unstubAllGlobals()
})

async function rendereKarte(adapter: MapAdapter, props: Partial<MapViewProps> = {}) {
  await act(async () => {
    root.render(
      createElement(MapView, {
        items: [punkt],
        itemsLoading: false,
        inventoryKey: "space-a",
        createAdapter: () => adapter,
        initialView,
        viewportMode: "bbox-module",
        ...props,
      } as MapViewProps),
    )
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Der Knopf traegt zwei Namen — je nachdem, was ein Klick jetzt tut. */
const locateKnopf = () =>
  host.querySelector<HTMLButtonElement>(
    "[aria-label='Standort verfolgen'], [aria-label='Standortverfolgung beenden']",
  )

/**
 * Der Globus ist keine Ansichtssache mehr, sondern die Karte: Wo der Adapter
 * ihn kann, startet sie darin. Der Umschalter entfaellt — er stellte eine
 * Frage, auf die es nur eine Antwort gab.
 */
describe("Die Projektion", () => {
  it("startet als Globus, wo der Adapter ihn kann", async () => {
    const adapter = new GlobusAdapter()
    await rendereKarte(adapter)
    expect(adapter.setProjection).toHaveBeenCalledWith("globe")
    expect(host.querySelector("[aria-label='Globusansicht']")).toBeNull()
  })

  it("bleibt Mercator, wo er es nicht kann", async () => {
    const adapter = new ProbeAdapter()
    await rendereKarte(adapter)
    // Kein Umschalter, kein Globus-Versprechen: Leaflet kann es nicht.
    expect(host.querySelector("[aria-label='Globusansicht']")).toBeNull()
    expect(host.innerHTML).not.toContain("rls-globe-sky")
  })
})

/**
 * „Wo bin ich" ist eine Frage an die Karte, nicht an ein Modul: Der Knopf
 * zentriert die Kamera, mehr nicht — keine eigene Markierung, kein zweiter
 * Zustand.
 */
describe("Der Standort-Knopf", () => {
  it("fehlt, wo der Browser keinen Standort kennt", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined })
    await rendereKarte(new ProbeAdapter())
    expect(locateKnopf()).toBeNull()
  })

  it("startet eine laufende Ortung, zeigt die Position und faehrt hin", async () => {
    const ortung = stubbeOrtung()
    const adapter = new OrtungsAdapter()
    await rendereKarte(adapter)

    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(ortung.watchPosition).toHaveBeenCalled()
    expect(locateKnopf()!.getAttribute("aria-busy")).toBe("true")

    ortung.fix(8.6, 50.1)
    expect(adapter.setUserPosition).toHaveBeenLastCalledWith({ lng: 8.6, lat: 50.1, accuracy: 25 })
    expect(adapter.focusOn).toHaveBeenLastCalledWith(
      [8.6, 50.1],
      expect.objectContaining({ zoom: 14, animate: true }),
    )
    expect(locateKnopf()!.getAttribute("aria-pressed")).toBe("true")
    expect(locateKnopf()!.getAttribute("aria-busy")).toBe("false")
  })

  it("zieht die Kamera nach — bis der Nutzer selbst schwenkt", async () => {
    const ortung = stubbeOrtung()
    const adapter = new OrtungsAdapter()
    await rendereKarte(adapter)
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    ortung.fix(8.6, 50.1)
    ortung.fix(8.7, 50.2)
    expect(adapter.focusOn).toHaveBeenLastCalledWith([8.7, 50.2], expect.objectContaining({ animate: true }))

    // Wer selbst schwenkt, will bleiben, wo er hinschaut.
    act(() => adapter.geste?.())
    const vorher = adapter.focusOn.mock.calls.length
    ortung.fix(8.8, 50.3)
    expect(adapter.focusOn.mock.calls.length).toBe(vorher)
    // Der Marker wandert trotzdem weiter.
    expect(adapter.setUserPosition).toHaveBeenLastCalledWith({ lng: 8.8, lat: 50.3, accuracy: 25 })
  })

  it("beendet die Ortung beim zweiten Klick und raeumt die Markierung weg", async () => {
    const ortung = stubbeOrtung()
    const adapter = new OrtungsAdapter()
    await rendereKarte(adapter)
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    ortung.fix(8.6, 50.1)

    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(ortung.clearWatch).toHaveBeenCalledWith(7)
    expect(adapter.setUserPosition).toHaveBeenLastCalledWith(null)
    expect(locateKnopf()!.getAttribute("aria-pressed")).toBe("false")
  })

  it("beendet sie auch, wenn die Karte verschwindet", async () => {
    const ortung = stubbeOrtung()
    await rendereKarte(new OrtungsAdapter())
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    await act(async () => root.unmount())
    expect(ortung.clearWatch).toHaveBeenCalledWith(7)
    // Der zweite Abbau im afterEach darf nicht scheitern.
    root = createRoot(host)
  })

  it("sagt es, wenn der Standort verweigert wird, und geht wieder aus", async () => {
    const ortung = stubbeOrtung()
    await rendereKarte(new OrtungsAdapter())
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    ortung.fehler()

    expect(host.textContent).toContain("Standort")
    expect(locateKnopf()!.getAttribute("aria-pressed")).toBe("false")
    expect(locateKnopf()!.getAttribute("aria-busy")).toBe("false")
  })

  it("zentriert auch ohne Positions-Faehigkeit des Adapters", async () => {
    // Leaflet zeigt keinen eigenen Punkt — hinfahren tut die Karte trotzdem.
    const ortung = stubbeOrtung()
    const adapter = new ProbeAdapter()
    await rendereKarte(adapter)
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    ortung.fix(8.6, 50.1)
    expect(adapter.focusOn).toHaveBeenLastCalledWith([8.6, 50.1], expect.objectContaining({ zoom: 14 }))
  })
})
