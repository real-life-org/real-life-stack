// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { KanbanBoard } from "../src/components/kanban/kanban-board"
import { ItemAssignees } from "../src/components/preview/item-assignees"
import { qualifierLabel } from "../src/components/preview/people-line"
import { registerTypePresentation, resetTypePresentationForTests, resolveTypePresentation } from "../src/components/preview/type-presentation"
import { EXAMPLE_LEARNING_LAYER } from "../src/story-support/example-learning-layer"

/**
 * S3b: `assignedTo.role` (can | learns, fehlend = can) steht auch auf der
 * Kanban-Karte klein hinter dem Namen, wie in der Menschen-Zeile
 * (shared-components, Detail-Anatomie Regel 5; Spec 06, Regeln 7 und 20).
 */

const users = [
  { id: "anna", displayName: "Anna" },
  { id: "timo", displayName: "Timo" },
]

const karte = (relations: Item["relations"]): Item =>
  ({ id: "k1", type: "task", createdAt: "2026-09-27T10:00:00.000Z", createdBy: "anna", data: { title: "Beet", status: "open" }, relations }) as Item

describe("Qualifier der Zuweisung auf der Karte", () => {
  beforeEach(() => registerTypePresentation("beispiel", { extensions: [EXAMPLE_LEARNING_LAYER] }))
  afterEach(() => resetTypePresentationForTests())

  it("ohne Schicht nur der Name: „Anna, Timo“", () => {
    resetTypePresentationForTests()
    const html = renderToStaticMarkup(
      <KanbanBoard items={[karte([{ predicate: "assignedTo", target: "global:anna" }, { predicate: "assignedTo", target: "global:timo", meta: { role: "learns" } }])]} users={users} readOnly />,
    )
    expect(html).toContain("Anna, Timo<")
  })

  it("qualifierLabel: fehlend ohne Text, learns „lernt“, unbekannt ohne Text", () => {
    const edge = resolveTypePresentation("task").edges?.find((e) => e.predicate === "assignedTo")
    expect(qualifierLabel(edge, undefined)).toBeUndefined()
    expect(qualifierLabel(edge, "learns")).toBe("lernt")
    expect(qualifierLabel(edge, "can")).toBe("kann")
    expect(qualifierLabel(edge, "foo")).toBeUndefined()
  })

  it("ItemAssignees nennt den Qualifier hinter dem Namen: „Timo lernt“", () => {
    const html = renderToStaticMarkup(<ItemAssignees users={[{ id: "timo", displayName: "Timo", qualifier: "lernt" }]} />)
    expect(html).toContain("Timo lernt")
  })

  it("die Kanban-Karte zeigt „Anna, Timo lernt“", () => {
    const html = renderToStaticMarkup(
      <KanbanBoard
        items={[karte([{ predicate: "assignedTo", target: "global:anna" }, { predicate: "assignedTo", target: "global:timo", meta: { role: "learns" } }])]}
        users={users}
        readOnly
      />,
    )
    expect(html).toContain("Anna, Timo lernt")
  })
})

describe("CodeRabbit: isItemDone mit Standard-Status", () => {
  it("ohne Status gilt der Standard-Status des Typs", async () => {
    const { isItemDone } = await import("../src/components/preview/item-ref-chip")
    const { composeTypeManifest, TOOLKIT_TYPE_LAYER } = await import("@real-life-stack/data-interface")
    const { registerTypePresentation, setTypeManifest, resetTypePresentationForTests } = await import("../src/components/preview/type-presentation")
    setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER, { name: "app", definitions: [{ id: "note", vocabularies: [], relations: [] }] }]))
    registerTypePresentation("app", [{ id: "note", label: "Notiz", composer: { defaultStatus: "fertig" }, fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "neu", label: "Neu", role: "open" }, { id: "fertig", label: "Fertig", role: "done" }] }] }])
    expect(isItemDone({ id: "n", type: "note", createdAt: "", createdBy: "", data: {} })).toBe(true)
    expect(isItemDone({ id: "n", type: "note", createdAt: "", createdBy: "", data: { status: "neu" } })).toBe(false)
    resetTypePresentationForTests()
  })
})
