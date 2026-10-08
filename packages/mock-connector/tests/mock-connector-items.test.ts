import { describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life/data-interface"
import { MockConnector, type MockConnectorSeed } from "../src/index"

const CREATED_AT = "2026-07-16T00:00:00.000Z"

function item(id: string, title: string): Item {
  return {
    id,
    type: "note",
    createdAt: CREATED_AT,
    createdBy: "seed",
    data: { title },
  }
}

function seed(items: Item[] = []): MockConnectorSeed {
  return {
    items,
    groups: [
      { id: "group-a", name: "A" },
      { id: "group-b", name: "B" },
    ],
    users: [{ id: "did:example:user", displayName: "User" }],
    groupMembers: {
      "group-a": ["did:example:user"],
      "group-b": ["did:example:user"],
    },
    groupItems: {
      "group-a": items.map(({ id }) => id),
      "group-b": [],
    },
  }
}

async function flushNotifications(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe("MockConnector item IDs", () => {
  it("deduplicates constructor seed IDs with first-item-wins semantics", async () => {
    const connector = new MockConnector(seed([
      item("duplicate", "first"),
      item("duplicate", "second"),
    ]), { allowFixtureAuthors: true })

    expect(await connector.getItems()).toEqual([item("duplicate", "first")])
  })

  it("preserves a supplied ID and returns an existing item unchanged", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })
    connector.setCurrentGroup("group-a")

    const created = await connector.createItem({
      id: "client-id",
      type: "note",
      createdBy: "did:example:user",
      data: { title: "first" },
    })
    const duplicate = await connector.createItem({
      id: "client-id",
      type: "note",
      createdBy: "did:example:other",
      data: { title: "replacement" },
    })

    expect(created.id).toBe("client-id")
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(duplicate).toBe(created)
    expect(await connector.getItems()).toEqual([created])
  })

  it("generates random ids, so two sessions on the same seed never hand out the same id", async () => {
    // real-life-stack#561: a per-session counter gave two browsers on the
    // same board the same `item-<n>`, and they overwrote each other.
    const first = new MockConnector(seed(), { allowFixtureAuthors: true })
    const second = new MockConnector(seed(), { allowFixtureAuthors: true })
    first.setCurrentGroup("group-a")
    second.setCurrentGroup("group-a")

    const a = await first.createItem({ type: "note", createdBy: "did:example:user", data: {} })
    const b = await second.createItem({ type: "note", createdBy: "did:example:user", data: {} })

    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(b.id).not.toBe(a.id)
  })

  it("skips collisions when allocating generated IDs", async () => {
    const connector = new MockConnector(seed([item("reserved-id", "reserved")]), { allowFixtureAuthors: true })
    connector.setCurrentGroup("group-a")
    const uuid = vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("reserved-id" as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce("fresh-id" as ReturnType<typeof crypto.randomUUID>)

    try {
      const created = await connector.createItem({
        type: "note",
        createdBy: "did:example:user",
        data: { title: "generated" },
      })

      expect(created.id).toBe("fresh-id")
    } finally {
      uuid.mockRestore()
    }
  })

  it("removes group mappings before a deterministic ID is recreated elsewhere", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })
    connector.setCurrentGroup("group-a")
    await connector.createItem({
      id: "reusable",
      type: "note",
      createdBy: "did:example:user",
      data: {},
    })
    await connector.deleteItem("reusable")

    connector.setCurrentGroup("group-b")
    await connector.createItem({
      id: "reusable",
      type: "note",
      createdBy: "did:example:user",
      data: { recreated: true },
    })

    connector.setCurrentGroup("group-a")
    expect(await connector.getItems()).toEqual([])
    connector.setCurrentGroup("group-b")
    expect((await connector.getItems()).map(({ id }) => id)).toEqual(["reusable"])
  })

  it("does not move over an existing space-local ID", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })
    connector.setCurrentGroup("group-a")
    await connector.createItem({
      id: "shared",
      type: "note",
      createdBy: "did:example:user",
      data: { scope: "a" },
    })
    connector.setCurrentGroup("group-b")
    await connector.createItem({
      id: "shared",
      type: "note",
      createdBy: "did:example:user",
      data: { scope: "b" },
    })

    connector.setCurrentGroup("group-a")
    expect(() => connector.moveItemToGroup("shared", "group-b")).toThrow(/already exists/)
    expect((await connector.getItem("shared"))?.data).toEqual({ scope: "a" })
    connector.setCurrentGroup("group-b")
    expect((await connector.getItem("shared"))?.data).toEqual({ scope: "b" })
  })

  it("moves an unassigned non-feature item into a group", async () => {
    const unassignedSeed = seed([item("unassigned", "Unassigned")])
    unassignedSeed.groupItems = { "group-a": [], "group-b": [] }
    const connector = new MockConnector(unassignedSeed, { allowFixtureAuthors: true })

    connector.moveItemToGroup("unassigned", "group-a")
    connector.setCurrentGroup("group-a")

    expect(await connector.getItem("unassigned")).toEqual(item("unassigned", "Unassigned"))
    expect(connector.getItemGroupId("unassigned")).toBe("group-a")
  })

  it("keeps runtime-created and injected feature items global", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })
    connector.setCurrentGroup("group-a")
    const created = await connector.createItem({
      id: "feature-created",
      type: "feature",
      createdBy: "did:example:user",
      data: { title: "Created" },
    })
    const injected: Item = {
      id: "feature-injected",
      type: "feature",
      createdAt: CREATED_AT,
      createdBy: "seed",
      data: { title: "Injected" },
    }
    connector.injectSeedItems([injected], "group-a")

    connector.setCurrentGroup("group-b")
    expect(await connector.getItem("feature-created")).toEqual(created)
    expect(await connector.getItem("feature-injected")).toEqual(injected)
  })

  it("reserves global feature IDs across space-local item scopes", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })
    connector.setCurrentGroup("group-a")
    const local = await connector.createItem({
      id: "reserved",
      type: "note",
      createdBy: "did:example:user",
      data: { scope: "a" },
    })

    connector.setCurrentGroup("group-b")
    await expect(connector.createItem({
      id: "reserved",
      type: "feature",
      createdBy: "did:example:user",
      data: {},
    })).rejects.toThrow(/conflicts with another scope/)

    const feature = await connector.createItem({
      id: "global",
      type: "feature",
      createdBy: "did:example:user",
      data: {},
    })
    await expect(connector.createItem({
      id: "global",
      type: "note",
      createdBy: "did:example:user",
      data: {},
    })).rejects.toThrow(/conflicts with global feature/)

    connector.setCurrentGroup("group-a")
    expect(await connector.getItem("reserved")).toBe(local)
    expect(await connector.getItem("global")).toBe(feature)
    expect((await connector.getItems()).filter(({ id }) => id === "reserved")).toEqual([local])
  })

  it("avoids local IDs when allocating IDs for global features", async () => {
    const connector = new MockConnector(seed([item("local-id", "local")]), { allowFixtureAuthors: true })
    connector.setCurrentGroup("group-b")
    const uuid = vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("local-id" as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce("fresh-id" as ReturnType<typeof crypto.randomUUID>)

    try {
      const feature = await connector.createItem({
        type: "feature",
        createdBy: "did:example:user",
        data: {},
      })

      expect(feature.id).toBe("fresh-id")
    } finally {
      uuid.mockRestore()
    }
  })

  it("does not promote a duplicated space-local ID into the global feature scope", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })
    connector.injectSeedItems([item("shared", "a")], "group-a")
    connector.injectSeedItems([item("shared", "b")], "group-b")
    connector.setCurrentGroup("group-a")

    await expect(connector.updateItem("shared", { type: "feature" }))
      .rejects.toThrow(/conflicts with another scope/)
    expect((await connector.getItem("shared"))?.type).toBe("note")
  })

  it("does not promote an unassigned ID that also exists in a space", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })
    const unassigned = await connector.createItem({
      id: "shared",
      type: "note",
      createdBy: "did:example:user",
      data: { scope: "unassigned" },
    })
    connector.setCurrentGroup("group-a")
    const scoped = await connector.createItem({
      id: "shared",
      type: "note",
      createdBy: "did:example:user",
      data: { scope: "a" },
    })

    connector.setCurrentGroup(null)
    await expect(connector.updateItem("shared", { type: "feature" }))
      .rejects.toThrow(/conflicts with another scope/)
    expect(await connector.getItem("shared")).toBe(unassigned)
    connector.setCurrentGroup("group-a")
    expect(await connector.getItem("shared")).toBe(scoped)
  })
})

describe("MockConnector fixture injection", () => {
  it("is idempotent across a real second import and keeps the first item unchanged", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })
    connector.setCurrentGroup("group-a")
    await flushNotifications()
    const observable = connector.observe({})
    const listener = vi.fn()
    observable.subscribe(listener)

    const firstSeed = [item("seed-a", "first"), item("seed-b", "second")]
    const first = connector.injectSeedItems(firstSeed, "group-a")
    await flushNotifications()
    const second = connector.injectSeedItems([
      item("seed-a", "replacement"),
      item("seed-b", "replacement"),
    ], "group-a")
    await flushNotifications()

    expect(second).toEqual(first)
    expect(second[0]).toBe(first[0])
    expect(await connector.getItems()).toEqual(firstSeed)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("deduplicates repeated IDs within one injected batch", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })

    connector.injectSeedItems([
      item("seed-a", "first"),
      item("seed-a", "second"),
    ], "group-a")
    connector.setCurrentGroup("group-a")

    expect(await connector.getItems()).toEqual([item("seed-a", "first")])
  })

  it("deduplicates fixture IDs independently in each space", async () => {
    const connector = new MockConnector(seed(), { allowFixtureAuthors: true })

    connector.injectSeedItems([item("shared-seed", "a-first")], "group-a")
    connector.injectSeedItems([item("shared-seed", "a-replacement")], "group-a")
    connector.injectSeedItems([item("shared-seed", "b-first")], "group-b")

    connector.setCurrentGroup("group-a")
    expect(await connector.getItem("shared-seed")).toEqual(item("shared-seed", "a-first"))
    connector.setCurrentGroup("group-b")
    expect(await connector.getItem("shared-seed")).toEqual(item("shared-seed", "b-first"))
  })
})
