// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { hasViewportPadding } from "../src/components/map/adapter"
import { MapLibreMapAdapter } from "../src/components/map/adapters/maplibre"
import { LeafletMapAdapter } from "../src/components/map/adapters/leaflet"
import { mapViewFocusInsets } from "../src/components/map/map-view"

/**
 * Ein offenes Panel verdeckt die rechte Hälfte der Karte. Bisher rechnete
 * JEDE Bewegung den sichtbaren Rest neu aus (`focusOffsetFor`) — was nur die
 * Bewegungen erwischte, die wir selbst auslösen. Zoomt jemand von Hand heraus,
 * wächst der Globus weiter um die Mitte des Containers und wandert hinter das
 * Panel.
 *
 * Kamera-Polsterung dreht das um: Man sagt der Karte EINMAL, wo ihre Mitte
 * liegt, und alles Weitere stimmt von selbst — auch das, was wir nicht in der
 * Hand haben.
 */
function mitFakeKarte<T>(adapter: T, karte: unknown): T {
  Object.assign(adapter as object, { mapInstance: karte })
  return adapter
}

describe("Wer die Kamera polstern kann", () => {
  it("MapLibre kann es", () => {
    expect(hasViewportPadding(new MapLibreMapAdapter())).toBe(true)
  })

  /**
   * Leaflet hat kein Gegenstück: `fitBounds` nimmt zwar ein Padding, die
   * Kamera selbst kennt keins. Die Fähigkeit zu behaupten wäre schlimmer als
   * sie nicht zu haben — dann verschöbe die Karte nichts und niemand wüsste
   * warum. Ohne sie bleibt es beim Weg über die einzelne Bewegung.
   */
  it("Leaflet kann es nicht — und behauptet es auch nicht", () => {
    expect(hasViewportPadding(new LeafletMapAdapter())).toBe(false)
  })
})

describe("MapLibre: Kamera polstern", () => {
  function fake() {
    const rufe: Array<Record<string, unknown>> = []
    return { rufe, easeTo: (o: Record<string, unknown>) => rufe.push(o) }
  }

  it("verschiebt die Mitte um den verdeckten Rand", () => {
    const karte = fake()
    mitFakeKarte(new MapLibreMapAdapter(), karte).setViewportPadding({ right: 436 })

    expect(karte.rufe).toHaveLength(1)
    expect(karte.rufe[0]).toMatchObject({ padding: { left: 0, right: 436, top: 0, bottom: 0 } })
  })

  it("bewegt sich dabei sichtbar, statt zu springen", () => {
    const karte = fake()
    mitFakeKarte(new MapLibreMapAdapter(), karte).setViewportPadding({ right: 436 })

    // Dieselbe Dauer, mit der das Panel aufgeht — sonst laufen Karte und
    // Panel gegeneinander.
    expect(karte.rufe[0]!.duration).toBe(300)
  })

  it("nimmt die Polsterung zurück, wenn das Panel schliesst", () => {
    const karte = fake()
    const adapter = mitFakeKarte(new MapLibreMapAdapter(), karte)
    adapter.setViewportPadding({ right: 436 })
    adapter.setViewportPadding({})

    expect(karte.rufe[1]).toMatchObject({ padding: { left: 0, right: 0, top: 0, bottom: 0 } })
  })

  it("bleibt still, wenn sich nichts geaendert hat", () => {
    const karte = fake()
    const adapter = mitFakeKarte(new MapLibreMapAdapter(), karte)
    adapter.setViewportPadding({ right: 436 })
    adapter.setViewportPadding({ right: 436 })

    // Eine Kamerabewegung pro Aenderung, nicht pro Render.
    expect(karte.rufe).toHaveLength(1)
  })

  it("verwirft unsinnige Werte, statt die Kamera zu verwerfen", () => {
    const karte = fake()
    mitFakeKarte(new MapLibreMapAdapter(), karte).setViewportPadding({ right: Number.NaN, left: -5 })

    expect(karte.rufe[0]).toMatchObject({ padding: { left: 0, right: 0, top: 0, bottom: 0 } })
  })
})

/**
 * Beide Wege zugleich wären der Rand doppelt: Die Kamera weiß dann schon, wo
 * ihre Mitte liegt, und eine zusätzliche Verschiebung pro Bewegung schöbe den
 * Punkt ein zweites Mal. Denselben Fehler hatten wir am FAB (#306).
 */
describe("Ein Weg, nicht zwei", () => {
  it("überlässt der Kamera die Seitenränder, wo sie sie kennt", () => {
    expect(mapViewFocusInsets(false, { left: 0, right: 436 }, true)).toEqual({
      bottomInset: 0,
      leftInset: 0,
      rightInset: 0,
    })
  })

  it("rechnet sie selbst, wo die Kamera sie nicht kennt", () => {
    expect(mapViewFocusInsets(false, { left: 0, right: 436 }, false)).toEqual({
      bottomInset: 0,
      leftInset: 0,
      rightInset: 436,
    })
  })

  /**
   * Das Blatt am unteren Rand bleibt beim Weg über die einzelne Bewegung: Es
   * ändert seine Höhe beim Ziehen laufend, und eine animierte Kamera-Polsterung
   * liefe dabei gegen die Geste.
   */
  it("behält das mobile Blatt in der Hand, auch mit Kamera-Polsterung", () => {
    const insets = mapViewFocusInsets(true, { left: 0, right: 436 }, true)
    expect(insets.leftInset).toBe(0)
    expect(insets.rightInset).toBe(0)
    expect(insets.bottomInset).toBeGreaterThan(0)
  })
})
