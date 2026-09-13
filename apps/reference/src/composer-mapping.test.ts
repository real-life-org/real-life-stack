import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { itemToComposerData, mapComposerSubmission } from "./composer-mapping"

/**
 * Der App-Mapper reicht die Personenfelder an die geteilten Toolkit-Helfer
 * durch. Hier steht nur, dass die Verdrahtung hält — die Feldregeln selbst
 * liegen in `packages/toolkit/tests/people-relations.test.ts`.
 */
const aufgabe: Item = {
  id: "t1",
  type: "task",
  createdAt: "2026-09-13T10:00:00.000Z",
  createdBy: "u9",
  data: { title: "Beete umgraben" },
  relations: [
    { predicate: "commentOn", target: "item:x" },
    { predicate: "assignedTo", target: "global:alt" },
  ],
}

describe("mapComposerSubmission — Personen", () => {
  it("schreibt data.people auf das Prädikat des Typs und lässt andere Relationen stehen", () => {
    const payload = mapComposerSubmission(
      { contentType: "task", isPublic: true, data: { title: "Beete umgraben", people: ["u1"] } },
      { mode: "edit", existingItem: aufgabe },
    )
    expect(payload?.relations).toEqual([
      { predicate: "commentOn", target: "item:x" },
      { predicate: "assignedTo", target: "global:u1" },
    ])
  })

  it("legt keine Personen in item.data ab", () => {
    const payload = mapComposerSubmission(
      { contentType: "task", isPublic: true, data: { title: "Neu", people: ["u1"] } },
      { mode: "create", existingItem: null },
    )
    expect(payload?.data).not.toHaveProperty("people")
  })
})

describe("itemToComposerData — Personen", () => {
  it("liest die Zuweisungen des Typs zurück", () => {
    expect(itemToComposerData(aufgabe).people).toEqual(["alt"])
  })
})
