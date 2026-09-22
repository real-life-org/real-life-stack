import { beforeEach, describe, expect, it } from "vitest"
import {
  assertAuthoredTypeUnchanged,
  canonicalItem,
  composeTypeManifest,
  hasItemType,
  isAggregateVisibleItemType,
  isAuthoredSystemItem,
  isComment,
  isStatement,
  isTask,
  matchesFilter,
  setTypeManifest,
  TOOLKIT_TYPE_LAYER,
  type Item,
  type ItemType,
} from "../src/index.js"

/**
 * `Item.type` ist eine Menge — auch im TypeScript-Typ (Spec 06, „Die Rolle
 * von type"). Bis rls#433 stand dort `string`, und jede Stelle, die
 * `item.type === "task"` verglich, war fuer ein Item mit zwei Klassen still
 * falsch. Hier die Faelle, die das Register, die Typwaechter und die
 * Autorschaft ueber die Menge beantworten muessen.
 */
const item = (type: ItemType, teil: Partial<Item> = {}): Item =>
  ({ id: "x", type, createdAt: "t", createdBy: "u", data: {}, ...teil }) as Item

beforeEach(() => setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER])))

describe("Item.type als Menge", () => {
  it("laesst sich als Menge schreiben und lesen", () => {
    const i: Item = { id: "a", type: ["post", "statement"], createdAt: "t", createdBy: "u", data: {} }
    expect(hasItemType(i, "statement")).toBe(true)
    expect(hasItemType(i, "post")).toBe(true)
    expect(hasItemType(i, "task")).toBe(false)
  })

  it("Typwaechter antworten ueber die Menge, nicht ueber den ersten Eintrag", () => {
    const t = item(["post", "task"], { data: { title: "x", status: "open" } })
    expect(isTask(t)).toBe(true)
    expect(isStatement(item(["post", "statement"]))).toBe(true)
    expect(isComment(item(["comment"]))).toBe(true)
    expect(isComment(item(["post"]))).toBe(false)
  })

  it("ein Systemtyp in der Menge macht das Item zum Systemitem", () => {
    expect(isAuthoredSystemItem(["post", "comment"])).toBe(true)
    expect(isAuthoredSystemItem(["post"])).toBe(false)
    expect(isAggregateVisibleItemType(["post"])).toBe(true)
    expect(isAggregateVisibleItemType(["reaction"])).toBe(false)
    expect(isAggregateVisibleItemType(["post", "reaction"])).toBe(false)
  })

  it("der Filter trifft eine Klasse der Menge", () => {
    expect(matchesFilter(item(["post", "statement"]), { type: "statement" })).toBe(true)
    expect(matchesFilter(item(["post", "statement"]), { type: ["task"] })).toBe(false)
  })

  it("dieselbe Menge in anderer Reihenfolge ist keine Typaenderung", () => {
    expect(() => assertAuthoredTypeUnchanged(item(["comment", "post"]), { type: ["post", "comment"] })).not.toThrow()
    expect(() => assertAuthoredTypeUnchanged(item("comment"), { type: ["comment"] })).not.toThrow()
    expect(() => assertAuthoredTypeUnchanged(item("comment"), { type: "post" })).toThrow(/authorship/)
  })

  it("die Eingangsgrenze behaelt die Menge (rls#417) — jetzt ohne Typ-Umweg", () => {
    const kanonisch = canonicalItem(item(["post", "https://real-life-stack.org/vocab/statement/v1#Statement"]))
    expect(kanonisch.type).toEqual(["post", "statement"])
  })
})
