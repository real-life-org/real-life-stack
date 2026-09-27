// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { fitCount } from "../src/components/preview/use-fitting-tags"
import { ItemPreview } from "../src/components/preview/item-preview"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Anton, 27.09.2026: Auf Karten stehen so viele Tags, wie in die Zeile
 * passen, der Rest als „+N". Die Zeile bricht nie um, der Urheber behält
 * seinen Platz rechts. Vorher fest 1 (dicht) bzw. 3.
 */
describe("fitCount", () => {
  const gap = 6
  const plus = () => 30
  it("alle, wenn alle passen — ohne Platz für „+N“", () => {
    expect(fitCount(200, [50, 50, 50], gap, plus)).toBe(3) // 50+6+50+6+50 = 162
  })
  it("so viele, dass „+N“ noch daneben passt", () => {
    // 50, 50 = 106; +6+30 = 142 ≤ 150 → 2; ein dritter mit „+N“ bräuchte 198
    expect(fitCount(150, [50, 50, 50, 50], gap, plus)).toBe(2)
  })
  it("kein Tag, wenn nicht einmal einer mit „+N“ passt", () => {
    expect(fitCount(60, [50, 50], gap, plus)).toBe(0)
  })
  it("ohne Messung (Breite 0) keine Aussage", () => {
    expect(fitCount(0, [50], gap, plus)).toBeNull()
  })
})

let chipWidth = 60

describe("ItemPreview misst die Tag-Zeile", () => {
  let host: HTMLDivElement
  let root: Root
  const widths = new Map<string, number>([
    ["tag-row", 400],
    ["tag-author", 80],
  ])
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        const m = this.getAttribute("data-measure")
        if (m && widths.has(m)) return widths.get(m)
        if (m === "tag-chip") return chipWidth
        if (m === "tag-plus") return 30
        return 0
      },
    })
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
    if (original) Object.defineProperty(HTMLElement.prototype, "offsetWidth", original)
  })

  const item: Item = {
    id: "i", type: "post", createdAt: "2026-09-01T10:00:00.000Z", createdBy: "u",
    data: { content: "x" }, tags: ["a", "b", "c", "d", "e", "f", "g"],
  } as Item

  it("zeigt in der dichten Ansicht mehr als einen Tag, wenn Platz ist", async () => {
    await act(async () => {
      root.render(createElement(ItemPreview, { item, density: "compact", author: { id: "u", displayName: "U" } as never }))
    })
    // verfügbar: 400 − 80 − 12 = 308; Chips à 60 + 6: 4 Chips = 258, +6+30 = 294 ≤ 308; 5 = 324 + 36 > 308
    const sichtbar = host.querySelectorAll('[data-visible-tag]')
    expect(sichtbar).toHaveLength(4)
    expect(host.textContent).toContain("+3")
  })

  it("#513: passt kein Chip, steht allein „+N“ mit allen Tags im Titel — auch ohne Urheber", async () => {
    widths.set("tag-row", 152)
    const zwei = { ...item, tags: ["lang-eins", "lang-zwei"] }
    await act(async () => {
      root.render(createElement(ItemPreview, { item: zwei, density: "compact", author: { id: "u", displayName: "U" } as never }))
    })
    // verfügbar 152 − 80 − 12 = 60: ein Chip (60) plus Zähler passt nicht, +2 (30) schon
    expect(host.querySelectorAll("[data-visible-tag]")).toHaveLength(0)
    const plus = [...host.querySelectorAll("span")].find((el) => el.textContent === "+2" && !el.closest('[aria-hidden="true"]'))
    expect(plus?.getAttribute("title")).toBe("lang-eins, lang-zwei")

    widths.set("tag-row", 60)
    await act(async () => {
      root.render(createElement(ItemPreview, { item: zwei, density: "compact", author: null }))
    })
    expect([...host.querySelectorAll("span")].some((el) => el.textContent === "+2" && !el.closest('[aria-hidden="true"]'))).toBe(true)
    widths.set("tag-row", 400)
  })

  it("#514: gleiche Anzahl, andere Texte — die Zeile misst neu", async () => {
    const kurz = { ...item, tags: ["a", "b"] }
    await act(async () => {
      root.render(createElement(ItemPreview, { item: kurz, density: "compact", author: { id: "u", displayName: "U" } as never }))
    })
    expect(host.querySelectorAll("[data-visible-tag]")).toHaveLength(2)
    chipWidth = 250
    const lang = { ...item, tags: ["sehr-lang-eins", "sehr-lang-zwei"] }
    await act(async () => {
      root.render(createElement(ItemPreview, { item: lang, density: "compact", author: { id: "u", displayName: "U" } as never }))
    })
    // 308 verfügbar: 250 + 6 + 30 = 286 → ein Chip und +1
    expect(host.querySelectorAll("[data-visible-tag]")).toHaveLength(1)
    chipWidth = 60
  })
})
