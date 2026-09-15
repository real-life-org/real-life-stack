import { beforeEach, describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"

import type { RlsSpaceDoc } from "../src/types.js"

/**
 * Spec 12 Regel 12 (Home-Quelle): das Profil-Item im deterministischen
 * persoenlichen Space ist die kanonische Quelle, `doc.profile` nur noch
 * Write-through-Projektion.
 *
 * Getestet wird die ECHTE Implementierung ueber den etablierten
 * Prototyp-Seam (`Object.create(WotConnector.prototype)`) — der Connector ist
 * im Ganzen nicht instanziierbar, seine Methoden sind es.
 */

const personalDoc = vi.hoisted(() => ({ value: {} as { profile?: Record<string, unknown> } }))

vi.mock("@real-life/adapter-yjs", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getYjsPersonalDoc: () => personalDoc.value,
    changeYjsPersonalDoc: (fn: (doc: unknown) => void) => { fn(personalDoc.value) },
    onYjsPersonalDocChange: () => () => {},
  }
})

const { WotConnector } = await import("../src/wot-connector.js")

const DID = "did:key:z6MkAnton"

function fakeHandle(id: string, doc: RlsSpaceDoc) {
  const remote: Array<() => void> = []
  return {
    id,
    getDoc: () => doc,
    info: () => ({ id, type: "shared", members: [DID], createdAt: "" }),
    transact: (fn: (d: RlsSpaceDoc) => void) => { fn(doc) },
    onRemoteUpdate: (cb: () => void) => { remote.push(cb); return () => {} },
    close: () => {},
    _fireRemote: () => { for (const cb of remote) cb() },
  }
}

function fakeConnector(doc: RlsSpaceDoc = { _type: "rls", items: {} }) {
  const handle = fakeHandle("home-space", doc)
  const connector = Object.create(WotConnector.prototype) as any
  connector.identity = { getDid: () => DID }
  connector.privateSpaceId = "home-space"
  connector.replication = { openSpace: vi.fn(async () => handle) }
  connector.profileObs = createObservable(null)
  connector.currentUserObs = createObservable({ id: DID, displayName: "Anton" })
  connector.memberObservables = new Map()
  connector.itemObservables = new Map()
  connector.itemByIdObservables = new Map()
  connector.relatedObservables = new Map()
  connector.crossGroupIndex = { reindexGroup: vi.fn() }
  connector.notifyAllObservers = vi.fn()
  connector.publishProfile = vi.fn(async () => {})
  connector.broadcastProfileUpdate = vi.fn(async () => {})
  connector.getCurrentUser = async () => connector.currentUserObs.current
  connector.queueProfileHomeMaintenance = vi.fn(async () => {})
  connector.refreshProfileShares = vi.fn()
  return { connector, doc, handle }
}

beforeEach(() => {
  personalDoc.value = {}
})

describe("Profil lesen — Spec 12 Regel 12", () => {
  it("liefert das Item aus dem persoenlichen Space, sobald es existiert", async () => {
    const { connector } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Anton" })

    const item = await connector.getMyProfile()
    expect(item?.id).toBe(DID)
    expect(item?.data.displayName).toBe("Anton")
  })

  it("zeigt bis zur Migration weiter die Projektion aus doc.profile (Anzeige bricht nicht)", async () => {
    personalDoc.value.profile = { did: DID, name: "Alt-Anton", bio: "aus dem PersonalDoc", avatar: null }
    const { connector } = fakeConnector()

    await connector.ensureHomeHandle()
    connector.syncProfileObservable()

    const item = await connector.getMyProfile()
    expect(item?.data.displayName).toBe("Alt-Anton")
    expect(item?.data.bio).toBe("aus dem PersonalDoc")
  })

  it("sobald das Item da ist, gewinnt es immer gegen doc.profile", async () => {
    personalDoc.value.profile = { did: DID, name: "Alt-Anton" }
    const { connector, doc } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Item-Anton" })

    // Ein spaeter eintreffendes doc.profile (Wiederherstellung) aendert nichts.
    personalDoc.value.profile = { did: DID, name: "Spaet-Anton" }
    connector.syncProfileObservable()

    expect((await connector.getMyProfile())?.data.displayName).toBe("Item-Anton")
    expect(doc.items[DID]).toBeDefined()
  })
})

describe("Profil schreiben — Spec 12 Regel 1, 2 und 12", () => {
  it("legt das Item mit id = createdBy = data.did = DID an", async () => {
    const { connector, doc } = fakeConnector()

    const item = await connector.updateMyProfile({ displayName: "Anton" })

    expect(item.id).toBe(DID)
    expect(item.createdBy).toBe(DID)
    expect(item.data.did).toBe(DID)
    expect(doc.items[DID]).toBeDefined()
  })

  it("nimmt die Item-Felder entgegen und traegt den Ort als place/v1 (Regel 2)", async () => {
    const { connector } = fakeConnector()

    const item = await connector.updateMyProfile({
      displayName: "Anton",
      bio: "Baut Netze",
      avatarUrl: "a.png",
      position: { type: "Point", coordinates: [9.5, 51.3] },
      address: "Kassel",
      locationName: "Werkstatt",
    })

    expect(item.data.position).toEqual({ type: "Point", coordinates: [9.5, 51.3] })
    expect(item.data.address).toBe("Kassel")
    expect(item.data.locationName).toBe("Werkstatt")
    expect(item["@context"].some((entry: string) => entry.includes("place/v1"))).toBe(true)
  })

  it("nimmt weiterhin die alten Feldnamen name/avatar entgegen", async () => {
    const { connector } = fakeConnector()

    const item = await connector.updateMyProfile({ name: "Anton", avatar: "a.png" })

    expect(item.data.displayName).toBe("Anton")
    expect(item.data.avatarUrl).toBe("a.png")
  })

  it("bildet displayName/bio/avatarUrl per Write-through auf doc.profile ab", async () => {
    const { connector } = fakeConnector()

    await connector.updateMyProfile({ displayName: "Anton", bio: "Baut Netze", avatarUrl: "a.png" })

    expect(personalDoc.value.profile).toMatchObject({ name: "Anton", bio: "Baut Netze", avatar: "a.png" })
  })

  it("laesst die Position NIE in doc.profile und damit nie in den Verzeichnisdienst (Regel 11)", async () => {
    const { connector } = fakeConnector()

    await connector.updateMyProfile({ displayName: "Anton", position: { type: "Point", coordinates: [9.5, 51.3] } })

    expect(personalDoc.value.profile).not.toHaveProperty("position")
  })

  it("aktualisiert ein vorhandenes Item und setzt updatedAt", async () => {
    const { connector, doc } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Anton" })
    const createdAt = doc.items[DID].createdAt

    const item = await connector.updateMyProfile({ bio: "Baut Netze" })

    expect(item.data.displayName).toBe("Anton")
    expect(item.data.bio).toBe("Baut Netze")
    expect(item.createdAt).toBe(createdAt)
    expect(item.updatedAt).toBeTruthy()
  })

  it("updateProfile schreibt ebenfalls zuerst das Item, dann doc.profile", async () => {
    const { connector, doc } = fakeConnector()

    await connector.updateProfile({ name: "Anton", bio: "Baut Netze" })

    expect(doc.items[DID]).toBeDefined()
    expect(personalDoc.value.profile).toMatchObject({ name: "Anton", bio: "Baut Netze" })
    expect(connector.publishProfile).toHaveBeenCalled()
  })
})
