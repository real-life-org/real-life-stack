import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

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

vi.mock("idb-keyval", () => ({
  get: idb.get, set: idb.set, update: idb.update, del: idb.del, createStore: vi.fn().mockReturnValue({}),
}))
vi.stubGlobal("BroadcastChannel", class {
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage() {}
  close() {}
})

import { LocalConnector } from "../src/local-connector.js"

// Regular (non-fixture) mode: the authoritative ingress under test.
const foreignVote: Item = {
  id: "vote-other",
  type: "relation",
  createdBy: "user-2",
  createdAt: "2026-09-26T10:00:00.000Z",
  data: { predicate: "votesOn", value: "green", contentHash: "sha256:0" },
  relations: [
    { predicate: "from", target: "global:user-2" },
    { predicate: "to", target: "item:statement-1" },
  ],
}
const seed = () => ({
  items: [foreignVote] as Item[],
  groups: [{ id: "alpha", name: "Alpha" }],
  users: [{ id: "user-1", displayName: "User" }],
  groupMembers: { alpha: ["user-1"] },
  groupItems: { alpha: ["vote-other"] },
})

async function ready(): Promise<LocalConnector> {
  const connector = new LocalConnector(seed())
  await connector.init()
  connector.setCurrentGroup("alpha")
  return connector
}

beforeEach(() => { idb.reset() })

describe("LocalConnector — authorial items (spec 08, authoritative)", () => {
  it("answers trusted and writes no claim, dropping a caller-supplied one", async () => {
    const connector = await ready()
    const created = await connector.createItem({ type: "comment", createdBy: "user-1", data: { content: "x", claim: "forged" } })
    expect("claim" in created.data).toBe(false)
    expect(await connector.verifyItemClaim!(created)).toBe("trusted")
  })

  it("lets the author change the content until someone else binds a reference to it", async () => {
    const connector = await ready()
    const free = await connector.createItem({ type: "statement", createdBy: "user-1", data: { title: "a" } })
    await connector.updateItem(free.id, { data: { title: "b" } })
    expect((await connector.getItem(free.id))!.data.title).toBe("b")

    await connector.createItem({ id: "statement-1", type: "statement", createdBy: "user-1", data: { title: "gesagt" } })
    await expect(connector.updateItem("statement-1", { data: { title: "anders" } })).rejects.toThrow(/frozen/)
    await connector.updateItem("statement-1", { tags: ["modul:x"] })
    const frozen = (await connector.getItem("statement-1"))!
    expect(frozen.data.title).toBe("gesagt")
    expect(frozen.tags).toEqual(["modul:x"])
  })
})
