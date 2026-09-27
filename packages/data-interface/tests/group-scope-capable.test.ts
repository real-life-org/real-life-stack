import { describe, expect, it } from "vitest"
import type { DataInterface } from "../src/index.js"
import { hasGroupScope, hasItemGroups } from "../src/index.js"

// Spec 02 → Lesen/Anlegen in einem bestimmten Space; 03 → GroupScopeCapable.
describe("GroupScopeCapable", () => {
  function stub(extra: Record<string, unknown> = {}): DataInterface {
    return {
      init: async () => {},
      dispose: async () => {},
      getItems: async () => [],
      getItem: async () => null,
      observe: () => ({ current: [], subscribe: () => () => {} }),
      observeItem: () => ({ current: null, subscribe: () => () => {} }),
      ...extra,
    }
  }

  it("meldet nichts ohne ausdrückliche Zusage", () => {
    expect(hasGroupScope(stub())).toBe(false)
    // createItem allein ist keine Zusage: jeder Schreiber hat es.
    expect(hasGroupScope(stub({ createItem: async () => ({}) }))).toBe(false)
  })

  it("meldet nichts, wenn die Zusage nicht genau true ist", () => {
    expect(hasGroupScope(stub({ groupScope: "yes", createItem: async () => ({}) }))).toBe(false)
    expect(hasGroupScope(stub({ groupScope: false, createItem: async () => ({}) }))).toBe(false)
  })

  it("verlangt die Zusage UND createItem", () => {
    expect(hasGroupScope(stub({ groupScope: true }))).toBe(false)
    expect(hasGroupScope(stub({ groupScope: true, createItem: async () => ({}) }))).toBe(true)
  })

  it("ist unabhängig von hasItemGroups (Regel 7)", () => {
    const nurGruppen = stub({ getItemGroupId: () => null, moveItemToGroup: () => {} })
    expect(hasItemGroups(nurGruppen)).toBe(true)
    expect(hasGroupScope(nurGruppen)).toBe(false)
    const nurScope = stub({ groupScope: true, createItem: async () => ({}) })
    expect(hasGroupScope(nurScope)).toBe(true)
    expect(hasItemGroups(nurScope)).toBe(false)
  })
})
