import { describe, expect, it } from "vitest"

import { planReconcile } from "../src/mirror/reconcile.js"
import type { MirrorReconcileEntry, MirrorSlotState } from "../src/mirror/reconcile.js"
import type { MirrorRegistryView } from "../src/mirror/registry-view.js"

const gen = (keyGeneration: number) => ({ keyGeneration })
const HASH = "aa".repeat(32)
const OTHER_HASH = "bb".repeat(32)

const view = (partial: Partial<MirrorRegistryView> = {}): MirrorRegistryView => ({
  status: "accepted",
  admission: gen(1),
  seq: 5,
  deviceId: "dev-a",
  tiebreak: "cc",
  publishedHash: HASH,
  ...partial,
})

const slotAt = (seq: number, isTombstone = false): MirrorSlotState => ({
  kind: "present",
  position: { seq, deviceId: "dev-a", tiebreak: "cc" },
  isTombstone,
})

function entry(partial: Partial<MirrorReconcileEntry> = {}): MirrorReconcileEntry {
  return {
    itemId: "task-1",
    targetSpaceId: "garden",
    view: view(),
    targetAdmission: gen(1),
    isMember: true,
    homeItemHash: HASH,
    slot: slotAt(5),
    ...partial,
  }
}

const actionOf = (partial: Partial<MirrorReconcileEntry>) =>
  planReconcile({ entries: [entry(partial)] })[0]?.action

/** Spec 09 §Ablage und Registry (Abgleich als Zielzustand) + Spec 12 Regel 5. */
describe("planReconcile — accepted, Kennung des Ziel-Space = admission", () => {
  it("publiziert nichts, wenn Hash und Slot stimmen", () => {
    expect(actionOf({})).toBe("none")
  })

  it("publiziert, wenn der Item-Hash vom publishedHash abweicht", () => {
    expect(actionOf({ homeItemHash: OTHER_HASH })).toBe("publish-live")
  })

  it("publiziert, wenn der Slot im Ziel fehlt", () => {
    expect(actionOf({ slot: { kind: "missing" } })).toBe("publish-live")
  })

  it("publiziert, wenn der Slot ungültig ist (Reparatur)", () => {
    expect(actionOf({ slot: { kind: "invalid" } })).toBe("publish-live")
  })

  it("publiziert, wenn der Slot eine niedrigere Version trägt als die Registry-Position", () => {
    expect(actionOf({ slot: slotAt(4) })).toBe("publish-live")
  })

  it("lässt einen Slot mit höherer Version in Ruhe", () => {
    expect(actionOf({ slot: slotAt(6) })).toBe("none")
  })

  it("behandelt fehlende Kennung auf beiden Seiten als dieselbe Aufnahme (Alt-Space)", () => {
    expect(actionOf({ view: view({ admission: undefined }), targetAdmission: undefined, homeItemHash: OTHER_HASH })).toBe(
      "publish-live",
    )
  })

  // Fehlt das Home-Item (auch durch einen anderen Home-Editor gelöscht),
  // bleibt der Eintrag accepted, publiziert aber einen Tombstone.
  it("publiziert einen Tombstone, wenn das Home-Item fehlt", () => {
    expect(actionOf({ homeItemHash: null })).toBe("publish-tombstone")
  })

  it("publiziert den Tombstone weiter, solange im Ziel nur ein Live-Slot liegt", () => {
    expect(actionOf({ homeItemHash: null, slot: slotAt(9, false) })).toBe("publish-tombstone")
  })

  it("hört auf, sobald im Ziel ein Tombstone mit Version ≥ Registry-Position liegt", () => {
    expect(actionOf({ homeItemHash: null, slot: slotAt(5, true) })).toBe("none")
    expect(actionOf({ homeItemHash: null, slot: slotAt(6, true) })).toBe("none")
    expect(actionOf({ homeItemHash: null, slot: slotAt(4, true) })).toBe("publish-tombstone")
  })
})

describe("planReconcile — accepted, Kennung des Ziel-Space > admission (Wiederaufnahme)", () => {
  it("widerruft den Beitrag mit der neuen Kennung", () => {
    expect(actionOf({ targetAdmission: gen(2) })).toBe("mark-revoked")
  })

  it("behandelt undefined → Kennung als Wiederaufnahme", () => {
    expect(actionOf({ view: view({ admission: undefined }), targetAdmission: gen(0) })).toBe("mark-revoked")
  })

  it("führt für Anwendungen mit Annahme (Spec 12) stattdessen den Zwischenstatus", () => {
    const plan = planReconcile({ entries: [entry({ targetAdmission: gen(2) })], readmission: "pending" })
    expect(plan[0]?.action).toBe("mark-pending")
  })

  it("publiziert bei Wiederaufnahme NIE mit der alten Freigabe", () => {
    expect(actionOf({ targetAdmission: gen(2), homeItemHash: OTHER_HASH, slot: { kind: "missing" } })).toBe(
      "mark-revoked",
    )
  })
})

describe("planReconcile — accepted, Mitgliedschaft verloren", () => {
  it("widerruft bei niedrigerer Kennung des Ziel-Space", () => {
    expect(actionOf({ view: view({ admission: gen(3) }), targetAdmission: gen(1) })).toBe("mark-revoked")
  })

  it("widerruft, wenn der Ziel-Space keine Kennung mehr liefert, der Eintrag aber eine trägt", () => {
    expect(actionOf({ targetAdmission: undefined })).toBe("mark-revoked")
  })
})

describe("planReconcile — revoked", () => {
  it("publiziert einen Tombstone, solange der Autor Mitglied ist", () => {
    expect(actionOf({ view: view({ status: "revoked" }), slot: slotAt(5, false) })).toBe("publish-tombstone")
  })

  it("hört auf, sobald im Ziel ein Tombstone mit Version ≥ Registry-Position liegt", () => {
    expect(actionOf({ view: view({ status: "revoked" }), slot: slotAt(5, true) })).toBe("none")
  })

  it("unternimmt nichts mehr, wenn der Autor kein Mitglied mehr ist (Invariante 11 regelt die Sicht)", () => {
    expect(actionOf({ view: view({ status: "revoked" }), isMember: false, slot: { kind: "missing" } })).toBe("none")
  })
})

describe("planReconcile — pending", () => {
  it("publiziert NIE (Spec 12 Regel 5)", () => {
    expect(actionOf({ view: view({ status: "pending" }), homeItemHash: OTHER_HASH, slot: { kind: "missing" } })).toBe(
      "none",
    )
  })
})

describe("planReconcile — Plan", () => {
  it("liefert je Registry-Eintrag genau eine Aktion, in Eingabereihenfolge", () => {
    const plan = planReconcile({
      entries: [
        entry({ targetSpaceId: "garden", homeItemHash: OTHER_HASH }),
        entry({ targetSpaceId: "camp", view: view({ status: "revoked" }), slot: { kind: "missing" } }),
        entry({ targetSpaceId: "hof" }),
      ],
    })
    expect(plan).toEqual([
      { itemId: "task-1", targetSpaceId: "garden", action: "publish-live" },
      { itemId: "task-1", targetSpaceId: "camp", action: "publish-tombstone" },
      { itemId: "task-1", targetSpaceId: "hof", action: "none" },
    ])
  })
})
