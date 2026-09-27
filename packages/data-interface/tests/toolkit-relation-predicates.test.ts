import { describe, expect, it } from "vitest"
import {
  TOOLKIT_RELATION_PREDICATES,
  TOOLKIT_TYPE_MANIFEST,
  composeTypeManifest,
  TOOLKIT_TYPE_LAYER,
} from "../src/index.js"

// S3: Die Aufgabe führt `blocks` in beide Richtungen und `partOf` zum Projekt
// (Spec 06, Register je Typ). Ein Prädikat im Typ-Register MUSS eine
// Relation-Typ-Definition haben (06, Verhältnis zu Relations, Regel 3), und
// `itemRole` MUSS zur Symmetrie passen (Regel 1).

describe("Toolkit-Manifest: Kanten der Aufgabe (S3)", () => {
  const task = composeTypeManifest([TOOLKIT_TYPE_LAYER]).get("task")!
  const has = (predicate: string, itemRole: string, otherKind: string) =>
    (task.relations ?? []).some((r) => r.predicate === predicate && r.itemRole === itemRole && r.otherKind === otherKind)

  it("blocks ausgehend und eingehend, partOf zum Projekt", () => {
    expect(has("blocks", "from", "task")).toBe(true)
    expect(has("blocks", "to", "task")).toBe(true)
    expect(has("partOf", "from", "project")).toBe(true)
    expect(has("assignedTo", "from", "person")).toBe(true)
  })
})

describe("Relation-Typ-Definitionen des Toolkits", () => {
  const byPredicate = new Map(TOOLKIT_RELATION_PREDICATES.map((d) => [d.predicate, d]))

  it("jedes Prädikat des Toolkit-Manifests ist definiert (06, Regel 3)", () => {
    const used = new Set(TOOLKIT_TYPE_MANIFEST.flatMap((t) => ("relations" in t ? t.relations : []).map((r) => r.predicate)))
    for (const predicate of used) expect(byPredicate.has(predicate), predicate).toBe(true)
  })

  it("itemRole passt zur Symmetrie (06, Regel 1): symmetrisch ⇒ either, gerichtet ⇒ from/to", () => {
    for (const type of TOOLKIT_TYPE_MANIFEST) {
      for (const r of "relations" in type ? type.relations : []) {
        const symmetric = byPredicate.get(r.predicate)!.symmetric
        expect(r.itemRole === "either", `${type.id}: ${r.predicate}`).toBe(symmetric)
      }
    }
  })

  it("blocks und partOf sind gerichtet, ohne Doppelungen", () => {
    expect(byPredicate.get("blocks")?.symmetric).toBe(false)
    expect(byPredicate.get("partOf")?.symmetric).toBe(false)
    expect(byPredicate.size).toBe(TOOLKIT_RELATION_PREDICATES.length)
  })
})
