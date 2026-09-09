// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { join } from "node:path"
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

/**
 * Eine Kamerabewegung überschreibt die Polsterung, wenn sie keine mitbringt:
 * MapLibre nimmt bei `easeTo`/`flyTo` das Padding aus den Optionen und lässt
 * sonst die Voreinstellung gelten. Passiert das mitten in der laufenden
 * Polsterungs-Animation, bleibt die Kamera falsch zentriert — und ein zweiter
 * Aufruf mit demselben Wert räumt es nicht auf, weil er als „nichts geändert"
 * durchfällt.
 *
 * Also führt JEDE Bewegung des Adapters die Polsterung mit. Dann kann sie
 * nicht verlorengehen, egal was dazwischenkommt.
 */
describe("Die Polsterung überlebt jede Bewegung", () => {
  function fake() {
    const rufe: Array<{ art: string; optionen: Record<string, unknown> }> = []
    return {
      rufe,
      easeTo: (o: Record<string, unknown>) => rufe.push({ art: "easeTo", optionen: o }),
      flyTo: (o: Record<string, unknown>) => rufe.push({ art: "flyTo", optionen: o }),
      jumpTo: (o: Record<string, unknown>) => rufe.push({ art: "jumpTo", optionen: o }),
      fitBounds: (_b: unknown, o: Record<string, unknown>) => rufe.push({ art: "fitBounds", optionen: o }),
      getBounds: () => ({ getWest: () => 0, getSouth: () => 0, getEast: () => 1, getNorth: () => 1 }),
      getCenter: () => ({ lng: 0, lat: 0 }),
      getZoom: () => 5,
    }
  }

  function mitPolsterung() {
    const karte = fake()
    const adapter = mitFakeKarte(new MapLibreMapAdapter(), karte)
    adapter.setViewportPadding({ right: 436 })
    karte.rufe.length = 0
    return { karte, adapter }
  }

  const erwartet = { left: 0, right: 436, top: 0, bottom: 0 }

  it("beim Zentrieren auf einen Punkt", () => {
    const { karte, adapter } = mitPolsterung()
    adapter.focusOn([8, 50])
    expect(karte.rufe[0]!.optionen.padding).toEqual(erwartet)
  })

  it("beim Zentrieren mit Zoom", () => {
    const { karte, adapter } = mitPolsterung()
    adapter.focusOn([8, 50], { zoom: 12 })
    expect(karte.rufe[0]!.optionen.padding).toEqual(erwartet)
  })

  it("beim Setzen eines Ausschnitts", () => {
    const { karte, adapter } = mitPolsterung()
    adapter.setView({ center: [8, 50], zoom: 9 })
    expect(karte.rufe[0]!.optionen.padding).toEqual(erwartet)
  })

  it("beim Einpassen von Grenzen", () => {
    const { karte, adapter } = mitPolsterung()
    adapter.fitBounds({ west: 0, south: 0, east: 1, north: 1 })
    expect(karte.rufe[0]!.optionen.padding).toMatchObject(erwartet)
  })

  it("bringt keine Polsterung ins Spiel, wo keine gesetzt ist", () => {
    const karte = fake()
    mitFakeKarte(new MapLibreMapAdapter(), karte).focusOn([8, 50])
    expect(karte.rufe[0]!.optionen.padding).toBeUndefined()
  })
})

/**
 * Ein Themenwechsel tauscht den ganzen Karten-Style aus. Projektion und Marker
 * werden danach wiederhergestellt — die Polsterung gehört dazu. Über den
 * gemerkten Wert und nicht über `setViewportPadding`: Der vergleicht mit dem
 * Gemerkten und fände „nichts geändert", also bliebe die Kamera falsch.
 */
describe("Die Polsterung überlebt den Themenwechsel", () => {
  it("wird nach dem Style-Wechsel ohne Animation wiederhergestellt", () => {
    const quelle = readFileSync(
      join(__dirname, "../src/components/map/adapters/maplibre.ts"),
      "utf8",
    )
    const nachDemStyle = quelle.slice(quelle.indexOf("Projection is a style property"))
    const bisMarker = nachDemStyle.slice(0, nachDemStyle.indexOf("reapplyMarkersSafely"))
    expect(bisMarker).toContain("setPadding(this.viewportPadding)")
  })
})

/**
 * Eine Animation lässt sich immer unterbrechen — auch von Gesten, die wir nie
 * zu sehen bekommen: Zieht oder zoomt jemand während der 300ms, stoppt
 * MapLibre die laufende Bewegung, und die Polsterung bleibt auf halbem Weg
 * stehen. Kein Mitführen in den Optionen hilft dagegen, denn die Geste ist
 * keine Bewegung, die wir auslösen.
 *
 * Also prüft die Karte nach jeder abgeschlossenen Bewegung, ob die Polsterung
 * noch stimmt, und setzt sie sonst nach — ohne Animation, denn dann ist
 * nichts mehr in Bewegung.
 */
describe("Die Polsterung übersteht eine Unterbrechung", () => {
  it("wird geprüft, sobald eine Bewegung zur Ruhe kommt", () => {
    const quelle = readFileSync(
      join(__dirname, "../src/components/map/adapters/maplibre.ts"),
      "utf8",
    )
    // Im vorhandenen `moveend`-Listener, nicht in einem zweiten daneben.
    const beiMoveend = quelle.slice(quelle.indexOf('map.on("moveend"'))
    expect(beiMoveend.slice(0, beiMoveend.indexOf("viewListeners"))).toContain(
      "polsterungWiederherstellen()",
    )
  })

  it("holt sie zurück, wenn eine Geste sie auf halbem Weg stehen lässt", () => {
    let padding = { left: 0, right: 0, top: 0, bottom: 0 }
    const karte = {
      easeTo: () => {},
      getPadding: () => padding,
      setPadding: (p: typeof padding) => { padding = p },
    }
    const adapter = mitFakeKarte(new MapLibreMapAdapter(), karte)
    adapter.setViewportPadding({ right: 436 })

    // Mitten in der Animation zieht jemand die Karte: MapLibre stoppt, die
    // Polsterung steht bei 200 statt 436.
    padding = { left: 0, right: 200, top: 0, bottom: 0 }
    ;(adapter as unknown as { polsterungWiederherstellen(): void }).polsterungWiederherstellen()

    expect(padding).toEqual({ left: 0, right: 436, top: 0, bottom: 0 })
  })

  it("lässt eine stimmige Kamera in Ruhe", () => {
    let gesetzt = 0
    const soll = { left: 0, right: 436, top: 0, bottom: 0 }
    const karte = {
      easeTo: () => {},
      getPadding: () => soll,
      setPadding: () => { gesetzt++ },
    }
    const adapter = mitFakeKarte(new MapLibreMapAdapter(), karte)
    adapter.setViewportPadding({ right: 436 })
    ;(adapter as unknown as { polsterungWiederherstellen(): void }).polsterungWiederherstellen()

    expect(gesetzt).toBe(0)
  })

  it("mischt sich nicht ein, wo keine Polsterung gilt", () => {
    let gesetzt = 0
    const karte = {
      easeTo: () => {},
      getPadding: () => ({ left: 0, right: 12, top: 0, bottom: 0 }),
      setPadding: () => { gesetzt++ },
    }
    const adapter = mitFakeKarte(new MapLibreMapAdapter(), karte)
    ;(adapter as unknown as { polsterungWiederherstellen(): void }).polsterungWiederherstellen()

    expect(gesetzt).toBe(0)
  })
})

/** Auch der Sprung beim Cluster-Klick darf die Polsterung nicht abwerfen. */
describe("Cluster-Klick", () => {
  it("führt die Polsterung mit", () => {
    const quelle = readFileSync(
      join(__dirname, "../src/components/map/adapters/maplibre.ts"),
      "utf8",
    )
    const beiExpansion = quelle.slice(quelle.indexOf("getClusterExpansionZoom"))
    const bisEaseTo = beiExpansion.slice(0, beiExpansion.indexOf("catch"))
    expect(bisEaseTo).toContain("mitPolsterung")
  })
})

/**
 * Zweimal wurde eine Bewegung übersehen — erst `setView`/`fitBounds`, dann der
 * Cluster-Klick. Jede einzeln zu finden ist eine Kaskade ohne Ende; also
 * prüft dieser Test, dass gar keine übrig bleibt.
 *
 * Der Fehler dahinter ist unsichtbar: Eine Bewegung ohne Polsterung wirft sie
 * ab, und man sieht es erst, wenn der Globus hinter dem Panel steht.
 */
describe("Keine Kamerabewegung ohne Polsterung", () => {
  const quelle = readFileSync(
    join(__dirname, "../src/components/map/adapters/maplibre.ts"),
    "utf8",
  )

  it("führt sie bei jedem easeTo, flyTo und jumpTo mit", () => {
    const ohne = [...quelle.matchAll(/map\.(easeTo|flyTo|jumpTo)\((.{0,40})/g)]
      .filter(([, , anfang]) => !anfang.includes("mitPolsterung") && !anfang.includes("padding"))
      .map(([treffer]) => treffer.trim())

    expect(ohne, `Diese Bewegungen werfen die Polsterung ab:\n${ohne.join("\n")}`).toEqual([])
  })

  it("hört für Gesten nur auf Ereignisse, die es ohne Nutzer nicht gibt", () => {
    // Sonst gälte die eigene Kamerafahrt als Geste: Das Folgen schaltete sich
    // mitten im Flug ab, und niemand vollendete ihn (Anton: „bricht abrupt
    // ab"). Leaflet: `dragstart` und `wheel` kommen nur von Hand — `zoomstart`
    // feuert auch bei `setView`/`fitBounds` und darf darum nicht dabei sein.
    const leaflet = readFileSync(
      join(__dirname, "../src/components/map/adapters/leaflet.ts"),
      "utf8",
    )
    expect(leaflet).toContain('map.on("dragstart", geste)')
    // Das Rad kommt am Container an, nicht an der Karte: Leaflets
    // ScrollWheelZoom haengt dort, `map.on("wheel", …)` bekam nie eines.
    expect(leaflet).toContain('container.addEventListener("wheel", geste')
    expect(leaflet).not.toContain('map.on("zoomstart", geste)')
  })

  it("kennt beim Einpassen von Grenzen beide Fälle bewusst", () => {
    // Mit Polsterung (der Kamera oder aus den Optionen des Aufrufers):
    // mitgeben. Ohne irgendeine Angabe: unverändert lassen, ein leeres
    // Optionsobjekt wäre Rauschen.
    expect(quelle).toContain("hatPolsterung ? { padding: polsterung }")
    expect(quelle).toContain("else map.fitBounds(box)")
  })
})
