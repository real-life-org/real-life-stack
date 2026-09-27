import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { itemContentHash, voteRecordInput } from "@real-life-stack/data-interface"

/** Shared IndexedDB for all "tabs" (connector instances), with serialized updates. */
const idb = vi.hoisted(() => {
  let state: unknown
  let queue = Promise.resolve()
  const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value))
  return {
    reset(): void {
      state = undefined
      queue = Promise.resolve()
    },
    get: async () => clone(state),
    set: async (_key: string, value: unknown) => { state = clone(value) },
    update: (_key: string, updater: (value: unknown) => unknown) => {
      const transaction = queue.then(() => { state = clone(updater(clone(state))) })
      queue = transaction.catch(() => {})
      return transaction
    },
    del: async () => { state = undefined },
  }
})

vi.mock("idb-keyval", () => ({
  get: idb.get,
  set: idb.set,
  update: idb.update,
  del: idb.del,
  createStore: () => ({}),
}))

/** A BroadcastChannel that really delivers between instances (like tabs). */
const bus = vi.hoisted(() => ({ channels: new Set<{ onmessage: ((event: { data: unknown }) => void) | null }>() }))
vi.stubGlobal("BroadcastChannel", class {
  onmessage: ((event: { data: unknown }) => void) | null = null
  constructor() { bus.channels.add(this) }
  postMessage(data: unknown) {
    for (const channel of bus.channels) if (channel !== this) queueMicrotask(() => channel.onmessage?.({ data }))
  }
  close() { bus.channels.delete(this) }
})

import { LocalConnector, TAB_IDENTITY_NAMES } from "../src/local-connector.js"

const seed = {
  items: [] as Item[],
  groups: [{ id: "g1", name: "Garten" }, { id: "g2", name: "Hof" }],
  users: [{ id: "user-1", displayName: "Alice" }],
  groupMembers: { g1: ["user-1"], g2: ["user-1"] },
  groupItems: { g1: [], g2: [] },
}

/** One tab = its own sessionStorage. */
function tabStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}

async function openTab(storage = tabStorage()) {
  const connector = new LocalConnector(seed, { identity: "per-tab", identityStorage: storage })
  await connector.init()
  return { connector, storage }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

beforeEach(() => {
  idb.reset()
  bus.channels.clear()
})

describe("LocalConnector identity per tab", () => {
  it("gives every tab its own person, member of every space", async () => {
    const a = await openTab()
    const b = await openTab()
    const userA = await a.connector.getCurrentUser()
    const userB = await b.connector.getCurrentUser()
    expect(userA?.displayName).toBe(TAB_IDENTITY_NAMES[0])
    expect(userB?.displayName).toBe(TAB_IDENTITY_NAMES[1])
    expect(userA?.id).not.toBe(userB?.id)
    for (const group of ["g1", "g2"]) {
      const members = (await b.connector.getMembers(group)).map((user) => user.id)
      expect(members).toEqual(expect.arrayContaining([userA!.id, userB!.id]))
    }
    await settle()
    // Tab A learns about Bert through the channel.
    expect((await a.connector.getMembers("g1")).map((user) => user.displayName)).toContain(TAB_IDENTITY_NAMES[1])
  })

  it("keeps the person across a reload of the same tab", async () => {
    const a = await openTab()
    const before = await a.connector.getCurrentUser()
    await a.connector.dispose()
    const reloaded = await openTab(a.storage)
    expect((await reloaded.connector.getCurrentUser())?.id).toBe(before?.id)
  })

  it("keeps both people when two tabs open at the same time", async () => {
    const [a, b] = await Promise.all([openTab(), openTab()])
    const third = await openTab()
    const names = (await third.connector.getMembers("g1")).map((user) => user.displayName)
    expect(names).toEqual(expect.arrayContaining([
      (await a.connector.getCurrentUser())!.displayName,
      (await b.connector.getCurrentUser())!.displayName,
    ]))
  })

  it("remembers the current space per tab", async () => {
    const a = await openTab()
    const b = await openTab()
    a.connector.setCurrentGroup("g2")
    b.connector.setCurrentGroup("g1")
    await settle()
    expect(a.connector.getCurrentGroup()?.id).toBe("g2")
    expect(b.connector.getCurrentGroup()?.id).toBe("g1")
    await a.connector.dispose()
    const reloaded = await openTab(a.storage)
    expect(reloaded.connector.getCurrentGroup()?.id).toBe("g2")
  })

  it("makes multi-user stories real: another tab's vote freezes my statement", async () => {
    const a = await openTab()
    const b = await openTab()
    a.connector.setCurrentGroup("g1")
    b.connector.setCurrentGroup("g1")
    const userA = (await a.connector.getCurrentUser())!
    const userB = (await b.connector.getCurrentUser())!
    const statement = await a.connector.createItem({ type: "statement", createdBy: userA.id, data: { title: "Wir treffen uns montags" } })
    expect(statement.createdBy).toBe(userA.id)
    await settle()

    const hash = (await itemContentHash(statement))!
    const vote = await b.connector.createRelationRecord(voteRecordInput(userB.id, statement.id, "green", hash))
    expect(vote.createdBy).toBe(userB.id)
    await settle()

    await expect(a.connector.updateItem(statement.id, { data: { title: "Wir treffen uns dienstags" } })).rejects.toThrow(/frozen/)
  })

  it("leaves the shared mode unchanged: every instance is the first person", async () => {
    const shared = new LocalConnector(seed)
    await shared.init()
    expect((await shared.getCurrentUser())?.id).toBe("user-1")
  })
})
