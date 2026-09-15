import { describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"

import { WotConnector } from "../src/wot-connector.js"
import type { RlsSpaceDoc } from "../src/types.js"

/**
 * Spec 09 §Ablage und Registry (Fassung rls#354): „Ohne die Capability
 * (`hasNamedRoots` false) schreibt der Connector keine Registry und meldet
 * Freigaben als nicht verfuegbar; er weicht NICHT auf `data` aus."
 *
 * Der Ausweichweg waere genau der Fehler, der die Wurzeln noetig gemacht hat
 * (rls#353): eine verschachtelte Map unter `data`, die zwei Geraete nebenlaeufig
 * anlegen, ist ein Register — ein Widerruf kann dabei verschwinden. Lieber gar
 * keine Freigaben als Freigaben, deren Widerruf sich stillschweigend verliert.
 *
 * Die Attrappe hier hat `getRoot`/`transactRoot`/`transactRootDurable` NICHT —
 * so sieht ein Automerge-Handle oder ein alter Adapter aus.
 */

const DID = "did:key:z6MkAnton"

function connectorWithoutNamedRoots(options: {
  spaces?: Array<{ id: string; admission?: { keyGeneration: number } }>
} = {}) {
  const doc: RlsSpaceDoc = { _type: "rls", items: {} }
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
  }
  connector.docLogStore = { resolveConnectDeviceId: async () => "device-A" }
  connector.catchUpRegistry = { getOverview: () => ({ outstanding: [], syncing: false }) }
  connector.initialSync = { isFirstFillDone: () => true }
  connector.authExpectsRemoteData = true
  connector.profileObs = createObservable(null)
  connector.profileSharesObs = createObservable<Record<string, string>>({}, false)
  connector.currentUserObs = createObservable({ id: DID, displayName: "Anton" })
  connector.memberObservables = new Map()
  connector.crossGroupIndex = { reindexGroup: vi.fn() }
  connector.notifyAllObservers = vi.fn()
  connector.activityDirty = false
  connector.profileHomeMaintenance = Promise.resolve()
  connector.homeCatchUpReported = { generation: 1, spaceId: "home-space" }
  return { connector, doc, handle }
}

describe("fail-closed ohne benannte Wurzeln — Spec 09 §Ablage und Registry", () => {
  it("meldet keine Freigaben, aber geladen", () => {
    const { connector } = connectorWithoutNamedRoots()

    connector.refreshProfileShares()

    expect(connector.observeProfileShares().current).toEqual({})
    // Geladen: eine Annahme-Flaeche darf nicht ewig auf ein Signal warten, das
    // mit diesem Adapter nie kommt.
    expect(connector.observeProfileShares().loaded).toBe(true)
  })

  it.each([
    ["acceptSpace"],
    ["shareProfile"],
    ["declineSpace"],
    ["revokeProfileShare"],
  ])("%s wirft mit klarer Meldung", async (method) => {
    const { connector } = connectorWithoutNamedRoots({ spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })

    await expect(connector[method]("garten")).rejects.toThrow(/ohne benannte Wurzeln/)
  })

  it("declineSpace verlaesst den Space nicht, wenn der Widerruf gar nicht geschrieben werden kann", async () => {
    const { connector } = connectorWithoutNamedRoots({ spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })

    await expect(connector.declineSpace("garten")).rejects.toThrow(/ohne benannte Wurzeln/)

    // Sonst waere das Profil im Ziel-Space zurueckgeblieben, ohne dass ein
    // Widerruf je geschrieben wurde (Spec 12 Regel 6: erst widerrufen).
    expect(connector.replication.leaveSpace).not.toHaveBeenCalled()
  })

  it("die Pflege laeuft ohne Bestandsregel, ohne Abgleich und ohne Marke durch", async () => {
    const { connector, doc } = connectorWithoutNamedRoots({ spaces: [{ id: "garten", admission: { keyGeneration: 1 } }] })

    await connector.queueProfileHomeMaintenance()

    // Kein Ausweichen auf `data`: weder Registry noch Marke stehen im Doc-Baum.
    expect((doc as Record<string, unknown>).mirrorRegistry).toBeUndefined()
    expect((doc as Record<string, unknown>).profileMigration).toBeUndefined()
    expect(connector.observeProfileShares().current).toEqual({})
  })

  it("das Profil-Item selbst wird trotzdem gepflegt — es liegt unter data, nicht in einer Wurzel", async () => {
    const { connector } = connectorWithoutNamedRoots()
    const migrate = vi.fn()
    connector.migrateProfileItem = migrate
    connector.writeProfileThroughToPersonalDoc = vi.fn()

    await connector.queueProfileHomeMaintenance()

    // Nur das TEILEN faellt mit diesem Adapter aus, nicht die Home-Quelle
    // (Spec 12 Regel 12).
    expect(migrate).toHaveBeenCalledTimes(1)
  })
})
