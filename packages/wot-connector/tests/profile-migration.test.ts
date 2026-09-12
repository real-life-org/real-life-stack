import { beforeEach, describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"

import { mirrorRegistryKey } from "../src/mirror/index.js"
import type { RlsSpaceDoc } from "../src/types.js"

/**
 * Spec 12 Regel 12 (Migration) und Regel 5 (Uebergangsregel/Bestand).
 *
 * Migration laeuft ERST nach dem Erstsync-Signal des persoenlichen Space und
 * nur, wenn das Item dann fehlt und `doc.profile` existiert. Die Bestandsregel
 * laeuft danach genau einmal ueber alle Geraete — die Marke liegt im Home-Doc.
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

function fakeConnector(options: {
  doc?: RlsSpaceDoc
  spaces?: Array<{ id: string; appTag?: string; type?: string; admission?: { keyGeneration: number } }>
  outstanding?: Array<{ docId: string }>
  firstFillDone?: boolean
  expectRemoteData?: boolean
  deviceId?: string
  homeCatchUpReported?: boolean
} = {}) {
  const doc: RlsSpaceDoc = options.doc ?? { _type: "rls", items: {} }
  const handle = {
    id: "home-space",
    getDoc: () => doc,
    transact: (fn: (d: RlsSpaceDoc) => void) => { fn(doc) },
    onRemoteUpdate: () => () => {},
    close: () => {},
  }
  const spaces = (options.spaces ?? []).map((space) => ({
    type: "shared", appTag: "rls", members: [DID], createdAt: "", ...space,
  }))
  const connector = Object.create(WotConnector.prototype) as any
  connector.identity = { getDid: () => DID }
  connector.privateSpaceId = "home-space"
  connector.homeHandle = handle
  connector.runtimeGeneration = 1
  connector.replication = {
    openSpace: vi.fn(async () => handle),
    watchSpaces: () => ({ getValue: () => spaces }),
  }
  connector.docLogStore = { resolveConnectDeviceId: async () => options.deviceId ?? "device-A" }
  connector.catchUpRegistry = {
    getOverview: () => ({ outstanding: options.outstanding ?? [], syncing: (options.outstanding ?? []).length > 0 }),
  }
  connector.initialSync = { isFirstFillDone: () => options.firstFillDone ?? true }
  connector.authExpectsRemoteData = options.expectRemoteData ?? true
  connector.profileObs = createObservable(null)
  connector.profileSharesObs = createObservable<Record<string, string>>({}, false)
  connector.currentUserObs = createObservable({ id: DID, displayName: "Anton" })
  connector.memberObservables = new Map()
  connector.crossGroupIndex = { reindexGroup: vi.fn() }
  connector.notifyAllObservers = vi.fn()
  connector.activityDirty = false
  connector.profileHomeMaintenance = Promise.resolve()
  // Der Adapter hat den Catch-up des Home-Docs gemeldet (Spec 12 Regel 12) —
  // erst dann darf die pauschale Bestandsregel laufen.
  connector.homeCatchUpReported = options.homeCatchUpReported ?? true
  return { connector, doc, handle }
}

beforeEach(() => {
  personalDoc.value = {}
})

describe("Erstsync-Signal — Spec 12 Regel 12", () => {
  it("wartet, solange das Doc des persoenlichen Space noch aussteht", () => {
    const { connector } = fakeConnector({ outstanding: [{ docId: "home-space" }] })

    expect(connector.isHomeCatchUpSettled()).toBe(false)
  })

  it("wartet, solange irgendein Dokument der Sitzung noch aussteht", () => {
    const { connector } = fakeConnector({ outstanding: [{ docId: "garten" }] })

    expect(connector.isHomeCatchUpSettled()).toBe(false)
  })

  it("wartet, solange die Erstbefuellung dieses Geraets nicht durch ist", () => {
    const { connector } = fakeConnector({ firstFillDone: false })

    expect(connector.isHomeCatchUpSettled()).toBe(false)
  })

  it("eine gerade erzeugte Identitaet erwartet nichts von aussen und ist sofort durch", () => {
    const { connector } = fakeConnector({ firstFillDone: false, expectRemoteData: false })

    expect(connector.isHomeCatchUpSettled()).toBe(true)
  })

  it("ohne persoenlichen Space gibt es kein Signal", () => {
    const { connector } = fakeConnector()
    connector.privateSpaceId = null

    expect(connector.isHomeCatchUpSettled()).toBe(false)
  })

  it("migriert NICHT, bevor das Signal da ist", async () => {
    personalDoc.value.profile = { did: DID, name: "Anton" }
    const { connector, doc } = fakeConnector({ outstanding: [{ docId: "home-space" }] })

    await connector.queueProfileHomeMaintenance()

    expect(doc.items[DID]).toBeUndefined()
  })
})

describe("Migration — Spec 12 Regel 12", () => {
  it("legt das Item aus doc.profile an, wenn es fehlt", async () => {
    personalDoc.value.profile = { did: DID, name: "Anton", bio: "Baut Netze", avatar: "a.png" }
    const { connector, doc } = fakeConnector()

    await connector.queueProfileHomeMaintenance()

    expect(doc.items[DID]).toBeDefined()
    expect(doc.items[DID].createdBy).toBe(DID)
    expect(JSON.parse(JSON.stringify(doc.items[DID].data))).toMatchObject({
      displayName: "Anton", bio: "Baut Netze", avatarUrl: "a.png", did: DID,
    })
  })

  it("laesst ein vorhandenes Item unberuehrt — das Item gewinnt immer", async () => {
    personalDoc.value.profile = { did: DID, name: "Aus dem PersonalDoc" }
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {
        [DID]: {
          id: DID, type: "person", createdAt: "2026-01-01T00:00:00.000Z", createdBy: DID,
          data: { displayName: "Aus dem Item", did: DID },
        } as never,
      },
    }
    const { connector } = fakeConnector({ doc })

    await connector.queueProfileHomeMaintenance()

    expect((doc.items[DID].data as Record<string, unknown>).displayName).toBe("Aus dem Item")
  })

  it("legt ohne doc.profile KEIN leeres Item an", async () => {
    const { connector, doc } = fakeConnector()

    await connector.queueProfileHomeMaintenance()

    expect(doc.items[DID]).toBeUndefined()
  })

  it("ein spaet eintreffendes doc.profile aendert das migrierte Item nicht mehr", async () => {
    personalDoc.value.profile = { did: DID, name: "Anton" }
    const { connector, doc } = fakeConnector()
    await connector.queueProfileHomeMaintenance()

    personalDoc.value.profile = { did: DID, name: "Wiederhergestellt" }
    await connector.queueProfileHomeMaintenance()

    expect((doc.items[DID].data as Record<string, unknown>).displayName).toBe("Anton")
  })

  it("migriert ein spaet eintreffendes doc.profile, solange das Item noch fehlt", async () => {
    const { connector, doc } = fakeConnector()
    await connector.queueProfileHomeMaintenance()
    expect(doc.items[DID]).toBeUndefined()

    personalDoc.value.profile = { did: DID, name: "Spaet" }
    await connector.queueProfileHomeMaintenance()

    expect((doc.items[DID].data as Record<string, unknown>).displayName).toBe("Spaet")
  })
})

describe("Bestandsregel — Spec 12 Regel 5", () => {
  it("gibt jede bestehende Mitgliedschaft mit gueltiger Kennung frei und setzt die Marke", async () => {
    const { connector, doc } = fakeConnector({
      spaces: [
        { id: "home-space", appTag: "rls-private", admission: { keyGeneration: 0 } },
        { id: "garten", admission: { keyGeneration: 2 } },
        { id: "werkstatt", admission: { keyGeneration: 5 } },
      ],
    })

    await connector.queueProfileHomeMaintenance()

    const byDevice = (target: string) => doc.mirrorRegistry?.[mirrorRegistryKey(DID, target)]?.byDevice ?? {}
    expect(byDevice("garten")["device-A"]).toMatchObject({ status: "accepted", admission: { keyGeneration: 2 } })
    expect(byDevice("werkstatt")["device-A"]).toMatchObject({ status: "accepted", admission: { keyGeneration: 5 } })
    expect(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "home-space")]).toBeUndefined()
    expect(doc.profileMigration?.bestandAt).toBeTruthy()
  })

  it("laesst Alt-Spaces ohne Aufnahme-Kennung ohne Eintrag (09: keine gueltige Aufnahme)", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "alt" }] })

    await connector.queueProfileHomeMaintenance()

    expect(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "alt")]).toBeUndefined()
    expect(doc.profileMigration?.bestandAt).toBeTruthy()
  })

  it("setzt die Marke auch ohne eine einzige Mitgliedschaft — sonst liefe die Regel spaeter ueber Regel-4-Spaces", async () => {
    const { connector, doc } = fakeConnector({ spaces: [] })

    await connector.queueProfileHomeMaintenance()

    expect(doc.profileMigration?.bestandAt).toBeTruthy()
  })

  it("laeuft auf einem zweiten Geraet nicht erneut: die Marke konvergiert ueber das CRDT-Doc", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {} }
    const deviceA = fakeConnector({ doc, deviceId: "device-A", spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    await deviceA.connector.queueProfileHomeMaintenance()
    const markAfterA = doc.profileMigration?.bestandAt

    // Zweites Geraet derselben Person auf DEMSELBEN Doc: es sieht die Marke.
    const deviceB = fakeConnector({ doc, deviceId: "device-B", spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    await deviceB.connector.queueProfileHomeMaintenance()

    expect(doc.profileMigration?.bestandAt).toBe(markAfterA)
    expect(Object.keys(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "garten")]?.byDevice ?? {})).toEqual(["device-A"])
  })

  it("ueberschreibt eine vorhandene Marke nie", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {}, profileMigration: { bestandAt: "2026-01-01T00:00:00.000Z" } }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(doc.profileMigration?.bestandAt).toBe("2026-01-01T00:00:00.000Z")
  })
})
