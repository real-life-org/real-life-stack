import { relationRecordFromItem, type RelationRecord } from "@real-life-stack/data-interface"
import { projectSpaceGraph } from "@real-life-stack/toolkit"
import { describe, expect, it } from "vitest"

import { buildDwebCampSeedItems } from "./network-seed"

// S4b: Event → Ort liegt eingebettet am Event (`locatedAt`). Die Graph-Linse
// zeigt die Kante weiter, jetzt aus der eingebetteten Relation statt aus
// dem Record `takesPlaceAt`.
describe("Graph: Event–Ort-Kanten nach der Umstellung auf locatedAt", () => {
  it("je Event genau eine Kante locatedAt zu seinem Ort", async () => {
    const items = await buildDwebCampSeedItems()
    const records = items
      .filter(({ type }) => type === "relation")
      .map(relationRecordFromItem)
      .filter((r): r is RelationRecord => r !== null)
    const graph = projectSpaceGraph(items, records, [], (id) => id)
    const located = graph.edges.filter((e) => e.predicate === "locatedAt")
    const events = items.filter(({ type }) => type === "event")
    expect(located).toHaveLength(events.length)
    for (const edge of located) {
      expect(edge.sourceId).toMatch(/^item:event-/)
      expect(edge.targetId).toMatch(/^item:place-/)
    }
    expect(graph.edges.some((e) => e.predicate === "takesPlaceAt")).toBe(false)
  })
})
