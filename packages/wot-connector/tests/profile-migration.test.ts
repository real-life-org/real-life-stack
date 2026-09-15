import { beforeEach, describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"

import { byDeviceOf, hasEntry } from "./helpers/registry-fixtures.js"
import { createFakeNamedRoots, type FakeNamedRoots } from "./helpers/named-roots.js"
import { PROFILE_MIGRATION_KEY, profileMigrationMark, type MirrorRegistryRoot } from "../src/mirror/index.js"
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
  /** Geteilte benannte Wurzeln, wenn zwei Geraete auf DEMSELBEN Home arbeiten. */
  named?: FakeNamedRoots
  bestandAt?: string
  spaces?: Array<{ id: string; appTag?: string; type?: string; admission?: { keyGeneration: number } }>
  outstanding?: Array<{ docId: string }>
  firstFillDone?: boolean
  expectRemoteData?: boolean
  deviceId?: string
  homeCatchUpReported?: boolean
} = {}) {
  const doc: RlsSpaceDoc = options.doc ?? { _type: "rls", items: {} }
  // Registry und Bestandsmarke liegen in der benannten Wurzel `mirrorRegistry`
  // (Spec 09 §Ablage und Registry, Fassung rls#354).
  const named = options.named ?? createFakeNamedRoots({
    mirrorRegistry: options.bestandAt ? { [PROFILE_MIGRATION_KEY]: { bestandAt: options.bestandAt } } : {},
  })
  const handle = {
    id: "home-space",
    getDoc: () => doc,
    transact: (fn: (d: RlsSpaceDoc) => void) => { fn(doc) },
    onRemoteUpdate: () => () => {},
    close: () => {},
    getRoot: named.getRoot,
    transactRoot: named.transactRoot,
    transactRootDurable: named.transactRootDurable,
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
  connector.homeCatchUpReported = (options.homeCatchUpReported ?? true)
    ? { generation: connector.runtimeGeneration, spaceId: connector.privateSpaceId }
    : null
  return { connector, doc, handle, named }
}

/** Die Bestandsmarke aus der Wurzel — sie steht NICHT im Doc-Baum unter `data`. */
function mark(named: FakeNamedRoots): string | undefined {
  return profileMigrationMark(named.roots.mirrorRegistry as MirrorRegistryRoot)?.bestandAt
}

function registryRootOf(named: FakeNamedRoots): MirrorRegistryRoot {
  return named.roots.mirrorRegistry as MirrorRegistryRoot
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
    const { connector, doc, named } = fakeConnector({ outstanding: [{ docId: "home-space" }] })

    await connector.queueProfileHomeMaintenance()

    expect(doc.items[DID]).toBeUndefined()
  })
})

describe("Migration — Spec 12 Regel 12", () => {
  it("legt das Item aus doc.profile an, wenn es fehlt", async () => {
    personalDoc.value.profile = { did: DID, name: "Anton", bio: "Baut Netze", avatar: "a.png" }
    const { connector, doc, named } = fakeConnector()

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
    const { connector, doc, named } = fakeConnector()

    await connector.queueProfileHomeMaintenance()

    expect(doc.items[DID]).toBeUndefined()
  })

  it("ein spaet eintreffendes doc.profile aendert das migrierte Item nicht mehr", async () => {
    personalDoc.value.profile = { did: DID, name: "Anton" }
    const { connector, doc, named } = fakeConnector()
    await connector.queueProfileHomeMaintenance()

    personalDoc.value.profile = { did: DID, name: "Wiederhergestellt" }
    await connector.queueProfileHomeMaintenance()

    expect((doc.items[DID].data as Record<string, unknown>).displayName).toBe("Anton")
  })

  it("migriert ein spaet eintreffendes doc.profile, solange das Item noch fehlt", async () => {
    const { connector, doc, named } = fakeConnector()
    await connector.queueProfileHomeMaintenance()
    expect(doc.items[DID]).toBeUndefined()

    personalDoc.value.profile = { did: DID, name: "Spaet" }
    await connector.queueProfileHomeMaintenance()

    expect((doc.items[DID].data as Record<string, unknown>).displayName).toBe("Spaet")
  })
})

describe("Bestandsregel — Spec 12 Regel 5", () => {
  it("gibt jede bestehende Mitgliedschaft mit gueltiger Kennung frei und setzt die Marke", async () => {
    const { connector, doc, named } = fakeConnector({
      spaces: [
        { id: "home-space", appTag: "rls-private", admission: { keyGeneration: 0 } },
        { id: "garten", admission: { keyGeneration: 2 } },
        { id: "werkstatt", admission: { keyGeneration: 5 } },
      ],
    })

    await connector.queueProfileHomeMaintenance()

    const byDevice = (target: string) => byDeviceOf(registryRootOf(named), DID, target)
    expect(byDevice("garten")["device-A"]).toMatchObject({ status: "accepted", admission: { keyGeneration: 2 } })
    expect(byDevice("werkstatt")["device-A"]).toMatchObject({ status: "accepted", admission: { keyGeneration: 5 } })
    expect(hasEntry(registryRootOf(named), DID, "home-space")).toBe(false)
    expect(mark(named)).toBeTruthy()
  })

  it("laesst Alt-Spaces ohne Aufnahme-Kennung ohne Eintrag (09: keine gueltige Aufnahme)", async () => {
    const { connector, doc, named } = fakeConnector({ spaces: [{ id: "alt" }] })

    await connector.queueProfileHomeMaintenance()

    expect(hasEntry(registryRootOf(named), DID, "alt")).toBe(false)
    expect(mark(named)).toBeTruthy()
  })

  it("setzt die Marke auch ohne eine einzige Mitgliedschaft — sonst liefe die Regel spaeter ueber Regel-4-Spaces", async () => {
    const { connector, doc, named } = fakeConnector({ spaces: [] })

    await connector.queueProfileHomeMaintenance()

    expect(mark(named)).toBeTruthy()
  })

  it("laeuft auf einem zweiten Geraet nicht erneut: die Marke konvergiert ueber das CRDT-Doc", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {} }
    const shared = createFakeNamedRoots()
    const deviceA = fakeConnector({ doc, named: shared, deviceId: "device-A", spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    await deviceA.connector.queueProfileHomeMaintenance()
    const markAfterA = mark(shared)

    // Zweites Geraet derselben Person auf DEMSELBEN Doc: es sieht die Marke.
    const deviceB = fakeConnector({ doc, named: shared, deviceId: "device-B", spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    await deviceB.connector.queueProfileHomeMaintenance()

    expect(mark(shared)).toBe(markAfterA)
    expect(Object.keys(byDeviceOf(registryRootOf(shared), DID, "garten"))).toEqual(["device-A"])
  })

  it("ueberschreibt eine vorhandene Marke nie", async () => {
    const { connector, named } = fakeConnector({ bestandAt: "2026-01-01T00:00:00.000Z", spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(mark(named)).toBe("2026-01-01T00:00:00.000Z")
  })
})
