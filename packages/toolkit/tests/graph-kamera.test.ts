import { describe, expect, it } from "vitest"

import { createLayoutNodes, presettleForceLayout } from "../src/components/graph/force-layout"
import type { GraphEdge, GraphNode } from "../src/components/graph/types"

/**
 * Nach dem Aufbau wanderte der Graph zehn Sekunden, und die Kamera sprang
 * dreimal hart nach (Anton, 21.09.2026). Der Bestand wird jetzt VOR dem
 * ersten Bild vorgerechnet, mit Zeitbudget; danach faehrt die Kamera, statt
 * zu springen.
 */
const nodes: GraphNode[] = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, label: `N ${i}`, type: "project" }))
const edges: GraphEdge[] = Array.from({ length: 80 }, (_, i) => ({
  id: `e${i}`, sourceId: `n${i % 60}`, targetId: `n${(i * 7 + 3) % 60}`, predicate: "connectedWith",
}))

describe("presettleForceLayout", () => {
  it("rechnet vor, bis alpha unter der Schwelle liegt — der Bestand kommt fast fertig ins erste Bild", () => {
    const layout = createLayoutNodes(nodes, edges)
    const vorher = layout.map((n) => ({ x: n.x, y: n.y }))
    const alpha = presettleForceLayout(layout, edges, 1, { budgetMs: 10_000 })
    expect(alpha).toBeLessThanOrEqual(0.03)
    expect(layout.some((n, i) => n.x !== vorher[i].x || n.y !== vorher[i].y)).toBe(true)
  })

  it("haelt das Zeitbudget ein und laesst den Rest sichtbar laufen", () => {
    const layout = createLayoutNodes(nodes, edges)
    let uhr = 0
    const alpha = presettleForceLayout(layout, edges, 1, { budgetMs: 50, now: () => (uhr += 10) })
    // 50 ms Budget bei 10 ms je Schritt: eine Handvoll Schritte, nicht Hunderte.
    expect(alpha).toBeGreaterThan(0.9)
    expect(alpha).toBeLessThan(1)
  })
})
