import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * Shared fake IndexedDB store (wie group-patch-atomicity): `update` läuft
 * gegen den AKTUELLEN Stand, jede Lese- und Schreiboperation wird tief
 * kopiert wie beim structured clone von IndexedDB. Zwei Connector-Instanzen
 * auf diesem Store sind zwei Tabs (rls#575).
 */
const backing = new Map<string, unknown>()
const clone = <T>(value: T): T => (value === undefined ? value : structuredClone(value))
vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => clone(backing.get(key))),
  set: vi.fn(async (key: string, value: unknown) => { backing.set(key, clone(value)) }),
  update: vi.fn(async (key: string, updater: (value: unknown) => unknown) => {
    backing.set(key, clone(updater(clone(backing.get(key)))))
  }),
  del: vi.fn(async (key: string) => { backing.delete(key) }),
  createStore: vi.fn().mockReturnValue({}),
}))

vi.stubGlobal("BroadcastChannel", class {
  onmessage = null
  postMessage() {}
  close() {}
})

import { LocalConnector } from "../src/local-connector.js"

const seed = () => ({
  items: [],
  groups: [{ id: "g1", name: "Garten" }],
  users: [{ id: "u1", displayName: "Anton" }],
  groupMembers: { g1: ["u1"] },
})

async function makeConnector(): Promise<LocalConnector> {
  const connector = new LocalConnector(seed())
  await connector.init()
  return connector
}

async function storedGroupIds(): Promise<string[]> {
  const fresh = await makeConnector()
  return (await fresh.getGroups()).map((group) => group.id).sort()
}

describe("LocalConnector — Group-Id (rls#575, Befund 1)", () => {
  beforeEach(() => backing.clear())
  afterEach(() => vi.restoreAllMocks())

  it("zwei Groups in derselben Millisekunde bekommen verschiedene Ids", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    const connector = await makeConnector()

    const first = await connector.createGroup("Erste")
    const second = await connector.createGroup("Zweite")

    expect(first.id).not.toBe(second.id)
    expect((await connector.getGroups()).map((group) => group.id)).toEqual(["g1", first.id, second.id])
  })

  it("die Mitglieder der ersten Group überleben das Anlegen der zweiten", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    const connector = await makeConnector()

    const first = await connector.createGroup("Erste")
    await connector.inviteMember(first.id, "u2")
    await connector.createGroup("Zweite")

    const fresh = await makeConnector()
    const members = (fresh as unknown as { groupMembers: Record<string, string[]> }).groupMembers
    expect(members[first.id]).toEqual(["u1", "u2"])
  })

  it("die Id ist eine UUID", async () => {
    const connector = await makeConnector()
    const group = await connector.createGroup("Neu")
    expect(group.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})

describe("LocalConnector — Groups über Instanzen (rls#575, Befund 2)", () => {
  beforeEach(() => backing.clear())

  it("zwei Instanzen legen je eine Group an: beide bleiben erhalten", async () => {
    const a = await makeConnector()
    const b = await makeConnector() // hydriert VOR a's Write — RAM ist gleich alt

    const fromA = await a.createGroup("Von A")
    const fromB = await b.createGroup("Von B")

    expect(await storedGroupIds()).toEqual(["g1", fromA.id, fromB.id].sort())
  })

  it("ein persist() mit veralteter Liste überschreibt die neue Group nicht", async () => {
    const a = await makeConnector()
    const b = await makeConnector()

    const fromA = await a.createGroup("Von A")
    await b.logout() // schreibt über persist() — b kennt fromA nicht

    expect(await storedGroupIds()).toEqual(["g1", fromA.id].sort())
  })

  it("eine Instanz löscht eine Group, ohne die neue Group der anderen zu verlieren", async () => {
    const a = await makeConnector()
    const b = await makeConnector()

    const fromA = await a.createGroup("Von A")
    await b.deleteGroup("g1")

    expect(await storedGroupIds()).toEqual([fromA.id])
  })

  it("das Löschen ist dauerhaft, auch wenn die andere Instanz danach schreibt", async () => {
    const a = await makeConnector()
    const b = await makeConnector()

    await a.deleteGroup("g1")
    await b.createGroup("Von B")

    const ids = await storedGroupIds()
    expect(ids).not.toContain("g1")
    expect(ids).toHaveLength(1)
  })

  it("ein Namenswechsel der einen Instanz geht beim Anlegen der anderen nicht verloren", async () => {
    const a = await makeConnector()
    const b = await makeConnector()

    await a.updateGroup("g1", { name: "Gemeinschaftsgarten" })
    await b.createGroup("Von B")

    const fresh = await makeConnector()
    expect((await fresh.getGroups()).find((group) => group.id === "g1")?.name).toBe("Gemeinschaftsgarten")
  })
})
