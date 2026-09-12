import { beforeEach, describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"

import { planStockGrants } from "../src/mirror/index.js"
import { byDeviceOf, flatRegistry, hasEntry } from "./helpers/registry-fixtures.js"
import type { MirrorRegistryContribution, RlsSpaceDoc } from "../src/types.js"

/**
 * Regressionen aus der Codex-Review-Runde 1 zu S3.
 *
 * Jeder Test haelt genau einen Befund fest: veraltete Entscheidungen ueber
 * `await`-Grenzen, die Sitzungsgrenze der Registry-Schreibpfade, die
 * Uebergangsregel gegen bereits getroffene Entscheidungen, den Write-through
 * aus dem kanonischen Item und die Bindung von `data.did` im gewoehnlichen
 * Item-Schreibpfad.
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
const DEVICE = "device-A"

function contribution(partial: Partial<MirrorRegistryContribution>): MirrorRegistryContribution {
  return { statusSeq: 1, status: "accepted", seq: 0, tiebreak: "", updatedAt: "2026-09-01T00:00:00.000Z", ...partial }
}

function fakeConnector(options: {
  doc?: RlsSpaceDoc
  spaces?: Array<{ id: string; appTag?: string; type?: string; admission?: { keyGeneration: number } }>
  resolveDeviceId?: () => Promise<string>
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
  connector.docLogStore = {
    resolveConnectDeviceId: options.resolveDeviceId ?? (async () => DEVICE),
  }
  connector.catchUpRegistry = { getOverview: () => ({ outstanding: [], syncing: false }) }
  connector.initialSync = { isFirstFillDone: () => true }
  connector.authExpectsRemoteData = true
  connector.profileObs = createObservable(null)
  connector.profileSharesObs = createObservable<Record<string, string>>({}, false)
  connector.currentUserObs = createObservable({ id: DID, displayName: "Anton" })
  connector.memberObservables = new Map()
  connector.crossGroupIndex = { reindexGroup: vi.fn() }
  connector.notifyAllObservers = vi.fn()
  connector.publishProfile = vi.fn(async () => {})
  connector.broadcastProfileUpdate = vi.fn(async () => {})
  connector.getCurrentUser = async () => connector.currentUserObs.current
  connector.activityDirty = false
  connector.profileHomeMaintenance = Promise.resolve()
  // Der Adapter hat den Catch-up des Home-Docs gemeldet (Spec 12 Regel 12) —
  // erst dann darf die pauschale Bestandsregel laufen.
  connector.homeCatchUpReported = (options.homeCatchUpReported ?? true)
    ? { generation: connector.runtimeGeneration, spaceId: connector.privateSpaceId }
    : null
  return { connector, doc, handle }
}

function byDevice(doc: RlsSpaceDoc, target: string) {
  return byDeviceOf(doc, DID, target)
}

beforeEach(() => {
  personalDoc.value = {}
})

describe("Befund 2 — die Uebergangsregel ueberschreibt keine getroffene Entscheidung", () => {
  it("laesst ein Ziel mit vorhandenem Registry-Eintrag aus, auch wenn die Marke fehlt", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls", items: {},
      mirrorRegistry: flatRegistry(DID, { garten: { "device-B": contribution({ status: "revoked", admission: { keyGeneration: 2 } }) } }),
    }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    await connector.queueProfileHomeMaintenance()

    // Der Widerruf des anderen Geraets bleibt der gefaltete Status: kein
    // pauschales `accepted` dieses Geraets daneben.
    expect(byDevice(doc, "garten")[DEVICE]).toBeUndefined()
    expect(connector.observeProfileShares().current.garten).toBe("revoked")
  })

  it("planStockGrants nimmt nur Ziele ohne Registry-Eintrag", () => {
    const spaces = [
      { id: "garten", type: "shared", appTag: "rls", members: [], createdAt: "", admission: { keyGeneration: 1 } },
      { id: "werkstatt", type: "shared", appTag: "rls", members: [], createdAt: "", admission: { keyGeneration: 1 } },
    ] as never

    expect(planStockGrants(spaces, "home-space", (id) => id === "garten")).toEqual(["werkstatt"])
  })

  it("schreibt Freigaben und Marke in EINER Transaktion", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {} }
    const { connector, handle } = fakeConnector({
      doc,
      spaces: [
        { id: "garten", admission: { keyGeneration: 1 } },
        { id: "werkstatt", admission: { keyGeneration: 1 } },
      ],
    })
    const original = handle.transact
    const calls: number[] = []
    handle.transact = (fn: (d: RlsSpaceDoc) => void) => { calls.push(1); original(fn) }

    connector.grantStockMemberships(handle, DID, DEVICE)

    // Zwei Freigaben und die Marke in genau einer Transaktion: es gibt keinen
    // Zustand, in dem ein Teil geschrieben ist und die Marke fehlt.
    expect(calls).toHaveLength(1)
    expect(byDevice(doc, "garten")[DEVICE].status).toBe("accepted")
    expect(byDevice(doc, "werkstatt")[DEVICE].status).toBe("accepted")
    expect(doc.profileMigration?.bestandAt).toBeTruthy()
  })
})

describe("Befund 3 — eine veraltete Abgleichsentscheidung schreibt nicht", () => {
  it("applyRegistryContribution schreibt nicht, wenn die Erwartung in der Transaktion nicht mehr gilt", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls", items: {},
      mirrorRegistry: flatRegistry(DID, { garten: { [DEVICE]: contribution({ status: "revoked", statusSeq: 4, admission: { keyGeneration: 2 } }) } }),
    }
    const { connector } = fakeConnector({ doc })

    const written = connector.applyRegistryContribution(doc, {
      did: DID,
      deviceId: DEVICE,
      targetSpaceId: "garten",
      status: "pending",
      currentAdmission: { keyGeneration: 2 },
      // Die Entscheidung entstand aus einer Lesesicht ohne Eintrag.
      expect: (view: unknown) => view === null,
    })

    expect(written).toBe(false)
    expect(byDevice(doc, "garten")[DEVICE]).toMatchObject({ status: "revoked", statusSeq: 4 })
  })

  it("verwirft den geplanten Statuswechsel, wenn er aus der Lesesicht nicht mehr folgt", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" } }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })

    // Erster Lauf: der neue Space wird pending.
    await connector.queueProfileHomeMaintenance()
    expect(byDevice(doc, "garten")[DEVICE].status).toBe("pending")

    // Die Person nimmt an; ein weiterer Abgleich darf das nicht zurueckdrehen.
    await connector.acceptSpace("garten")
    await connector.queueProfileHomeMaintenance()

    expect(byDevice(doc, "garten")[DEVICE].status).toBe("accepted")
  })

  it("dreht einen ausdruecklichen Widerruf nicht auf pending zurueck", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" } }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    await connector.acceptSpace("garten")

    await connector.revokeProfileShare("garten")
    await connector.queueProfileHomeMaintenance()

    expect(byDevice(doc, "garten")[DEVICE].status).toBe("revoked")
  })
})

describe("Befund 4 — Registry-Schreibpfade halten die Sitzungsgrenze", () => {
  it("schreibt nicht mehr, wenn die Identitaet waehrend des Aufloesens gewechselt hat", async () => {
    const { connector, doc } = fakeConnector({
      spaces: [{ id: "garten", admission: { keyGeneration: 2 } }],
      resolveDeviceId: async () => {
        connector.runtimeGeneration = 2
        connector.homeHandle = null
        connector.privateSpaceId = null
        return DEVICE
      },
    })

    await expect(connector.acceptSpace("garten")).rejects.toThrow(/beendeten Sitzung/)
    expect(hasEntry(doc, DID, "garten")).toBe(false)
  })
})

describe("Befund 7 — der gewoehnliche Item-Schreibpfad umgeht die Profilregeln nicht", () => {
  it("weist eine fremde data.did zurueck (Spec 12 Regel 1 und 3)", async () => {
    const { connector, doc, handle } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Anton" })

    expect(() => connector.applyItemUpdate(handle, DID, {
      data: { displayName: "Anton", did: "did:key:fremd" },
    })).toThrow(/data.did/)
    expect((doc.items[DID].data as Record<string, unknown>).did).toBe(DID)
  })

  it("weist data.did = null zurueck (Regel 8: kein Platzhalter, sondern ungueltig)", async () => {
    const { connector, doc, handle } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Anton" })

    expect(() => connector.applyItemUpdate(handle, DID, {
      data: { displayName: "Anton", did: null },
    })).toThrow(/nicht-leerer String/)
  })

  it("haelt Observable und Uebergangsprojektion nach, wenn das Profil-Item gewoehnlich geaendert wird", async () => {
    const { connector, handle } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Anton" })

    connector.applyItemUpdate(handle, DID, { data: { displayName: "Anton Neu", did: DID } })

    expect((await connector.getMyProfile())?.data.displayName).toBe("Anton Neu")
    expect(personalDoc.value.profile).toMatchObject({ name: "Anton Neu" })
  })

  it("laesst ein Platzhalter-Item ohne data.did unberuehrt (Regel 3)", async () => {
    const { connector, handle, doc } = fakeConnector()
    doc.items["platzhalter"] = {
      id: "platzhalter", type: "person", createdAt: "", createdBy: DID, data: { displayName: "Dritte Person" },
    } as never

    expect(() => connector.applyItemUpdate(handle, "platzhalter", {
      data: { displayName: "Dritte Person, neu" },
    })).not.toThrow()
  })
})

describe("Befund 8 — der Write-through kommt aus dem kanonischen Item", () => {
  it("richtet ein verspaetet eingetroffenes doc.profile am Item aus", async () => {
    const { connector } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Canonical" })

    // Wiederherstellung liefert einen alten Stand ins PersonalDoc ...
    personalDoc.value.profile = { did: DID, name: "Alter Name", bio: null, avatar: null }
    // ... der naechste Schreibvorgang nennt nur die Bio.
    await connector.updateMyProfile({ bio: "Baut Netze" })

    expect(personalDoc.value.profile).toMatchObject({ name: "Canonical", bio: "Baut Netze" })
  })

  it("raeumt ein geloeschtes Feld auch aus der Uebergangsprojektion", async () => {
    const { connector } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Anton", bio: "Baut Netze" })

    await connector.updateMyProfile({ bio: "" })

    expect(personalDoc.value.profile?.bio).toBeNull()
  })
})

describe("Befund 9 — ein nicht erfolgter Schreibvorgang meldet keinen Erfolg", () => {
  it("scheitert laut, statt Ortsfelder still zu verlieren", async () => {
    const { connector } = fakeConnector()
    connector.homeHandle = null
    connector.privateSpaceId = null
    connector.replication = null

    await expect(connector.updateMyProfile({
      displayName: "Anton",
      position: { type: "Point", coordinates: [9.5, 51.3] },
    })).rejects.toThrow(/persönliche Space/)
    expect(connector.publishProfile).not.toHaveBeenCalled()
  })
})

describe("Befund 6 — eine fremde Registry-Aenderung loest den Abgleich aus", () => {
  it("widerruft einen fremden accepted-Beitrag fuer einen nicht mehr sichtbaren Space", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {}, profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" } }
    const { connector } = fakeConnector({ doc, spaces: [] })

    // Ein anderes Geraet traegt nachtraeglich eine Freigabe ein.
    doc.mirrorRegistry = {
      ...flatRegistry(DID, { garten: { "device-B": contribution({ status: "accepted", admission: { keyGeneration: 3 } }) } }),
    }
    connector.onHomeDocChanged()
    await connector.profileHomeMaintenance

    expect(byDevice(doc, "garten")[DEVICE]).toMatchObject({ status: "revoked", admission: { keyGeneration: 3 } })
    expect(connector.observeProfileShares().current.garten).toBe("revoked")
  })
})

// --- Codex-Review, Runde 2 ---

describe("R2-2 — die pauschale Bestandsregel verlangt den beobachteten Catch-up des Home-Docs", () => {
  it("gibt nichts pauschal frei, solange der Adapter fuer das Home-Doc nichts gemeldet hat", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {} }
    const { connector } = fakeConnector({
      doc,
      homeCatchUpReported: false,
      spaces: [{ id: "garten", admission: { keyGeneration: 2 } }],
    })

    await connector.queueProfileHomeMaintenance()

    // Fail-closed: der Space wird ausstehend, nicht pauschal freigegeben — ein
    // Geraet ohne Nachweis kann die Marke eines anderen Geraets verpasst haben.
    expect(byDevice(doc, "garten")[DEVICE].status).toBe("pending")
    expect(doc.profileMigration?.bestandAt).toBeUndefined()
  })

  it("eine frisch erzeugte Identitaet erwartet nichts und darf sofort laufen", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {} }
    const { connector } = fakeConnector({
      doc,
      homeCatchUpReported: false,
      spaces: [{ id: "garten", admission: { keyGeneration: 0 } }],
    })
    connector.authExpectsRemoteData = false

    await connector.queueProfileHomeMaintenance()

    expect(byDevice(doc, "garten")[DEVICE].status).toBe("accepted")
  })

  it("noteHomeCatchUp merkt sich nur die Meldung des Home-Docs und nimmt sie in der Sitzung nie zurueck", () => {
    const { connector } = fakeConnector({ homeCatchUpReported: false })

    connector.noteHomeCatchUp([{ docId: "garten" }])
    expect(connector.hasHomeCatchUpReport()).toBe(false)

    connector.noteHomeCatchUp([{ docId: "home-space" }])
    expect(connector.hasHomeCatchUpReport()).toBe(true)

    connector.noteHomeCatchUp([])
    expect(connector.hasHomeCatchUpReport()).toBe(true)
  })

  it("der Nachweis gilt nur fuer DIESE Sitzung und DIESES Home", () => {
    const { connector } = fakeConnector({ homeCatchUpReported: false })
    connector.noteHomeCatchUp([{ docId: "home-space" }])
    expect(connector.hasHomeCatchUpReport()).toBe(true)

    // Re-Login: neue Generation, der alte Nachweis sagt nichts ueber sie.
    connector.runtimeGeneration = 2
    expect(connector.hasHomeCatchUpReport()).toBe(false)

    connector.runtimeGeneration = 1
    // Anderer persoenlicher Space (Identitaetswechsel, Reconcile).
    connector.privateSpaceId = "anderes-home"
    expect(connector.hasHomeCatchUpReport()).toBe(false)
  })

  it("gibt nach einem Re-Login nichts pauschal frei, bevor das Home gemeldet hat", async () => {
    const doc: RlsSpaceDoc = { _type: "rls", items: {} }
    const { connector } = fakeConnector({ doc, spaces: [{ id: "garten", admission: { keyGeneration: 2 } }] })
    connector.runtimeGeneration = 2

    await connector.queueProfileHomeMaintenance()

    expect(byDevice(doc, "garten")[DEVICE].status).toBe("pending")
    expect(doc.profileMigration?.bestandAt).toBeUndefined()
  })
})

describe("R2-3 — die Profil-Identitaet gilt auch im generischen Item-Schreibpfad", () => {
  it("ein person-Item mit eigener data.did bekommt die DID als id, keine zufaellige", async () => {
    const { connector, doc, handle } = fakeConnector()

    const created = connector.createItemOnHandle(handle, {
      type: "person",
      data: { displayName: "Anton", did: DID },
    }, "home-space")

    expect(created.id).toBe(DID)
    expect(Object.keys(doc.items)).toEqual([DID])
  })

  it("ein zweiter Anlageversuch liefert das vorhandene Profil statt eines zweiten", async () => {
    const { connector, doc, handle } = fakeConnector()
    connector.createItemOnHandle(handle, { type: "person", data: { displayName: "Anton", did: DID } }, "home-space")

    connector.createItemOnHandle(handle, { type: "person", data: { displayName: "Zweites", did: DID } }, "home-space")

    expect(Object.keys(doc.items)).toEqual([DID])
    expect((doc.items[DID].data as Record<string, unknown>).displayName).toBe("Anton")
  })

  it("ein gewoehnliches Update ohne did loescht den Profil-Marker nicht", async () => {
    const { connector, doc, handle } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Anton" })

    connector.applyItemUpdate(handle, DID, { data: { displayName: "Anton Neu" } })

    expect((doc.items[DID].data as Record<string, unknown>).did).toBe(DID)
  })
})

describe("R2-4 — der Profil-Schreibpfad haelt die Sitzungsgrenze", () => {
  it("scheitert laut und schreibt nichts, wenn die Sitzung waehrend des Oeffnens endet", async () => {
    const { connector, doc, handle } = fakeConnector()
    connector.homeHandle = null
    connector.replication.openSpace = vi.fn(async () => {
      // Identitaetswechsel waehrend des Oeffnens.
      connector.runtimeGeneration = 2
      return handle
    })

    await expect(connector.updateMyProfile({ displayName: "Anton" }))
      .rejects.toThrow(/persönliche Space|beendeten Sitzung/)
    expect(doc.items[DID]).toBeUndefined()
    expect(connector.publishProfile).not.toHaveBeenCalled()
  })

  it("scheitert laut, wenn der gehaltene Home-Handle waehrend des Oeffnens ausgetauscht wurde", async () => {
    const { connector, doc, handle } = fakeConnector()
    const original = connector.ensureHomeHandle.bind(connector)
    connector.ensureHomeHandle = async () => {
      const result = await original()
      // Ein Reconcile hat inzwischen einen anderen Handle installiert.
      connector.homeHandle = { ...handle, id: "home-space" }
      return result
    }

    await expect(connector.updateMyProfile({ displayName: "Anton" }))
      .rejects.toThrow(/beendeten Sitzung/)
    expect(doc.items[DID]).toBeUndefined()
  })
})

describe("R2-5 — ein spaet eintreffendes doc.profile wird nicht publiziert", () => {
  it("richtet die Uebergangsprojektion am Item aus, statt den alten Stand zu veroeffentlichen", async () => {
    const { connector } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Canonical", bio: "Baut Netze" })

    // Wiederherstellung schiebt einen alten Stand ins PersonalDoc.
    personalDoc.value.profile = { did: DID, name: "Alter Name", bio: "Alte Bio", avatar: null }
    connector.lastObservedProfileKey = ""
    connector.handlePersonalDocProfileChange()

    expect(personalDoc.value.profile).toMatchObject({ name: "Canonical", bio: "Baut Netze" })
  })

  it("laeuft dabei nicht in eine Schleife: inhaltsgleich ist ein No-op", async () => {
    const { connector } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Canonical" })
    const before = personalDoc.value.profile?.updatedAt

    connector.writeProfileThroughToPersonalDoc(await connector.getMyProfile())

    expect(personalDoc.value.profile?.updatedAt).toBe(before)
  })
})

describe("R2-6 — ein abgelehnter Schreibversuch hinterlaesst keinen Eintrag", () => {
  it("schreibt erst nach der Pruefung", async () => {
    const { connector, doc } = fakeConnector({ spaces: [{ id: "alt" }] })

    await expect(connector.acceptSpace("alt")).rejects.toThrow(/Aufnahme-Kennung/)

    expect(hasEntry(doc, DID, "alt")).toBe(false)
  })

  // Der zweite Test dieser Runde ("ein leerer Eintrag blockiert die
  // Bestandsfreigabe nicht") ist mit der flachen Ablage gegenstandslos: es gibt
  // keine Eltern-Map mehr, die leer zurueckbleiben koennte — ein Schluessel
  // existiert nur zusammen mit dem Beitrag, den er traegt (R2-1).
})

// --- Codex-Review, Runde 3 ---

describe("R3-2 — id = createdBy = data.did gilt ohne Schlupfloch (Spec 12 Regel 1)", () => {
  it("weist eine vorgegebene Id zurueck, die nicht die DID ist", async () => {
    const { connector, doc, handle } = fakeConnector()

    expect(() => connector.createItemOnHandle(handle, {
      id: "zweites-profil",
      type: "person",
      data: { displayName: "Anton", did: DID },
    }, "home-space")).toThrow(/Item-Id/)
    expect(doc.items["zweites-profil"]).toBeUndefined()
  })

  it("erlaubt nicht, einem vorhandenen Platzhalter nachtraeglich die eigene DID zu geben", async () => {
    const { connector, doc, handle } = fakeConnector()
    doc.items["platzhalter"] = {
      id: "platzhalter", type: "person", createdAt: "", createdBy: DID, data: { displayName: "Dritte Person" },
    } as never

    expect(() => connector.applyItemUpdate(handle, "platzhalter", {
      data: { displayName: "Dritte Person", did: DID },
    })).toThrow(/Item-Id/)
    expect((doc.items["platzhalter"].data as Record<string, unknown>).did).toBeUndefined()
  })

  it("laesst die Anlage mit der DID als Id durch", async () => {
    const { connector, doc, handle } = fakeConnector()

    connector.createItemOnHandle(handle, { id: DID, type: "person", data: { displayName: "Anton", did: DID } }, "home-space")

    expect(doc.items[DID]).toBeDefined()
  })
})

describe("R3-3 — das Item gewinnt auch, wenn es nach doc.profile eintrifft", () => {
  it("richtet die Uebergangsprojektion nach, sobald das Home-Doc sich aendert", async () => {
    const { connector, doc } = fakeConnector()
    await connector.updateMyProfile({ displayName: "Alt" })

    // Ein fremdes PersonalDoc trifft zuerst ein und wird am alten Item ausgerichtet.
    personalDoc.value.profile = { did: DID, name: "Zwischenstand", bio: null, avatar: null }
    connector.lastObservedProfileKey = ""
    connector.handlePersonalDocProfileChange()
    expect(personalDoc.value.profile).toMatchObject({ name: "Alt" })

    // Danach kommt das Item des anderen Geraets nach.
    ;(doc.items[DID].data as Record<string, unknown>).displayName = "Neu"
    connector.onHomeDocChanged()

    expect(personalDoc.value.profile).toMatchObject({ name: "Neu" })
    expect((await connector.getMyProfile())?.data.displayName).toBe("Neu")
  })
})

// --- Codex-Review, Runde 4 ---

describe("R4-1 — auch der Startfall richtet die Uebergangsprojektion am Item aus", () => {
  it("korrigiert ein aelteres doc.profile schon beim ersten Oeffnen des Home", async () => {
    const doc: RlsSpaceDoc = {
      _type: "rls",
      items: {
        [DID]: {
          id: DID, type: "person", createdAt: "2026-01-01T00:00:00.000Z", createdBy: DID,
          data: { displayName: "Canonical", did: DID },
        } as never,
      },
      profileMigration: { bestandAt: "2026-09-01T00:00:00.000Z" },
    }
    // Das Item ist beim Oeffnen schon da; es gibt also kein Remote-Update.
    personalDoc.value.profile = { did: DID, name: "Old projection", bio: null, avatar: null }
    const { connector } = fakeConnector({ doc })

    await connector.queueProfileHomeMaintenance()

    expect((await connector.getMyProfile())?.data.displayName).toBe("Canonical")
    expect(personalDoc.value.profile).toMatchObject({ name: "Canonical" })
  })
})
