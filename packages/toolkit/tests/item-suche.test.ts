import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { applyItemSearch } from "../src/hooks/use-filterable-items"

const item = (id: string, data: Record<string, unknown>): Item =>
  ({ id, type: "post", data, createdAt: "", updatedAt: "", createdBy: "u" }) as unknown as Item

/**
 * Dieselbe Textsuche in jedem Modul: Sie lag vorher fuenfmal fast gleich im
 * Code (Feed, Kanban, Kalender, Karte) — mal ueber Titel und Beschreibung,
 * mal auch ueber den Inhalt. Wer im Feed etwas fand, fand es im Kanban nicht.
 */
describe("Die Textsuche ueber Items", () => {
  const items = [
    item("a", { title: "Beet anlegen" }),
    item("b", { description: "Wir treffen uns im GARTEN" }),
    item("c", { content: "Nichts davon" }),
  ]

  it("gibt ohne Suchtext alles zurueck", () => {
    expect(applyItemSearch(items, "   ")).toHaveLength(3)
  })

  it("sucht ueber Titel, Beschreibung und Inhalt", () => {
    expect(applyItemSearch(items, "beet").map((i) => i.id)).toEqual(["a"])
    expect(applyItemSearch(items, "garten").map((i) => i.id)).toEqual(["b"])
    expect(applyItemSearch(items, "davon").map((i) => i.id)).toEqual(["c"])
  })

  it("achtet nicht auf Gross- und Kleinschreibung", () => {
    expect(applyItemSearch(items, "GaRtEn").map((i) => i.id)).toEqual(["b"])
  })
})
