import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { selectFeedItems } from "../src/modules/feed-module"

/**
 * Was der Feed mit den Items des Hosts tut: das Neueste zuerst. Welche Items
 * als eigene Karte stehen, entscheidet der Host fuer jedes aggregierende Modul
 * (modul-host.test.tsx) — Anton, 2026-08-17: ein Ort, den Timo anlegt, muss
 * im Feed erscheinen, nicht nur auf der Karte.
 */
function item(id: string, type: string, createdAt: string, data: Record<string, unknown> = {}): Item {
  return { id, type, createdAt, createdBy: "did:key:timo", data } as Item
}

describe("selectFeedItems", () => {
  it("sorts newest first", () => {
    const older = item("old", "post", "2026-08-01T10:00:00.000Z")
    const newer = item("new", "place", "2026-08-17T10:00:00.000Z")
    expect(selectFeedItems([older, newer]).map(({ id }) => id)).toEqual(["new", "old"])
  })

  it("does not mutate the caller's array", () => {
    const items = [item("a", "post", "2026-08-01T10:00:00.000Z"), item("b", "post", "2026-08-02T10:00:00.000Z")]
    selectFeedItems(items)
    expect(items.map(({ id }) => id)).toEqual(["a", "b"])
  })
})
