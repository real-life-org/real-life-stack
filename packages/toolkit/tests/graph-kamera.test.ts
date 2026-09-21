import { describe, expect, it } from "vitest"

import { approachCamera, fitCamera } from "../src/components/graph/force-layout"

/**
 * Nach dem Aufbau sprang die Kamera dreimal hart nach, mitten in einer
 * Bewegung, die an sich gut war (Anton, 21.09.2026). Jetzt folgt sie dem
 * Netz Bild fuer Bild um einen festen Anteil des Abstands — die Simulation
 * bleibt sichtbar, der Sprung nicht.
 */
describe("approachCamera", () => {
  const von = { x: 0, y: 0, zoom: 1 }
  const nach = { x: 100, y: -50, zoom: 0.5 }

  it("geht je Bild einen festen Anteil des Abstands", () => {
    expect(approachCamera(von, nach, 0.1)).toEqual({ x: 10, y: -5, zoom: 0.95 })
  })

  it("ist bei Faktor 1 der Sprung und bei 0 der Stillstand", () => {
    expect(approachCamera(von, nach, 1)).toEqual(nach)
    expect(approachCamera(von, nach, 0)).toEqual(von)
  })

  it("konvergiert ohne Ueberschwingen auf das Ziel", () => {
    let kamera = von
    for (let i = 0; i < 120; i += 1) kamera = approachCamera(kamera, nach, 0.08)
    expect(kamera.x).toBeCloseTo(nach.x, 1)
    expect(kamera.zoom).toBeCloseTo(nach.zoom, 2)
    expect(kamera.x).toBeLessThanOrEqual(nach.x)
  })

  it("das Ziel ist die ganze Ausdehnung — wie beim Fit", () => {
    const ziel = fitCamera([{ x: -100, y: 0 }, { x: 100, y: 0 }], 800, 600)
    expect(ziel.x).toBe(0)
    expect(ziel.zoom).toBeGreaterThan(0)
  })
})
