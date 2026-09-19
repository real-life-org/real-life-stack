import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { moduleForItem, modulePresentsItem, PRESENT_PRIORITY } from "../src/lib/module-register"

const base: Item = { id: "i", type: "post", createdAt: "2026-09-01T10:00:00+02:00", createdBy: "mira", data: {} }
const mit = (data: Record<string, unknown>, rest: Partial<Item> = {}) => ({ ...base, ...rest, data })
const ALLE = ["feed", "kanban", "calendar", "map", "resonance", "collection", "graph"]

/**
 * Dieselbe Regel stand vorher viermal im Monorepo, mit verschiedenen
 * Modullisten. Hier steht sie einmal und wird geprüft.
 */
describe("moduleForItem", () => {
  it("wählt nach dem Feld: Ort, Zeit, Status", () => {
    expect(moduleForItem(mit({ position: { type: "Point", coordinates: [13, 52] } }), ALLE)).toBe("map")
    expect(moduleForItem(mit({ start: "2026-09-19T14:00:00+02:00" }), ALLE)).toBe("calendar")
    expect(moduleForItem(mit({ status: "open" }, { type: "task" }), ALLE)).toBe("kanban")
  })

  it("lässt den Ort vor der Zeit gewinnen (Entscheidung mit Anton)", () => {
    const beides = mit({ position: { type: "Point", coordinates: [13, 52] }, start: "2026-09-19T14:00:00+02:00" })
    expect(moduleForItem(beides, ALLE)).toBe("map")
  })

  it("überspringt ein Modul, das dieser Space nicht anbietet", () => {
    const ort = mit({ position: { type: "Point", coordinates: [13, 52] } })
    expect(moduleForItem(ort, ["feed", "calendar"])).toBeUndefined()
    const beides = mit({ position: { type: "Point", coordinates: [13, 52] }, start: "2026-09-19T14:00:00+02:00" })
    expect(moduleForItem(beides, ["feed", "calendar"])).toBe("calendar")
  })

  it("antwortet undefined, wenn kein Feld ein Modul auswählt", () => {
    // Der Rückfall gehört der Anwendung. Ein erstes-aus-der-Liste hätte hier
    // einen Beitrag auf der Karte geöffnet.
    expect(moduleForItem(mit({ title: "Nur Text" }), ["map", "calendar", "kanban"])).toBeUndefined()
  })

  it("führt die Aussage vor allem anderen", () => {
    expect(PRESENT_PRIORITY[0]).toBe("statement")
  })
})

describe("modulePresentsItem", () => {
  const ort = mit({ position: { type: "Point", coordinates: [13, 52] } })
  const text = mit({ title: "Nur Text" })

  it("verlangt das Feld, das ein Modul darstellt", () => {
    expect(modulePresentsItem("map", ort)).toBe(true)
    expect(modulePresentsItem("map", text)).toBe(false)
    expect(modulePresentsItem("calendar", text)).toBe(false)
  })

  it("lässt den Feed alles zeigen, was eine eigene Karte hat", () => {
    expect(modulePresentsItem("feed", text, "post")).toBe(true)
    expect(modulePresentsItem("feed", text, "comment")).toBe(false)
    expect(modulePresentsItem("feed", text)).toBe(true)
  })

  it("lässt Module ohne eigenes Feld alles zeigen", () => {
    expect(modulePresentsItem("collection", text)).toBe(true)
    expect(modulePresentsItem("graph", text)).toBe(true)
  })

  it("zeigt nichts, wenn gar keine Hinweise vorliegen und das Modul ein Feld braucht", () => {
    expect(modulePresentsItem("map", undefined)).toBe(false)
  })
})
