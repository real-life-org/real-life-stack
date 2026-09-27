import { describe, expect, it } from "vitest"
import {
  collectAccepted,
  composeTypeManifest,
  onePerSubjectWinnerList,
  onePerSubjectWinners,
  relationRecordFromItem,
  TOOLKIT_TYPE_LAYER,
  type Item,
  type RelationRecord,
} from "../src/index.js"

// Spec 08 → Qualifier an Kanten, Regel 10, und „Gewinner unter one-per-subject".

const EVENT = "item:event-1"
const T = "2026-09-27T10:00:00.000Z"

function record(overrides: Partial<RelationRecord> & Pick<RelationRecord, "id" | "createdBy" | "from">): RelationRecord {
  return {
    predicate: "attends",
    to: EVENT,
    createdAt: T,
    fields: { role: "going" },
    ...overrides,
  }
}

describe("onePerSubjectWinners (08, Gewinner unter one-per-subject)", () => {
  it("Testvektor aus 08: bei gleichem Zeitpunkt gewinnt die größte id — Jonas' declined", () => {
    const anton = record({ id: "rel-3f", createdBy: "anton", from: "global:timo", fields: { role: "going" } })
    const jonas = record({ id: "rel-a1", createdBy: "jonas", from: "global:timo", fields: { role: "declined" } })
    const winners = onePerSubjectWinners([anton, jonas], EVENT)
    expect(winners.get("global:timo")?.id).toBe("rel-a1")
    // Unabhängig von der Reihenfolge (Regel 5).
    expect(onePerSubjectWinners([jonas, anton], EVENT).get("global:timo")?.id).toBe("rel-a1")
  })

  it("Testvektor, Fortsetzung: Timos eigene Aussage gewinnt, gleich wann sie entstand", () => {
    const anton = record({ id: "rel-3f", createdBy: "anton", from: "global:timo", fields: { role: "going" } })
    const jonas = record({ id: "rel-a1", createdBy: "jonas", from: "global:timo", fields: { role: "declined" } })
    const timo = record({
      id: "rel-00",
      createdBy: "timo",
      from: "global:timo",
      createdAt: "2020-01-01T00:00:00.000Z",
      fields: { role: "maybe" },
    })
    expect(onePerSubjectWinners([anton, jonas, timo], EVENT).get("global:timo")?.id).toBe("rel-00")
  })

  it("ohne Selbstaussage gewinnt die jüngste fremde Aussage", () => {
    const older = record({ id: "rel-ff", createdBy: "anton", from: "global:timo", createdAt: "2026-09-27T09:00:00.000Z" })
    const newer = record({ id: "rel-01", createdBy: "jonas", from: "global:timo", createdAt: "2026-09-27T11:00:00.000Z" })
    expect(onePerSubjectWinners([older, newer], EVENT).get("global:timo")?.id).toBe("rel-01")
  })

  it("ohne Claim zählt updatedAt des Relation-Items, mit Claim nur createdAt (Regel 4 und 6)", () => {
    const edited = record({
      id: "rel-01",
      createdBy: "anton",
      from: "global:timo",
      createdAt: "2026-09-27T08:00:00.000Z",
      updatedAt: "2026-09-27T12:00:00.000Z",
    })
    const other = record({ id: "rel-02", createdBy: "jonas", from: "global:timo", createdAt: "2026-09-27T11:00:00.000Z" })
    expect(onePerSubjectWinners([edited, other], EVENT).get("global:timo")?.id).toBe("rel-01")
    // Signiert bindet das Payload nur createdAt — die spätere Änderung verschiebt nichts.
    const signed = { ...edited, claim: "x.y.z" }
    expect(onePerSubjectWinners([signed, other], EVENT).get("global:timo")?.id).toBe("rel-02")
  })

  it("ist der Gegenstand keine Person, gewinnt die jüngste Aussage, auch die des Gegenstands selbst", () => {
    const own = record({ id: "rel-01", createdBy: "x", from: "item:x", createdAt: "2026-09-27T08:00:00.000Z" })
    const other = record({ id: "rel-02", createdBy: "y", from: "item:x", createdAt: "2026-09-27T09:00:00.000Z" })
    expect(onePerSubjectWinners([own, other], EVENT).get("item:x")?.id).toBe("rel-02")
  })

  it("wertet je Gegenstand und Ziel getrennt", () => {
    const a = record({ id: "rel-01", createdBy: "anna", from: "global:anna" })
    const b = record({ id: "rel-02", createdBy: "anna", from: "global:ben" })
    const c = record({ id: "rel-03", createdBy: "anna", from: "global:anna", to: "item:event-2" })
    // Die Map gilt für EIN Ziel: Records zu anderen Zielen nehmen nicht teil.
    const winners = onePerSubjectWinners([a, b, c], EVENT)
    expect([...winners.keys()].sort()).toEqual(["global:anna", "global:ben"])
    expect(winners.get("global:anna")?.id).toBe("rel-01")
    expect(onePerSubjectWinnerList([a, b, c]).map((r) => r.id).sort()).toEqual(["rel-01", "rel-02", "rel-03"])
  })
})

describe("collectAccepted (08, Regel 10)", () => {
  it("sammelt, überstimmt nichts und zeigt eine Aussage über eine Person erst nach ihrer Annahme", () => {
    const self = record({ id: "rel-01", createdBy: "timo", from: "global:timo" })
    const byAnton = record({ id: "rel-02", createdBy: "anton", from: "global:timo" })
    const byJonas = record({ id: "rel-03", createdBy: "jonas", from: "global:timo" })
    const accepted = new Set(["rel-03"])
    const shown = collectAccepted([self, byAnton, byJonas], (r) => accepted.has(r.id))
    expect(shown.map((r) => r.id)).toEqual(["rel-01", "rel-03"])
  })
})

describe("RelationRecord-Projektion trägt updatedAt (für Regel 4 ohne Claim)", () => {
  it("übernimmt updatedAt des Relation-Items, wenn es gesetzt ist", () => {
    const item: Item = {
      id: "rel-1",
      type: "relation",
      createdAt: T,
      updatedAt: "2026-09-27T12:00:00.000Z",
      createdBy: "anton",
      data: { predicate: "attends", role: "going" },
      relations: [
        { predicate: "from", target: "global:anton" },
        { predicate: "to", target: EVENT },
      ],
    }
    expect(relationRecordFromItem(item)?.updatedAt).toBe("2026-09-27T12:00:00.000Z")
    expect(relationRecordFromItem({ ...item, updatedAt: undefined })).not.toHaveProperty("updatedAt")
  })
})

describe("Manifest: attends am Event (08 → Teilnahme am Event)", () => {
  it("event deklariert die eingehende Kante attends von einer Person", () => {
    const manifest = composeTypeManifest([TOOLKIT_TYPE_LAYER])
    expect(manifest.get("event")?.relations).toContainEqual({ predicate: "attends", itemRole: "to", otherKind: "person" })
    expect(manifest.get("event")?.relations).toContainEqual({ predicate: "invited", itemRole: "from", otherKind: "person" })
  })
})
