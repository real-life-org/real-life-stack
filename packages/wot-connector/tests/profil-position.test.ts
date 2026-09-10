import { beforeEach, describe, expect, it, vi } from "vitest"
import { createObservable } from "@real-life-stack/data-interface"
import { WotConnector } from "../src/wot-connector.js"

/**
 * Position im eigenen Profil (Spec 04 §Profile, Regel 4).
 *
 * Besitzer des eigenen Profils ist das Persoenliche Dokument. Die Position
 * liegt dort als `positionJson` — dieselbe Form wie offers/needs, additiv
 * ergaenzt: ein Dokument ohne das Feld ist ein gueltiges Profil ohne
 * Position, es wird nichts migriert.
 *
 * Das Profilverzeichnis kennt das Feld NICHT: wot-core filtert beim Signieren
 * auf name/bio/avatar/offers/needs/protocols. Die eigene Position steht also
 * im eigenen person-Item, reist aber (noch) nicht zu anderen.
 */

const doc = vi.hoisted(() => ({ current: { profile: null } as any }))

vi.mock("@real-life/adapter-yjs", () => ({
  YjsReplicationAdapter: vi.fn(),
  YjsStorageAdapter: class {},
  CatchUpRegistry: class {},
  getYjsPersonalDoc: vi.fn(() => doc.current),
  resetYjsPersonalDoc: vi.fn(),
  onYjsPersonalDocChange: vi.fn(() => () => {}),
  changeYjsPersonalDoc: vi.fn((fn: (next: any) => void) => fn(doc.current)),
  flushYjsPersonalDoc: vi.fn(),
}))

const DID = "did:key:z6MkAnton"
const kassel = { type: "Point", coordinates: [9.4797, 51.3127] }

/** Ein Connector mit genau den Teilen, die der Profil-Pfad anfasst. */
function connector(): WotConnector {
  const value = Object.create(WotConnector.prototype) as any
  value.identity = { getDid: () => DID }
  value.profileObs = createObservable<unknown>(null)
  value.currentUserObs = createObservable<unknown>(null)
  value.syncPendingObs = createObservable(false)
  value.discovery = { publishProfile: vi.fn(async () => {}), resolveProfile: async () => null }
  value.lastPublishedProfileFingerprint = null
  value.profilePublishInFlight = new Map()
  value.personProjectionStore = { invalidateProfile: vi.fn() }
  value.broadcastProfileUpdate = vi.fn(async () => {})
  value.getCurrentUser = async () => ({ id: DID, displayName: "Anton" })
  return value as WotConnector
}

beforeEach(() => {
  doc.current = { profile: null }
})

describe("WotConnector — Position im Persoenlichen Dokument", () => {
  it("schreibt sie als positionJson, neben den Ortsnamen", async () => {
    const c = connector() as any
    await c.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    expect(JSON.parse(doc.current.profile.positionJson)).toEqual(kassel)
    expect(doc.current.profile.locationName).toBe("Kassel")
  })

  it("traegt sie ins eigene person-Item — das ist die Projektion", async () => {
    const c = connector() as any
    await c.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    const eigenes = await c.getMyProfile()
    expect(eigenes.type).toBe("person")
    expect(eigenes.data).toMatchObject({ did: DID, position: kassel, locationName: "Kassel" })
  })

  it("stoesst die Projektion im Item-Strom an", async () => {
    const c = connector() as any
    await c.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    expect(c.personProjectionStore.invalidateProfile).toHaveBeenCalledWith(DID)
  })

  it("loescht sie, wenn das Ortsfeld geleert wird — opt-in heisst auch opt-out", async () => {
    const c = connector() as any
    await c.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    await c.updateMyProfile({ name: "Anton", position: undefined, locationName: undefined })
    expect(doc.current.profile.positionJson).toBeNull()
    expect(doc.current.profile.locationName).toBeNull()
    expect((await c.getMyProfile()).data.position).toBeUndefined()
  })

  it("laesst sie in Ruhe, wenn der Aufrufer sie gar nicht nennt", async () => {
    const c = connector() as any
    await c.updateMyProfile({ name: "Anton", position: kassel, locationName: "Kassel" })
    await c.updateMyProfile({ bio: "Baut am Brunnen." })
    expect(JSON.parse(doc.current.profile.positionJson)).toEqual(kassel)
    expect(doc.current.profile.locationName).toBe("Kassel")
  })

  it("bleibt bei einem Profil ohne die Felder einfach ohne Position", async () => {
    doc.current = { profile: { did: DID, name: "Anton", bio: null, avatar: null, createdAt: "2026-01-01T00:00:00.000Z" } }
    const c = connector() as any
    const profil = await c.loadPersonProfile(DID)
    expect(profil.position).toBeUndefined()
    expect(profil.locationName).toBeUndefined()
  })

  it("uebersteht kaputtes JSON, statt den Profil-Strom anzuhalten", async () => {
    doc.current = { profile: { did: DID, name: "Anton", positionJson: "{kaputt", locationName: "Kassel" } }
    const c = connector() as any
    const profil = await c.loadPersonProfile(DID)
    expect(profil.position).toBeUndefined()
    expect(profil.locationName).toBe("Kassel")
  })
})
