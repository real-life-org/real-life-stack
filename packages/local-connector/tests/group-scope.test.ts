import { beforeEach, describe, expect, it, vi } from "vitest"
import { hasGroupScope } from "@real-life-stack/data-interface"

// 02 → Lesen/Anlegen in einem bestimmten Space. Die Vertragsfälle stehen in
// der geteilten Suite (data-interface-contract.test.ts); hier das
// Local-Eigene: EIN gespeicherter Zustand, kein Zwischenstand im falschen Space.

const idb = vi.hoisted(() => {
  let state: unknown
  const clone = <T>(value: T): T => value === undefined ? value : structuredClone(value)
  const snapshots: unknown[] = []
  return {
    snapshots,
    reset: () => { state = undefined; snapshots.length = 0 },
    get: vi.fn(async () => clone(state)),
    set: vi.fn(async (_key: string, value: unknown) => { state = clone(value); snapshots.push(clone(value)) }),
    update: vi.fn(async (_key: string, updater: (value: unknown) => unknown) => { state = clone(updater(clone(state))); snapshots.push(clone(state)) }),
    del: vi.fn(async () => { state = undefined }),
  }
})
vi.mock("idb-keyval", () => ({ get: idb.get, set: idb.set, update: idb.update, del: idb.del, createStore: vi.fn().mockReturnValue({}) }))
vi.stubGlobal("BroadcastChannel", class { onmessage = null; postMessage() {} close() {} })

import { LocalConnector } from "../src/local-connector.js"

const seed = {
  items: [],
  groups: [{ id: "alpha", name: "Alpha" }, { id: "beta", name: "Beta" }],
  users: [{ id: "user-1", displayName: "User" }],
  groupMembers: { alpha: ["user-1"], beta: ["user-1"] },
  groupItems: { alpha: [], beta: [] },
}

beforeEach(() => idb.reset())

describe("LocalConnector — GroupScopeCapable", () => {
  it("sagt group zu", () => {
    expect(hasGroupScope(new LocalConnector(seed))).toBe(true)
  })

  it("legt in einem einzigen gespeicherten Zustand direkt im Ziel-Space an", async () => {
    const connector = new LocalConnector(seed)
    await connector.init()
    await connector.authenticate("local", {})
    connector.setCurrentGroup("alpha")
    const before = idb.snapshots.length
    const item = await connector.createItem({ type: "task", createdBy: "user-1", data: { title: "dort" } }, { group: "beta" })
    const written = idb.snapshots.slice(before) as { items: { id: string }[]; groupItems: Record<string, string[]> }[]
    // Jeder geschriebene Zustand, der das Item kennt, führt es in beta und nur dort.
    const withItem = written.filter((state) => state.items.some(({ id }) => id === item.id))
    expect(withItem.length).toBeGreaterThan(0)
    for (const state of withItem) {
      expect(state.groupItems.beta).toContain(item.id)
      expect(state.groupItems.alpha ?? []).not.toContain(item.id)
    }
    expect(connector.getCurrentGroup()?.id).toBe("alpha")
  })
})
