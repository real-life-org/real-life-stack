// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { projectSpaceGraph } from "../src/components/graph/project-space-graph"
import { ItemTypeBadge } from "../src/components/preview/item-type-badge"
import { resolveTypePresentation } from "../src/components/preview/type-presentation"
import { applyFilterBarValue } from "../src/hooks/use-filterable-items"
import { spaceVocabulary } from "../src/hooks/use-space-vocabulary"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** `Item.type` ist eine Menge — die Flaechen des Toolkits rechnen mit ihr (Spec 06). */
const item = (id: string, type: Item["type"], data: Record<string, unknown> = {}): Item =>
  ({ id, type, createdAt: "2026-09-22T10:00:00.000Z", createdBy: "u1", data }) as Item

describe("Item.type als Menge im Toolkit", () => {
  it("der Typfilter des Kopfes trifft eine Klasse der Menge", () => {
    const items = [item("a", ["post", "statement"]), item("b", "post"), item("c", ["task"])]
    expect(applyFilterBarValue(items, { tags: [], types: ["statement"] }).map((i) => i.id)).toEqual(["a"])
    expect(applyFilterBarValue(items, { tags: [], types: ["post"] }).map((i) => i.id)).toEqual(["a", "b"])
  })

  it("das Vokabular des Space kennt jede Klasse, die ein Item traegt", () => {
    const { types } = spaceVocabulary([item("a", ["post", "statement"]), item("b", ["comment"])])
    expect(types.map((t) => t.id)).toEqual(["post", "statement"])
  })

  it("Darstellung und Abzeichen nehmen die erste Klasse mit Vorlage", () => {
    expect(resolveTypePresentation(["fremd:x", "event"]).label).toBe("Event")
    const host = document.createElement("div")
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => { root.render(createElement(ItemTypeBadge, { type: ["fremd:x", "event"] })) })
    expect(host.textContent).toContain("Event")
    act(() => root.unmount())
    host.remove()
  })

  it("ein Graph-Knoten traegt die erste Klasse als Typ und faerbt danach", () => {
    const { nodes, nodeTypes } = projectSpaceGraph([item("a", ["project", "post"], { title: "P" })], [], [], (t) => t)
    expect(nodes[0]?.type).toBe("project")
    expect(nodeTypes.map((t) => t.id)).toEqual(["project"])
  })
})
