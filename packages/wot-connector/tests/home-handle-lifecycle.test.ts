import { describe, it, expect, vi } from "vitest"

import { WotConnector } from "../src/wot-connector.js"

/**
 * Lebenszyklus des Home-Handles.
 *
 * Der Yjs-Adapter gibt pro `openSpace` einen NEUEN `SpaceHandle` mit eigenem
 * `doc.on("update")`-Abonnement zurueck (`YjsReplicationAdapter.openSpace` →
 * `new YjsSpaceHandle(...)`, der Konstruktor haengt sich an das Dokument und
 * traegt sich in `spaceState.handles` ein). Es gibt keine Referenzzaehlung:
 * `close()` wirkt nur auf genau diesen Handle. Jeder geoeffnete und nicht
 * geschlossene Handle bleibt daher als Listener am Dokument haengen.
 */

function fakeHandle(id: string) {
  const remote = new Set<() => void>()
  return {
    id,
    closes: 0,
    getDoc: () => ({ _type: "rls", items: {} }),
    transact: (fn: (d: any) => void) => fn({ _type: "rls", items: {} }),
    onRemoteUpdate(cb: () => void) {
      remote.add(cb)
      return () => remote.delete(cb)
    },
    close() { this.closes += 1 },
  }
}

function fakeConnector(handle: ReturnType<typeof fakeHandle>) {
  const connector = Object.create(WotConnector.prototype) as any
  connector.privateSpaceId = handle.id
  connector.runtimeGeneration = 1
  connector.homeHandle = null
  connector.homeHandleUnsub = null
  connector.replication = { openSpace: vi.fn(async () => handle) }
  connector.onHomeDocChanged = vi.fn()
  return connector
}

describe("ensureHomeHandle — veralteter Handle", () => {
  it("schliesst den Handle, wenn der persoenliche Space waehrend des Oeffnens wechselt", async () => {
    const handle = fakeHandle("home-alt")
    const connector = fakeConnector(handle)
    connector.replication.openSpace = vi.fn(async () => {
      connector.privateSpaceId = "home-neu"
      return handle
    })

    const result = await connector.ensureHomeHandle()

    expect(result).toBeNull()
    expect(handle.closes).toBe(1)
    expect(connector.homeHandle).toBeNull()
  })

  it("schliesst den Handle, wenn die Runtime waehrend des Oeffnens wechselt", async () => {
    const handle = fakeHandle("home")
    const connector = fakeConnector(handle)
    connector.replication.openSpace = vi.fn(async () => {
      connector.runtimeGeneration = 2
      return handle
    })

    const result = await connector.ensureHomeHandle()

    expect(result).toBeNull()
    expect(handle.closes).toBe(1)
    expect(connector.homeHandle).toBeNull()
  })

  it("schliesst einen zuvor gehaltenen Handle eines anderen Space", async () => {
    const alt = fakeHandle("home-alt")
    const neu = fakeHandle("home-neu")
    const connector = fakeConnector(neu)
    connector.homeHandle = alt
    connector.homeHandleUnsub = vi.fn()

    const result = await connector.ensureHomeHandle()

    expect(result).toBe(neu)
    expect(alt.closes).toBe(1)
    expect(neu.closes).toBe(0)
    expect(connector.homeHandleUnsub).toBeTypeOf("function")
  })

  it("oeffnet fuer einen unveraenderten Space nicht erneut", async () => {
    const handle = fakeHandle("home")
    const connector = fakeConnector(handle)
    connector.homeHandle = handle

    expect(await connector.ensureHomeHandle()).toBe(handle)
    expect(connector.replication.openSpace).not.toHaveBeenCalled()
    expect(handle.closes).toBe(0)
  })
})

describe("releaseHomeHandle", () => {
  it("schliesst den gehaltenen Handle und loest das Abonnement", async () => {
    const handle = fakeHandle("home")
    const connector = fakeConnector(handle)
    await connector.ensureHomeHandle()
    expect(connector.homeHandle).toBe(handle)

    connector.releaseHomeHandle()

    expect(handle.closes).toBe(1)
    expect(connector.homeHandle).toBeNull()
    expect(connector.homeHandleUnsub).toBeNull()
  })

  it("ist ohne gehaltenen Handle ein No-op", () => {
    const connector = fakeConnector(fakeHandle("home"))

    expect(() => connector.releaseHomeHandle()).not.toThrow()
  })

  it("schliesst genau einmal, auch bei doppeltem Aufruf", async () => {
    const handle = fakeHandle("home")
    const connector = fakeConnector(handle)
    await connector.ensureHomeHandle()

    connector.releaseHomeHandle()
    connector.releaseHomeHandle()

    expect(handle.closes).toBe(1)
  })
})
