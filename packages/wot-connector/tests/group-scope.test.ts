import { describe, expect, it, vi } from "vitest"
import { createObservable, hasGroupScope } from "@real-life-stack/data-interface"
import { WotConnector } from "../src/wot-connector"
import { CrossGroupIndex } from "../src/CrossGroupIndex"
import { deserializeItem, serializeItem } from "../src/serialization"
import type { RlsSpaceDoc } from "../src/types"

/**
 * 02 → Lesen/Anlegen in einem bestimmten Space. Der WoT-Connector liest
 * einen nicht geöffneten Space aus dem CrossGroupIndex (der hält alle
 * Spaces offen und folgt Remote-Updates) und legt in ihm über sein
 * eigenes, Ende-zu-Ende-verschlüsseltes Dokument an: EINE Yjs-Transaktion
 * im Ziel-Dokument, kein Umweg über den geöffneten Space.
 */
function harness() {
  const remote = new Map<string, Set<() => void>>()
  const docs: Record<string, RlsSpaceDoc> = {
    offen: { _type: "rls", items: {} } as RlsSpaceDoc,
    anderer: { _type: "rls", items: {} } as RlsSpaceDoc,
    privat: { _type: "rls", items: {} } as RlsSpaceDoc,
  }
  const transacts: string[] = []
  const closed: string[] = []
  const makeHandle = (id: string) => ({
    getDoc: () => docs[id]!,
    transact: (fn: (d: RlsSpaceDoc) => void) => { transacts.push(id); fn(docs[id]!) },
    onRemoteUpdate: (cb: () => void) => {
      const set = remote.get(id) ?? new Set()
      set.add(cb)
      remote.set(id, set)
      return () => set.delete(cb)
    },
    close: () => { closed.push(id) },
  })
  const replication = {
    openSpace: vi.fn(async (id: string) => {
      if (!docs[id]) throw new Error(`unknown space ${id}`)
      return makeHandle(id)
    }),
    watchSpaces: () => ({
      getValue: () => [
        { id: "offen", type: "shared" },
        { id: "anderer", type: "shared" },
        { id: "privat", type: "shared", appTag: "rls-private" },
      ],
      subscribe: () => () => {},
    }),
  }
  const value = Object.create(WotConnector.prototype) as any
  value.handleReady = Promise.resolve()
  value.replication = replication
  value.currentGroupId = "offen"
  value.currentHandle = makeHandle("offen")
  value.groupsCache = [{ id: "offen", name: "Offen" }, { id: "anderer", name: "Anderer" }]
  value.privateSpaceId = "privat"
  value.currentUserObs = createObservable({ id: "did:key:me", displayName: "Ich" })
  value.identity = { getDid: () => "did:key:me", signEd25519: async () => new Uint8Array(64) }
  value.activityObservables = new Map()
  value.scopedActivityObservables = new Map()
  value.activityDirty = false
  value.itemCache = null
  value.itemObservables = new Map()
  value.itemByIdObservables = new Map()
  value.relatedObservables = new Map()
  value.relatedObservableParams = new Map()
  value.appendActivity = vi.fn()
  value.crossGroupIndex = new CrossGroupIndex<RlsSpaceDoc, any>(
    replication as never,
    (d) => new Map(Object.entries(d.items ?? {}).map(([id, s]) => [id, deserializeItem(s)])),
    (item) => item.type,
    { groupFilter: (info) => info.type === "shared" || info.type === "personal" },
  )
  value.crossGroupIndex.start()
  value.crossGroupIndex.onChange(() => value.notifyAllObservers(true))
  const remoteWrite = (id: string, item: { id: string; type: string; data: Record<string, unknown> }) => {
    docs[id]!.items[item.id] = serializeItem({ ...item, createdAt: "2026-09-27T00:00:00.000Z", createdBy: "did:key:other" })
    for (const cb of remote.get(id) ?? []) cb()
  }
  return { connector: value as WotConnector, docs, transacts, closed, remoteWrite, replication }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("WotConnector — GroupScopeCapable", () => {
  it("sagt group zu", () => {
    expect(hasGroupScope(harness().connector)).toBe(true)
  })

  it("legt in genau EINER Transaktion im Ziel-Dokument an und schließt das eigene Handle", async () => {
    const { connector, docs, transacts, closed } = harness()
    await tick()
    const created = await connector.createItem({ type: "task", createdBy: "did:key:me", data: { title: "dort" } }, { group: "anderer" })
    expect(transacts).toEqual(["anderer"])
    expect(Object.keys(docs.anderer!.items)).toEqual([created.id])
    expect(docs.offen!.items).toEqual({})
    expect(closed).toContain("anderer")
    expect(connector.getCurrentGroup()?.id ?? (connector as any).currentGroupId).toBe("offen")
  })

  it("legt im persönlichen Space an, auch wenn er keine Gruppe ist (Regel 2)", async () => {
    const { connector, docs } = harness()
    await tick()
    const created = await connector.createItem({ type: "task", createdBy: "did:key:me", data: {} }, { group: "privat" })
    expect(Object.keys(docs.privat!.items)).toEqual([created.id])
  })

  it("lehnt einen unbekannten Space ab, ohne ein Dokument anzufassen", async () => {
    const { connector, transacts, replication } = harness()
    await tick()
    replication.openSpace.mockClear()
    await expect(connector.createItem({ type: "task", createdBy: "did:key:me", data: {} }, { group: "fremd" })).rejects.toThrow()
    expect(transacts).toEqual([])
    expect(replication.openSpace).not.toHaveBeenCalled()
    expect(await connector.getItems({ group: "fremd" })).toEqual([])
  })

  it("observe mit group folgt Remote-Änderungen im nicht geöffneten Space", async () => {
    const { connector, remoteWrite } = harness()
    await tick()
    const observable = connector.observe({ group: "anderer" })
    await tick()
    expect(observable.loaded).toBe(true)
    expect(observable.current).toEqual([])
    remoteWrite("anderer", { id: "r1", type: "task", data: { title: "von drüben" } })
    await tick()
    await tick()
    expect(observable.current.map(({ id }) => id)).toEqual(["r1"])
    // Remote im geöffneten Space: erscheint dort nicht.
    remoteWrite("offen", { id: "r2", type: "task", data: {} })
    await tick()
    await tick()
    expect(observable.current.map(({ id }) => id)).toEqual(["r1"])
  })

  it("liest einen noch nicht indizierten Space direkt aus seinem Dokument", async () => {
    const { connector, docs, closed } = harness()
    // Kein tick: der Index hat noch nichts geöffnet.
    docs.anderer!.items.x = serializeItem({ id: "x", type: "task", data: {}, createdAt: "2026-09-27T00:00:00.000Z", createdBy: "did:key:other" })
    ;(connector as any).crossGroupIndex = null
    expect((await connector.getItems({ group: "anderer" })).map(({ id }) => id)).toEqual(["x"])
    expect(closed).toContain("anderer")
  })
})
