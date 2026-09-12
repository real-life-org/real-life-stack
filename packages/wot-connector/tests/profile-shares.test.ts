import { describe, expect, it, vi } from "vitest"
import { createObservable, hasProfile } from "@real-life-stack/data-interface"

import { WotConnector } from "../src/wot-connector.js"
import { mirrorRegistryKey } from "../src/mirror/index.js"
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
  doc?: RlsSpaceDoc
  spaces?: Array<{ id: string; appTag?: string; type?: string; admission?: { keyGeneration: number } }>
} = {}) {
  const doc: RlsSpaceDoc = options.doc ?? { _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" } }
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
  return { connector, doc, handle }
}

function status(doc: RlsSpaceDoc, target: string): string | undefined {
  return doc.mirrorRegistry?.[mirrorRegistryKey(DID, target)]?.byDevice?.[DEVICE]?.status
}

describe("pending bei neuem Space — Spec 12 Regel 4", () => {
  it("ein neu erschienener Space wird pending, nicht accepted", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(status(doc, "garten")).toBe("pending")
  })

  it("eine Wiederaufnahme setzt den Eintrag zurueck auf pending", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" },
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: { [DEVICE]: contribution({ status: "accepted", admission: { keyGeneration: 2 } }) },
        },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 7 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(status(doc, "garten")).toBe("pending")
    expect(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "garten")]?.byDevice?.[DEVICE]?.admission)
      .toEqual({ keyGeneration: 7 })
  })

  it("auch der Anstieg von keiner Kennung auf eine Kennung ergibt pending", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" },
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "alt")]: { byDevice: { [DEVICE]: contribution({ status: "accepted" }) } },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "alt", admission: { keyGeneration: 1 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(status(doc, "alt")).toBe("pending")
  })

  it("ein Alt-Space ohne Kennung bekommt weiterhin keinen Eintrag", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "alt" }] })

    await connector.queueProfileHomeMaintenance()

    expect(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "alt")]).toBeUndefined()
  })

  it("Bestands-Spaces werden NICHT pending — die Bestandsregel laeuft davor", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {} }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.queueProfileHomeMaintenance()

    expect(status(doc, "garten")).toBe("accepted")
  })
})

describe("Mitgliedschaftsverlust — Spec 12 Regel 7, Spec 09 Inv. 11", () => {
  it("ein verschwundener Ziel-Space widerruft den Eintrag mit der Kennung der Lesesicht", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" },
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: { [DEVICE]: contribution({ status: "accepted", admission: { keyGeneration: 4 } }) },
        },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [] })

    await connector.queueProfileHomeMaintenance()

    expect(status(doc, "garten")).toBe("revoked")
    expect(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "garten")]?.byDevice?.[DEVICE]?.admission)
      .toEqual({ keyGeneration: 4 })
  })

  it("widerruft einen bereits widerrufenen Eintrag nicht erneut", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" },
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: { [DEVICE]: contribution({ status: "revoked", statusSeq: 3, admission: { keyGeneration: 4 } }) },
        },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [] })

    await connector.queueProfileHomeMaintenance()

    expect(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "garten")]?.byDevice?.[DEVICE]?.statusSeq).toBe(3)
  })

  it("Registry-Eintraege werden nie geloescht", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" },
      mirrorRegistry: {
        [mirrorRegistryKey(DID, "garten")]: {
          byDevice: { [DEVICE]: contribution({ status: "accepted", admission: { keyGeneration: 4 } }) },
        },
      },
    }
    const { connector } = fakeConnector({ doc, spaces: [] })

    await connector.queueProfileHomeMaintenance()

    expect(doc.mirrorRegistry?.[mirrorRegistryKey(DID, "garten")]).toBeDefined()
  })
})

describe("ProfileCapable-Freigaben — Spec 12 Regel 14", () => {
  it("acceptSpace setzt den Eintrag auf accepted", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.acceptSpace("garten")

    expect(status(doc, "garten")).toBe("accepted")
    expect(connector.observeProfileShares().current.garten).toBe("accepted")
  })

  it("shareProfile gibt nachtraeglich frei", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.shareProfile("garten")

    expect(status(doc, "garten")).toBe("accepted")
  })

  it("eine Freigabe ohne gueltige Aufnahme-Kennung wird abgelehnt", async () => {
    const { connector } = fakeConnector({ spaces: [{ id: "alt" }] })

    await expect(connector.acceptSpace("alt")).rejects.toThrow(/Aufnahme-Kennung/)
  })

  it("revokeProfileShare widerruft, ohne den Space zu verlassen", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    await connector.acceptSpace("garten")

    await connector.revokeProfileShare("garten")

    expect(status(doc, "garten")).toBe("revoked")
    expect(connector.replication.leaveSpace).not.toHaveBeenCalled()
  })

  it("declineSpace widerruft und verlaesst danach den Space", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.declineSpace("garten")

    expect(status(doc, "garten")).toBe("revoked")
    expect(connector.replication.leaveSpace).toHaveBeenCalledWith("garten")
  })

  it("declineSpace widerruft VOR dem Verlassen", async () => {
    const order: string[] = []
    const { connector, doc } = fakeConnector({ spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    connector.replication.leaveSpace = vi.fn(async () => {
      order.push(`leave:${status(doc, "garten")}`)
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
    const { connector, doc } = fakeConnector()
    connector.replication.createSpace = vi.fn(async () => ({
      id: "neu", type: "shared", appTag: "rls", members: [DID], createdAt: "", admission: { keyGeneration: 0 },
    }))
    connector.spaceToGroup = (space: { id: string }) => ({ id: space.id, name: "Neu", members: [] })
    connector.setCurrentGroup = vi.fn()

    await connector.createGroup("Neu")

    expect(status(doc, "neu")).toBe("accepted")
  })
})
