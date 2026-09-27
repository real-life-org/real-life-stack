import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

// PR #518, Befund Anton: In der Übersicht angelegte Items liegen in keinem
// Space (persönlich). Einen Space zu setzen scheiterte mit „Item not found",
// weil moveItemToGroup eine Quell-Gruppe verlangte. Der Mock kann es.

const idb = vi.hoisted(() => {
  let state: unknown
  const clone = <T>(value: T): T => value === undefined ? value : structuredClone(value)
  return {
    reset: () => { state = undefined },
    get: vi.fn(async () => clone(state)),
    set: vi.fn(async (_key: string, value: unknown) => { state = clone(value) }),
    update: vi.fn(async (_key: string, updater: (value: unknown) => unknown) => { state = clone(updater(clone(state))) }),
    del: vi.fn(async () => { state = undefined }),
  }
})
vi.mock("idb-keyval", () => ({ get: idb.get, set: idb.set, update: idb.update, del: idb.del, createStore: vi.fn().mockReturnValue({}) }))
vi.stubGlobal("BroadcastChannel", class { onmessage = null; postMessage() {} close() {} })

import { LocalConnector } from "../src/local-connector.js"

const seed = {
  items: [{ id: "seeded", type: "task", createdBy: "user-1", createdAt: "2026-01-01T00:00:00.000Z", data: { title: "ohne Space" } }] as Item[],
  groups: [{ id: "alpha", name: "Alpha" }, { id: "beta", name: "Beta" }],
  users: [{ id: "user-1", displayName: "User" }],
  groupMembers: { alpha: ["user-1"], beta: ["user-1"] },
  groupItems: { alpha: [], beta: [] },
}

beforeEach(() => idb.reset())

describe("LocalConnector.moveItemToGroup für Items ohne Space", () => {
  it("setzt den Space eines in der Übersicht angelegten Items", async () => {
    const connector = new LocalConnector(seed)
    await connector.init()
    connector.setCurrentGroup(null)
    const item = await connector.createItem({ type: "task", createdBy: "user-1", data: { title: "neu" } })
    expect(connector.getItemGroupId(item.id)).toBeNull()
    await connector.moveItemToGroup(item.id, "alpha")
    expect(connector.getItemGroupId(item.id)).toBe("alpha")
    connector.setCurrentGroup("alpha")
    expect((await connector.getItems()).map((i) => i.id)).toContain(item.id)
  })

  it("setzt den Space eines Seed-Items ohne Zuordnung", async () => {
    const connector = new LocalConnector(seed)
    await connector.init()
    connector.setCurrentGroup(null) // Übersicht: dort ist das persönliche Item sichtbar
    await connector.moveItemToGroup("seeded", "beta")
    expect(connector.getItemGroupId("seeded")).toBe("beta")
  })

  it("ein unbekanntes Item bleibt ein Fehler", async () => {
    const connector = new LocalConnector(seed)
    await connector.init()
    await expect(connector.moveItemToGroup("gibt-es-nicht", "alpha")).rejects.toThrow(/not found/i)
  })
})
