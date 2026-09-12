import { describe, expect, it } from "vitest"

import {
  maxAdmission,
  mergeProfileData,
  planMembershipTransition,
  planStockGrants,
  profileItemInput,
  supersedesOf,
} from "../src/mirror/profile-home.js"
import type { MirrorRegistryView } from "../src/mirror/registry-view.js"
import type { MirrorRegistryContribution } from "../src/types.js"

const DID = "did:key:z6MkProfil"

function view(partial: Partial<MirrorRegistryView>): MirrorRegistryView {
  return { status: "accepted", seq: 0, deviceId: "A", tiebreak: "", ...partial }
}

describe("mergeProfileData — Spec 12 Regel 1 und 2", () => {
  it("setzt data.did immer auf die DID, auch wenn der Aufrufer etwas anderes mitgibt", () => {
    const data = mergeProfileData(DID, { did: "did:key:fremd", displayName: "Alt" }, { displayName: "Neu" })

    expect(data.did).toBe(DID)
    expect(data.displayName).toBe("Neu")
  })

  it("lässt nicht genannte Felder unberührt (undefined heißt: nicht anfassen)", () => {
    const data = mergeProfileData(DID, { displayName: "Anton", bio: "Baut Netze" }, { avatarUrl: "a.png" })

    expect(data).toMatchObject({ displayName: "Anton", bio: "Baut Netze", avatarUrl: "a.png" })
  })

  it("entfernt ein Feld bei leerem Wert statt einen leeren String zu speichern", () => {
    const data = mergeProfileData(DID, { displayName: "Anton", bio: "alt", avatarUrl: "a.png" }, { bio: "", avatarUrl: null })

    expect(data).not.toHaveProperty("bio")
    expect(data).not.toHaveProperty("avatarUrl")
  })

  it("trägt Ortsfelder als place/v1-Daten (Spec 12 Regel 2: person/v1 hat kein Positionsfeld)", () => {
    const position = { type: "Point", coordinates: [9.5, 51.3] }
    const data = mergeProfileData(DID, {}, { position, address: "Kassel", locationName: "Werkstatt" })

    expect(data.position).toEqual(position)
    expect(data.address).toBe("Kassel")
    expect(data.locationName).toBe("Werkstatt")
  })

  it("kopiert die Position, statt das übergebene Objekt in den Doc zu reichen", () => {
    const position = { type: "Point", coordinates: [9.5, 51.3] }
    const data = mergeProfileData(DID, {}, { position })

    expect(data.position).not.toBe(position)
    expect(data.position).toEqual(position)
  })

  it("löscht die Position bei null", () => {
    const data = mergeProfileData(DID, { position: { type: "Point", coordinates: [1, 2] } }, { position: null })

    expect(data).not.toHaveProperty("position")
  })
})

describe("profileItemInput — Spec 12 Regel 1", () => {
  it("setzt id, createdBy und data.did auf die DID", () => {
    const input = profileItemInput(DID, { displayName: "Anton" })

    expect(input.id).toBe(DID)
    expect(input.createdBy).toBe(DID)
    expect((input.data as Record<string, unknown>).did).toBe(DID)
    expect(input.type).toBe("person")
  })

  it("deklariert place/v1 im @context, sobald eine Position dabei ist (Regel 2)", () => {
    const withPlace = profileItemInput(DID, { displayName: "Anton", position: { type: "Point", coordinates: [9.5, 51.3] } })
    const withoutPlace = profileItemInput(DID, { displayName: "Anton" })

    expect(withPlace["@context"]?.some((entry) => entry.includes("place/v1"))).toBe(true)
    expect(withoutPlace["@context"]?.some((entry) => entry.includes("place/v1"))).toBe(false)
    expect(withoutPlace["@context"]?.some((entry) => entry.includes("person/v1"))).toBe(true)
  })
})

describe("planMembershipTransition — Spec 12 Regel 4 und 7, Spec 09 §Ablage", () => {
  it("ein neu erschienener Space ohne Eintrag wird pending", () => {
    expect(planMembershipTransition(null, { keyGeneration: 3 })).toEqual({ status: "pending" })
  })

  it("ein Alt-Space ohne Aufnahme-Kennung bekommt KEINEN Eintrag", () => {
    expect(planMembershipTransition(null, undefined)).toBeNull()
  })

  it("gleiche Kennung heißt: nichts zu tun", () => {
    expect(planMembershipTransition(view({ admission: { keyGeneration: 2 } }), { keyGeneration: 2 })).toBeNull()
  })

  it("Wiederaufnahme (höhere Kennung) wird pending, nicht still accepted", () => {
    expect(planMembershipTransition(view({ admission: { keyGeneration: 2 } }), { keyGeneration: 5 }))
      .toEqual({ status: "pending" })
  })

  it("auch der Anstieg von keiner Kennung auf eine Kennung ist eine Wiederaufnahme", () => {
    expect(planMembershipTransition(view({ admission: undefined }), { keyGeneration: 1 }))
      .toEqual({ status: "pending" })
  })

  it("Mitgliedschaftsverlust (Kennung fällt weg) wird revoked", () => {
    expect(planMembershipTransition(view({ admission: { keyGeneration: 4 } }), undefined))
      .toEqual({ status: "revoked" })
  })

  it("niedrigere Kennung des Space wird revoked", () => {
    expect(planMembershipTransition(view({ admission: { keyGeneration: 4 } }), { keyGeneration: 2 }))
      .toEqual({ status: "revoked" })
  })

  it("ein bereits widerrufener Eintrag wird nicht erneut widerrufen", () => {
    expect(planMembershipTransition(view({ status: "revoked", admission: { keyGeneration: 4 } }), undefined))
      .toBeNull()
  })
})

describe("planStockGrants — Spec 12 Regel 5 Übergangsregel", () => {
  const spaces = [
    { id: "home", type: "shared", appTag: "rls-private", members: [], createdAt: "", admission: { keyGeneration: 0 } },
    { id: "garten", type: "shared", appTag: "rls", members: [], createdAt: "", admission: { keyGeneration: 2 } },
    { id: "alt", type: "shared", appTag: "rls", members: [], createdAt: "" },
    { id: "personal", type: "personal", members: [], createdAt: "", admission: { keyGeneration: 1 } },
  ] as never

  it("nimmt nur geteilte Spaces mit gültiger Aufnahme-Kennung, ohne den persönlichen Space", () => {
    expect(planStockGrants(spaces, "home")).toEqual(["garten"])
  })

  it("lässt Alt-Spaces ohne Kennung aus (09: keine gültige Aufnahme)", () => {
    expect(planStockGrants(spaces, "home")).not.toContain("alt")
  })
})

describe("maxAdmission — Spec 09: ein Widerruf trägt nie eine niedrigere Kennung", () => {
  it("liefert die höhere von beiden", () => {
    expect(maxAdmission({ keyGeneration: 2 }, { keyGeneration: 5 })).toEqual({ keyGeneration: 5 })
    expect(maxAdmission({ keyGeneration: 7 }, { keyGeneration: 5 })).toEqual({ keyGeneration: 7 })
  })

  it("behandelt keine Kennung als kleiner als jede Kennung", () => {
    expect(maxAdmission(undefined, { keyGeneration: 1 })).toEqual({ keyGeneration: 1 })
    expect(maxAdmission({ keyGeneration: 1 }, undefined)).toEqual({ keyGeneration: 1 })
    expect(maxAdmission(undefined, undefined)).toBeUndefined()
  })

  it("liefert eine Kopie, nie das übergebene Objekt", () => {
    const input = { keyGeneration: 3 }
    expect(maxAdmission(input, undefined)).not.toBe(input)
  })
})

describe("supersedesOf — Spec 09 Widerrufs-Kausalität", () => {
  const contribution = (partial: Partial<MirrorRegistryContribution>): MirrorRegistryContribution => ({
    statusSeq: 1,
    status: "accepted",
    seq: 0,
    tiebreak: "",
    updatedAt: "2026-09-12T00:00:00.000Z",
    ...partial,
  })

  it("deckt jeden beobachteten nicht-accepted Beitrag ab", () => {
    const byDevice = {
      A: contribution({ status: "revoked", statusSeq: 4 }),
      B: contribution({ status: "pending", statusSeq: 2 }),
      C: contribution({ status: "accepted", statusSeq: 9 }),
    }

    expect(supersedesOf(byDevice)).toEqual({ A: 4, B: 2 })
  })

  it("liefert undefined, wenn nichts abzudecken ist", () => {
    expect(supersedesOf({ C: contribution({ status: "accepted" }) })).toBeUndefined()
  })
})
