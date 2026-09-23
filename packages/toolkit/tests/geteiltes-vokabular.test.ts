import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { groupVocabulary } from "../src/hooks/use-group-vocabulary"

/**
 * Welche Tags und Typen es gibt, leitete bis zum 20.09.2026 jedes Modul selbst
 * ab: `availableTags` stand siebenmal im Code, `availableTypes` viermal. Die
 * Kopien liefen auseinander — Kanban sortierte nicht, der Kalender gab weder
 * Symbol noch Farbe mit, und die Karte nannte den Typ „event" kurzerhand
 * „Events", waehrend ueberall sonst das Typ-Register die Beschriftung bestimmte.
 *
 * Jetzt gibt es EINE Ableitung. Diese Tests halten fest, was sie leistet.
 */
const item = (teil: Partial<Item> & Pick<Item, "id" | "type">): Item => ({
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "mira",
  data: {},
  ...teil,
})

describe("Das geteilte Vokabular eines Space", () => {
  it("sortiert die Tags — jedes Modul sieht dieselbe Reihenfolge", () => {
    const { tags } = groupVocabulary([
      item({ id: "1", type: "post", tags: ["zaun", "apfel"] }),
      item({ id: "2", type: "task", tags: ["mulch", "apfel"] }),
    ])
    expect(tags).toEqual(["apfel", "mulch", "zaun"])
  })

  it("nennt jeden Tag einmal, egal an wie vielen Items er haengt", () => {
    const { tags } = groupVocabulary([
      item({ id: "1", type: "post", tags: ["garten"] }),
      item({ id: "2", type: "post", tags: ["garten"] }),
    ])
    expect(tags).toEqual(["garten"])
  })

  it("laesst Systemtypen weg — nach „Reaktion\" filtert niemand", () => {
    const { types } = groupVocabulary([
      item({ id: "1", type: "post" }),
      item({ id: "2", type: "reaction" }),
      item({ id: "3", type: "comment" }),
      item({ id: "4", type: "relation" }),
    ])
    expect(types.map((t) => t.id)).toEqual(["post"])
  })

  it("nimmt auch deren Tags nicht auf", () => {
    const { tags } = groupVocabulary([
      item({ id: "1", type: "comment", tags: ["nur-am-kommentar"] }),
    ])
    expect(tags).toEqual([])
  })

  it("holt die Beschriftung aus dem Typ-Register, nicht aus einer eigenen Liste", () => {
    const { types } = groupVocabulary([item({ id: "1", type: "event" })])
    // Die Karte nannte diesen Typ frueher „Events" — eine eigene Liste neben
    // dem Register. Jetzt gilt, was das Register sagt.
    expect(types[0].label).not.toBe("Events")
    expect(types[0].label.length).toBeGreaterThan(0)
  })

  it("gibt Symbol und Farbe mit, damit der Chip aussieht wie das Abzeichen", () => {
    const { types } = groupVocabulary([item({ id: "1", type: "event" })])
    expect(types[0].badgeClassName).toBeTruthy()
  })

  it("bleibt leer, wenn es nichts gibt", () => {
    expect(groupVocabulary([])).toEqual({ tags: [], types: [] })
  })
})
