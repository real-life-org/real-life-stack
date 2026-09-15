import { describe, expect, it, vi } from "vitest"
import { createObservable, hasProfile } from "@real-life-stack/data-interface"

import { WotConnector } from "../src/wot-connector.js"
import { byDeviceOf, flatRegistry, hasEntry } from "./helpers/registry-fixtures.js"
import { createFakeNamedRoots, type FakeNamedRoots } from "./helpers/named-roots.js"
import { PROFILE_MIGRATION_KEY, type MirrorRegistryRoot } from "../src/mirror/index.js"
import type { MirrorRegistryContribution, RlsSpaceDoc } from "../src/types.js"

/**
 * Spec 12 Regel 4 (`pending` bei neuem Space, Annahme = Freigabe), Regel 7
 * (Mitgliedschaftsverlust → `revoked`) und Regel 14 (Capability-Vertrag).
 */

const DID = "did:key:z6MkAnton"
const DEVICE = "device-A"

function contribution(partial: Partial<MirrorRegistryContribution>): MirrorRegistryContribution {
  return { statusSeq: 1, status: "accepted", seq: 0, tiebreak: "", updatedAt: "2026-09-01T00:00:00.000Z", ...partial }
}

function fakeConnector(options: {
  registry?: MirrorRegistryRoot
  /** Die Bestandsmarke aus Spec 12 Regel 5 — standardmaessig gesetzt. */
  bestand?: boolean
  spaces?: Array<{ id: string; appTag?: string; type?: string; admission?: { keyGeneration: number } }>
  homeCatchUpReported?: boolean
} = {}) {
  const doc: RlsSpaceDoc = { _type: "rls", items: {} }
  // Registry UND Bestandsmarke liegen in der benannten Wurzel `mirrorRegistry`
  // (Spec 09 §Ablage und Registry, Fassung rls#354); die Marke unter dem
  // reservierten Schluessel, damit Beitraege und Marke in EINER Transaktion
  // geschrieben werden koennen.
  const named = createFakeNamedRoots({
    mirrorRegistry: {
      ...(options.registry ?? {}),
      ...((options.bestand ?? true) ? { [PROFILE_MIGRATION_KEY]: { bestandAt: "2026-09-01T00:00:00.000Z" } } : {}),
    },
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
    leaveSpace: vi.fn(async () => {}),
    removeMember: vi.fn(async () => {}),
  }
  connector.docLogStore = { resolveConnectDeviceId: async () => DEVICE }
  connector.catchUpRegistry = { getOverview: () => ({ outstanding: [], syncing: false }) }
  connector.initialSync = { isFirstFillDone: () => true }
  connector.authExpectsRemoteData = true
  connector.profileObs = createObservable(null)
  connector.profileSharesObs = createObservable<Record<string, string>>({}, false)
  connector.currentUserObs = createObservable({ id: DID, displayName: "Anton" })
  connector.currentGroupObservable = createObservable(null)
  connector.memberObservables = new Map()
  connector.crossGroupIndex = { reindexGroup: vi.fn() }
  connector.notifyAllObservers = vi.fn()
  connector.closeCurrentHandle = vi.fn()
  connector.activityDirty = false
  connector.currentGroupId = null
  connector.profileHomeMaintenance = Promise.resolve()
  // Der Adapter hat den Catch-up des Home-Docs gemeldet (Spec 12 Regel 12) —
  // erst dann darf die pauschale Bestandsregel laufen.
  connector.homeCatchUpReported = (options.homeCatchUpReported ?? true)
    ? { generation: connector.runtimeGeneration, spaceId: connector.privateSpaceId }
    : null
  return { connector, doc, handle, named }
}

function entry(named: FakeNamedRoots, target: string): Record<string, MirrorRegistryContribution> {
  return byDeviceOf(named.roots.mirrorRegistry as MirrorRegistryRoot, DID, target)
}

function status(named: FakeNamedRoots, target: string): string | undefined {
  return entry(named, target)[DEVICE]?.status
}

describe("pending bei neuem Space — Spec 12 Regel 4", () => {
  it("ein neu erschienener Space wird pending, nicht accepted", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(status(named, "garten")).toBe("pending")
  })

  it("eine Wiederaufnahme setzt den Eintrag zurueck auf pending", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { garten: { [DEVICE]: contribution({ status: "accepted", admission: { keyGeneration: 2 } }) } }),
      spaces: [{ id: "garten", admission: { keyGeneration: 7 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(status(named, "garten")).toBe("pending")
    expect(entry(named, "garten")[DEVICE]?.admission)
      .toEqual({ keyGeneration: 7 })
  })

  it("auch der Anstieg von keiner Kennung auf eine Kennung ergibt pending", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { alt: { [DEVICE]: contribution({ status: "accepted" }) } }),
      spaces: [{ id: "alt", admission: { keyGeneration: 1 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(status(named, "alt")).toBe("pending")
  })

  it("ein Alt-Space ohne Kennung bekommt weiterhin keinen Eintrag", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "alt" }] })

    await connector.queueProfileHomeMaintenance()

    expect(hasEntry(named.roots.mirrorRegistry as MirrorRegistryRoot, DID, "alt")).toBe(false)
  })

  it("Bestands-Spaces werden NICHT pending — die Bestandsregel laeuft davor", async () => {
    const { connector, named } = fakeConnector({ bestand: false, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(status(named, "garten")).toBe("accepted")
  })
})

describe("Mitgliedschaftsverlust — Spec 12 Regel 7, Spec 09 Inv. 11", () => {
  it("ein verschwundener Ziel-Space widerruft den Eintrag mit der Kennung der Lesesicht", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { garten: { [DEVICE]: contribution({ status: "accepted", admission: { keyGeneration: 4 } }) } }),
      spaces: [] })

    await connector.queueProfileHomeMaintenance()

    expect(status(named, "garten")).toBe("revoked")
    expect(entry(named, "garten")[DEVICE]?.admission)
      .toEqual({ keyGeneration: 4 })
  })

  it("widerruft einen bereits widerrufenen Eintrag nicht erneut", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { garten: { [DEVICE]: contribution({ status: "revoked", statusSeq: 3, admission: { keyGeneration: 4 } }) } }),
      spaces: [] })

    await connector.queueProfileHomeMaintenance()

    expect(entry(named, "garten")[DEVICE]?.statusSeq).toBe(3)
  })

  it("Registry-Eintraege werden nie geloescht", async () => {
    const { connector, named } = fakeConnector({
      registry: flatRegistry(DID, { garten: { [DEVICE]: contribution({ status: "accepted", admission: { keyGeneration: 4 } }) } }),
      spaces: [] })

    await connector.queueProfileHomeMaintenance()

    expect(hasEntry(named.roots.mirrorRegistry as MirrorRegistryRoot, DID, "garten")).toBe(true)
  })
})

describe("ProfileCapable-Freigaben — Spec 12 Regel 14", () => {
  it("acceptSpace setzt den Eintrag auf accepted", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.acceptSpace("garten")

    expect(status(named, "garten")).toBe("accepted")
    expect(connector.observeProfileShares().current.garten).toBe("accepted")
  })

  it("shareProfile gibt nachtraeglich frei", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.shareProfile("garten")

    expect(status(named, "garten")).toBe("accepted")
  })

  it("eine Freigabe ohne gueltige Aufnahme-Kennung wird abgelehnt", async () => {
    const { connector } = fakeConnector({ spaces: [{ id: "alt" }] })

    await expect(connector.acceptSpace("alt")).rejects.toThrow(/Aufnahme-Kennung/)
  })

  it("revokeProfileShare widerruft, ohne den Space zu verlassen", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    await connector.acceptSpace("garten")

    await connector.revokeProfileShare("garten")

    expect(status(named, "garten")).toBe("revoked")
    expect(connector.replication.leaveSpace).not.toHaveBeenCalled()
  })

  it("declineSpace widerruft und verlaesst danach den Space", async () => {
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.declineSpace("garten")

    expect(status(named, "garten")).toBe("revoked")
    expect(connector.replication.leaveSpace).toHaveBeenCalledWith("garten")
  })

  it("declineSpace widerruft VOR dem Verlassen", async () => {
    const order: string[] = []
    const { connector, named } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    connector.replication.leaveSpace = vi.fn(async () => {
      order.push(`leave:${status(named, "garten")}`)
    })

    await connector.declineSpace("garten")

    expect(order).toEqual(["leave:revoked"])
  })

  it("hasProfile bleibt wahr — alle zwoelf Methoden sind da", () => {
    const { connector } = fakeConnector()

    expect(hasProfile(connector)).toBe(true)
  })
})

describe("Selbst erstellter Space — Spec 12 Regel 4", () => {
  it("wer einen Space selbst erstellt, gibt sein Profil dort mit dem Erstellen frei", async () => {
    const { connector, named } = fakeConnector()
    connector.replication.createSpace = vi.fn(async () => ({
      id: "neu", type: "shared", appTag: "rls", members: [DID], createdAt: "", admission: { keyGeneration: 0 },
    }))
    connector.spaceToGroup = (space: { id: string }) => ({ id: space.id, name: "Neu", members: [] })
    connector.setCurrentGroup = vi.fn()

    await connector.createGroup("Neu")

    expect(status(named, "neu")).toBe("accepted")
  })
})
