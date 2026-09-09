// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { Item } from "@real-life-stack/data-interface"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MapView, userPositionBounds, type MapViewProps } from "../src/components/map/map-view"
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
  fitBounds = vi.fn<
    (bounds: { north: number; south: number; east: number; west: number }, options?: { maxZoom?: number; animate?: boolean }) => void
  >()
  focusOn = vi.fn()
  resize = vi.fn()
  getView() {
    return { center: [13.4, 52.5] as [number, number], zoom: 6, bounds: { west: 13, south: 52, east: 14, north: 53 } }
  }
  /** Die Kamera meldet ihren Halt — der Test loest ihn von Hand aus. */
  private sichtListener = new Set<() => void>()
  observeView(callback: () => void) {
    this.sichtListener.add(callback)
    return () => {
      this.sichtListener.delete(callback)
    }
  }
  /** Beendet die laufende Kamerafahrt (`moveend`). */
  flugEnde() {
    act(() => {
      for (const cb of [...this.sichtListener]) cb()
    })
  }
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

/** Steht weit draussen (Zoom 3) — wie eine Karte, die gerade die Welt zeigt. */
class WeitDraussenAdapter extends OrtungsAdapter {
  getView() {
    return { center: [0, 0] as [number, number], zoom: 3, bounds: { west: -180, south: -85, east: 180, north: 85 } }
  }
}

/**
 * Wie `stubbeOrtung`, aber die Berechtigung wird erst auf Zuruf beantwortet —
 * so laesst sich pruefen, was zwischen Klick und Antwort passieren darf.
 */
function stubbeOrtungMitBerechtigung() {
  const clearWatch = vi.fn()
  const watchPosition = vi.fn(() => 7)
  let erlaube: (() => void) | null = null
  const query = vi.fn(
    () =>
      new Promise<{ state: string }>((auf) => {
        erlaube = () => auf({ state: "granted" })
      }),
  )
  vi.stubGlobal("navigator", {
    ...navigator,
    geolocation: { watchPosition, clearWatch },
    permissions: { query },
  })
  return {
    watchPosition,
    clearWatch,
    antworte: async () => {
      erlaube?.()
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
    },
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

  it("startet eine laufende Ortung und zeigt den Genauigkeitskreis ganz", async () => {
    const ortung = stubbeOrtung()
    const adapter = new OrtungsAdapter()
    await rendereKarte(adapter)

    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(ortung.watchPosition).toHaveBeenCalled()
    expect(locateKnopf()!.getAttribute("aria-busy")).toBe("true")

    ortung.fix(8.6, 50.1, 500)
    expect(adapter.setUserPosition).toHaveBeenLastCalledWith({ lng: 8.6, lat: 50.1, accuracy: 500 })
    // Kein fester Zoom: Der Ausschnitt umfasst den Kreis (500m) mit Luft.
    const [bounds, optionen] = adapter.fitBounds.mock.calls.at(-1)!
    expect(optionen).toEqual(expect.objectContaining({ maxZoom: 18, animate: true }))
    const kreis = userPositionBounds({ lng: 8.6, lat: 50.1, accuracy: 500 }, 1)
    expect(bounds.north).toBeGreaterThanOrEqual(kreis.north)
    expect(bounds.south).toBeLessThanOrEqual(kreis.south)
    expect(bounds.east).toBeGreaterThanOrEqual(kreis.east)
    expect(bounds.west).toBeLessThanOrEqual(kreis.west)
    expect(adapter.focusOn).not.toHaveBeenCalled()
    expect(locateKnopf()!.getAttribute("aria-pressed")).toBe("true")
    expect(locateKnopf()!.getAttribute("aria-busy")).toBe("false")
  })

  it("traegt das Fadenkreuz der Utopia Map", async () => {
    vi.stubGlobal("navigator", { ...navigator, geolocation: { watchPosition: vi.fn(), clearWatch: vi.fn() } })
    await rendereKarte(new ProbeAdapter())
    expect(locateKnopf()!.querySelector('svg[viewBox="0 0 32 32"]')).not.toBeNull()
  })

  it("faehrt bei winziger Genauigkeit nicht auf die Maximalstufe", async () => {
    const ortung = stubbeOrtung()
    const adapter = new OrtungsAdapter()
    await rendereKarte(adapter)
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    ortung.fix(8.6, 50.1, 5)
    const [, optionen] = adapter.fitBounds.mock.calls.at(-1)!
    expect(optionen.maxZoom).toBe(18)
  })

  it("faehrt auch von weit draussen bis zum Ring durch", async () => {
    // Antons Beobachtung am festen Zoom 14: Von weit draussen stoppte die
    // Karte auf halbem Weg, und man sah gar keinen Ring. Der Zoom ergibt sich
    // aus dem Ring, nicht aus dem Ausgangszustand.
    const ortung = stubbeOrtung()
    const adapter = new WeitDraussenAdapter()
    await rendereKarte(adapter)
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    ortung.fix(8.6, 50.1, 30)
    const [bounds, optionen] = adapter.fitBounds.mock.calls.at(-1)!
    const ring = userPositionBounds({ lng: 8.6, lat: 50.1, accuracy: 30 }, 1)
    expect(bounds.north).toBeGreaterThanOrEqual(ring.north)
    expect(bounds.west).toBeLessThanOrEqual(ring.west)
    expect(optionen.maxZoom).toBe(18)
    // Welche Stufe daraus folgt, rechnet die Kamera — die Spanne sagt es
    // trotzdem: 360° bei Stufe 0, je Stufe halb so viel, auf 1024px Breite.
    const spanne = bounds.east - bounds.west
    const stufe = Math.log2((360 / spanne) * (1024 / 256))
    expect(stufe).toBeGreaterThan(14)
  })

  it("laesst die erste Kamerafahrt ausreden", async () => {
    // Antons Beobachtung: „Manchmal zoomt es schoen rein, manchmal bricht es
    // abrupt ab." Ein zweiter Fix waehrend des Flugs zog die Kamera nach — und
    // brach damit die laufende Fahrt auf halber Stufe ab.
    const ortung = stubbeOrtung()
    const adapter = new OrtungsAdapter()
    await rendereKarte(adapter)
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    ortung.fix(8.6, 50.1, 30)
    expect(adapter.fitBounds).toHaveBeenCalledTimes(1)

    // Waehrend der Flug laeuft: nur der Punkt wandert.
    ortung.fix(8.7, 50.2, 30)
    ortung.fix(8.8, 50.3, 30)
    expect(adapter.focusOn).not.toHaveBeenCalled()
    expect(adapter.fitBounds).toHaveBeenCalledTimes(1)
    expect(adapter.setUserPosition).toHaveBeenLastCalledWith({ lng: 8.8, lat: 50.3, accuracy: 30 })

    // Am Ziel wird genau EINMAL nachgeholt — auf den letzten Fix.
    adapter.flugEnde()
    expect(adapter.focusOn).toHaveBeenCalledTimes(1)
    expect(adapter.focusOn).toHaveBeenLastCalledWith([8.8, 50.3], expect.objectContaining({ animate: true }))

    // Danach geht es normal weiter.
    adapter.flugEnde()
    ortung.fix(8.9, 50.4, 30)
    expect(adapter.focusOn).toHaveBeenLastCalledWith([8.9, 50.4], expect.objectContaining({ animate: true }))
  })

  it("faellt ohne gemeldete Genauigkeit auf das Herankommen zurueck", async () => {
    const ortung = stubbeOrtung()
    const adapter = new OrtungsAdapter()
    await rendereKarte(adapter)
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    ortung.fix(8.6, 50.1, 0)
    expect(adapter.fitBounds).not.toHaveBeenCalled()
    expect(adapter.focusOn).toHaveBeenLastCalledWith(
      [8.6, 50.1],
      expect.objectContaining({ zoom: 14, animate: true }),
    )
  })

  it("zieht die Kamera nach — bis der Nutzer selbst schwenkt", async () => {
    const ortung = stubbeOrtung()
    const adapter = new OrtungsAdapter()
    await rendereKarte(adapter)
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    ortung.fix(8.6, 50.1)
    adapter.flugEnde()
    ortung.fix(8.7, 50.2)
    // Nachziehen ohne Zoom: Ein Ring, der mit der Genauigkeit waechst und
    // schrumpft, wuerde sonst dauernd nachzoomen und flackern.
    const [ziel, optionen] = adapter.focusOn.mock.calls.at(-1)!
    expect(ziel).toEqual([8.7, 50.2])
    expect(optionen).toEqual(expect.objectContaining({ animate: true }))
    expect(optionen).not.toHaveProperty("zoom")

    adapter.flugEnde()
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

  it("startet nicht mehr, wenn die Berechtigung erst nach dem Stop eintrifft", async () => {
    // Sonst lief `watchPosition` nachtraeglich an — die Ortung war aus, die
    // Beobachtung lief (#326).
    const ortung = stubbeOrtungMitBerechtigung()
    await rendereKarte(new OrtungsAdapter())
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    await ortung.antworte()
    expect(ortung.watchPosition).not.toHaveBeenCalled()
  })

  it("startet nicht mehr, wenn die Karte vor der Antwort verschwindet", async () => {
    const ortung = stubbeOrtungMitBerechtigung()
    await rendereKarte(new OrtungsAdapter())
    await act(async () => {
      locateKnopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    await act(async () => root.unmount())
    await ortung.antworte()
    expect(ortung.watchPosition).not.toHaveBeenCalled()
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
    ortung.fix(8.6, 50.1, 500)
    // Ohne die Positions-Faehigkeit sieht man keinen Ring — der Ausschnitt
    // stimmt trotzdem, er ist Sache der Kamera und nicht der Darstellung.
    expect(adapter.fitBounds).toHaveBeenCalledWith(
      expect.objectContaining({ north: expect.any(Number) }),
      expect.objectContaining({ maxZoom: 18 }),
    )
  })
})
