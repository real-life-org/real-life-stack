import { describe, expect, it } from "vitest"

import { MapLibreMapAdapter } from "../src/components/map/adapters/maplibre"
import { LeafletMapAdapter } from "../src/components/map/adapters/leaflet"

/**
 * Ein schwebendes Panel verdeckt den rechten Teil der Karte. Klickt jemand
 * dort einen Marker an, muss die Karte ihn in den sichtbaren Rest schieben —
 * sonst oeffnet sich die Detailkarte genau ueber dem Punkt, den sie zeigt.
 *
 * Die Rechnung selbst liegt in `focusOffsetFor`; hier steht, dass beide
 * Adapter sie auch anwenden — mit ihren jeweiligen Vorzeichen.
 */
function mitFakeKarte<T>(adapter: T, karte: unknown): T {
  Object.assign(adapter as object, { mapInstance: karte })
  return adapter
}

describe("MapLibre: Fokus weicht dem Panel aus", () => {
  function fake() {
    const rufe: Array<{ art: string; offset?: unknown }> = []
    return {
      rufe,
      easeTo: (o: { offset?: unknown }) => rufe.push({ art: "easeTo", offset: o.offset }),
      flyTo: (o: { offset?: unknown }) => rufe.push({ art: "flyTo", offset: o.offset }),
    }
  }

  it("schiebt das Ziel um die halbe Panelbreite nach links", () => {
    const karte = fake()
    mitFakeKarte(new MapLibreMapAdapter(), karte).focusOn([8, 50], { rightInset: 392 })
    expect(karte.rufe).toEqual([{ art: "easeTo", offset: [-196, 0] }])
  })

  it("beruecksichtigt Panel und Blatt gemeinsam, auch beim Zoomen", () => {
    const karte = fake()
    mitFakeKarte(new MapLibreMapAdapter(), karte).focusOn([8, 50], {
      rightInset: 392, bottomInset: 300, zoom: 12,
    })
    expect(karte.rufe).toEqual([{ art: "flyTo", offset: [-196, -150] }])
  })

  it("laesst die Kamera ohne verdeckte Raender mittig", () => {
    const karte = fake()
    mitFakeKarte(new MapLibreMapAdapter(), karte).focusOn([8, 50])
    expect(karte.rufe).toEqual([{ art: "easeTo", offset: [0, 0] }])
  })
})

describe("Leaflet: Fokus weicht dem Panel aus", () => {
  function fake() {
    const rufe: Array<{ art: string; wert?: unknown }> = []
    return {
      rufe,
      panTo: () => rufe.push({ art: "panTo" }),
      flyTo: () => rufe.push({ art: "flyTo" }),
      panBy: (v: unknown) => rufe.push({ art: "panBy", wert: v }),
    }
  }

  it("verschiebt den Ausschnitt in die Gegenrichtung, damit das Ziel links landet", () => {
    const karte = fake()
    mitFakeKarte(new LeafletMapAdapter(), karte).focusOn([8, 50], { rightInset: 392 })
    expect(karte.rufe).toEqual([{ art: "panTo" }, { art: "panBy", wert: [196, 0] }])
  })

  it("hebt das Ziel weiterhin ueber ein Blatt am unteren Rand", () => {
    const karte = fake()
    mitFakeKarte(new LeafletMapAdapter(), karte).focusOn([8, 50], { bottomInset: 300 })
    expect(karte.rufe).toEqual([{ art: "panTo" }, { art: "panBy", wert: [0, 150] }])
  })

  it("schwenkt ohne verdeckte Raender gar nicht nach", () => {
    const karte = fake()
    mitFakeKarte(new LeafletMapAdapter(), karte).focusOn([8, 50])
    expect(karte.rufe).toEqual([{ art: "panTo" }])
  })
})
