import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { editedLabel, itemText, itemTitle } from "../src/lib/item-text"

const base: Item = { id: "i1", type: "post", createdAt: "2026-09-01T10:00:00+02:00", createdBy: "mira", data: {} }

/**
 * Die Reihenfolge stand an vier Stellen im Monorepo, mit zwei Abfolgen und
 * zwei Rückfallwerten. Hier steht sie einmal und wird geprüft.
 */
describe("itemTitle", () => {
  it("nimmt title, dann displayName, dann name", () => {
    expect(itemTitle({ ...base, data: { title: "A", displayName: "B", name: "C" } })).toBe("A")
    expect(itemTitle({ ...base, data: { displayName: "B", name: "C" } })).toBe("B")
    expect(itemTitle({ ...base, data: { name: "C" } })).toBe("C")
  })

  it("überspringt leere und nicht-textliche Werte", () => {
    expect(itemTitle({ ...base, data: { title: "   ", displayName: "B" } })).toBe("B")
    expect(itemTitle({ ...base, data: { title: 42, name: "C" } })).toBe("C")
  })

  it("fällt auf den angegebenen Text zurück", () => {
    expect(itemTitle(base)).toBe("Ohne Titel")
    expect(itemTitle(base, base.id)).toBe("i1")
  })
})

describe("itemText", () => {
  it("nimmt content vor description", () => {
    expect(itemText({ ...base, data: { content: "A", description: "B" } })).toBe("A")
    expect(itemText({ ...base, data: { description: "B" } })).toBe("B")
    expect(itemText(base)).toBeUndefined()
  })
})

describe("editedLabel", () => {
  const resolve = (id: string) => (id === "mira" ? "Mira" : id)

  it("bleibt aus, solange nichts geändert wurde", () => {
    expect(editedLabel(base, resolve)).toBeUndefined()
  })

  it("nennt den, der geändert hat, sonst den Urheber", () => {
    const ts = "2026-09-05T12:00:00+02:00"
    expect(editedLabel({ ...base, updatedAt: ts, updatedBy: "mira" }, resolve)).toContain("Bearbeitet von Mira am ")
    expect(editedLabel({ ...base, updatedAt: ts }, resolve)).toContain("Bearbeitet von Mira am ")
  })
})
