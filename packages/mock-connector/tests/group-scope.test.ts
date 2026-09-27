import { describe, expect, it } from "vitest"
import { hasGroupScope } from "@real-life-stack/data-interface"
import { MockConnector } from "../src/index"

// 02 → Lesen/Anlegen in einem bestimmten Space. Die Fälle selbst stehen in
// der geteilten Contract-Suite; hier nur die Zusage und das Mock-Eigene.
describe("MockConnector — GroupScopeCapable", () => {
  function connector() {
    return new MockConnector({
      items: [],
      groups: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
      users: [{ id: "u", displayName: "U" }],
      groupMembers: { a: ["u"], b: ["u"] },
      groupItems: {},
    })
  }

  it("sagt group zu", () => {
    expect(hasGroupScope(connector())).toBe(true)
  })

  it("rechnet globale feature-Items auch mit group jedem Space zu (Regel 3)", async () => {
    const c = connector()
    c.setCurrentGroup("a")
    const feature = await c.createItem({ type: "feature", createdBy: "u", data: { title: "global" } })
    expect((await c.getItems({ group: "b" })).map(({ id }) => id)).toContain(feature.id)
    // … aber nicht einem unbekannten Space (Regel 2).
    expect(await c.getItems({ group: "nirgends" })).toEqual([])
  })
})
