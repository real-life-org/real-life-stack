import { describe, expect, it } from "vitest"

import {
  composeTypeManifest,
  CORE_TYPE_LAYER,
  CORE_TYPE_MANIFEST,
  type TypeManifestLayer,
} from "../src/type-manifest"
import { VOCAB_EVENT, VOCAB_PERSON, VOCAB_PLACE } from "../src/vocab"

/**
 * Spec 06 → "Typ-Register" → "Erweiterung und Merge". Each test pins one
 * normative rule; the messages quote the rule so a failure reads as a spec
 * violation, not a code quirk.
 */

const app = (layer: Partial<TypeManifestLayer>): TypeManifestLayer => ({
  name: "app",
  ...layer,
})

/**
 * Spec 06 → "Verhältnis zu den Schemas": `vocabularies` benennt, welche
 * Schemas der Composer BEIM ERSTELLEN setzt. Ein OPTIONALES Vokabular steht
 * deshalb nicht in der Bindung — es wird feldgetrieben aktiv (`deriveContext`,
 * `place/v1` bei vorhandener `position`). `event` drückt "optional place" seit
 * jeher durch Weglassen aus; `person` (Spec 12 Regel 2: "person/v1 hat KEIN
 * Positionsfeld; ein Profil MIT Ort deklariert zusätzlich place/v1") folgt
 * derselben Form.
 */
describe("vocabulary binding: optional vocabularies are expressed by omission", () => {
  const manifest = composeTypeManifest([CORE_TYPE_LAYER])

  it("binds event to event/v1 only — place/v1 stays optional", () => {
    expect(manifest.get("event")?.vocabularies).toEqual([VOCAB_EVENT])
  })

  it("binds person to person/v1 only — place/v1 stays optional (spec 12 Regel 2)", () => {
    expect(manifest.get("person")?.vocabularies).toEqual([VOCAB_PERSON])
    expect(manifest.get("person")?.vocabularies).not.toContain(VOCAB_PLACE)
  })
})

describe("type manifest composition", () => {
  it("composes core → app deterministically, in definition order", () => {
    const manifest = composeTypeManifest([
      CORE_TYPE_LAYER,
      app({ definitions: [{ id: "statement", vocabularies: [] }] }),
    ])
    expect(manifest.ids).toEqual([...CORE_TYPE_MANIFEST.map((t) => t.id), "statement"])
    expect(manifest.get("task")?.relations).toEqual([
      { predicate: "assignedTo", itemRole: "from", otherKind: "person" },
    ])
  })

  it("rejects a definition re-using a taken id — a definition introduces a NEW id", () => {
    expect(() =>
      composeTypeManifest([
        CORE_TYPE_LAYER,
        app({ definitions: [{ id: "task", vocabularies: [] }] }),
      ]),
    ).toThrow(/bereits vergeben/)
  })

  it("extends an existing type additively via a fragment", () => {
    const manifest = composeTypeManifest([
      CORE_TYPE_LAYER,
      app({
        extensions: [{
          id: "task",
          relations: [
            { predicate: "blocks", itemRole: "from", otherKind: "item" },
            { predicate: "blocks", itemRole: "to", otherKind: "item" },
          ],
        }],
      }),
    ])
    // Both roles of the same predicate coexist — the key is the PAIR.
    expect(manifest.get("task")?.relations).toHaveLength(3)
  })

  it("rejects a fragment addressing an unknown id", () => {
    expect(() =>
      composeTypeManifest([CORE_TYPE_LAYER, app({ extensions: [{ id: "ghost" }] })]),
    ).toThrow(/unbekannte Typ-Id/)
  })

  it("rejects redefining an existing (predicate, itemRole) key — no override in v0.1", () => {
    expect(() =>
      composeTypeManifest([
        CORE_TYPE_LAYER,
        app({
          extensions: [{
            id: "task",
            relations: [{ predicate: "assignedTo", itemRole: "from", otherKind: "item" }],
          }],
        }),
      ]),
    ).toThrow(/Konflikt/)
  })

  it("rejects mixing 'either' with directed roles on the same predicate", () => {
    expect(() =>
      composeTypeManifest([
        CORE_TYPE_LAYER,
        app({
          extensions: [{
            id: "person",
            relations: [
              { predicate: "knows", itemRole: "either", otherKind: "person" },
              { predicate: "knows", itemRole: "from", otherKind: "person" },
            ],
          }],
        }),
      ]),
    ).toThrow(/Symmetrie/)
  })

  it("unites vocabularies as a set — re-adding is a no-op, never a conflict", () => {
    const manifest = composeTypeManifest([
      CORE_TYPE_LAYER,
      app({ extensions: [{ id: "event", vocabularies: [
        "https://real-life-stack.org/vocab/event/v1",
        "https://example.test/vocab/festival/v1",
      ] }] }),
    ])
    expect(manifest.get("event")?.vocabularies).toEqual([
      "https://real-life-stack.org/vocab/event/v1",
      "https://example.test/vocab/festival/v1",
    ])
  })

  it("is order-independent for non-conflicting extensions (same result, swapped layers' fragments)", () => {
    const a = { id: "post", relations: [{ predicate: "answers", itemRole: "to" as const, otherKind: "item" }] }
    const b = { id: "post", relations: [{ predicate: "quotes", itemRole: "from" as const, otherKind: "item" }] }
    const one = composeTypeManifest([CORE_TYPE_LAYER, app({ extensions: [a, b] })])
    const two = composeTypeManifest([CORE_TYPE_LAYER, app({ extensions: [b, a] })])
    const keys = (m: typeof one) =>
      new Set(m.get("post")!.relations!.map((r) => `${r.predicate} ${r.itemRole}`))
    expect(keys(one)).toEqual(keys(two))
  })
})
