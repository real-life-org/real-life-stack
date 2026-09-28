import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { statementFamily, variantOfTarget, variantOfValue } from "../src/lib/resonance-variants"

function statement(id: string, variantOf?: string, createdAt = `2026-09-26T10:00:0${id.length % 10}.000Z`): Item {
  return {
    id,
    type: "statement",
    createdBy: "did:key:a",
    createdAt,
    data: { title: id, ...(variantOf !== undefined ? { variantOf } : {}) },
  }
}

const ids = (items: readonly Item[]) => items.map((item) => item.id)

describe("variantOf", () => {
  it("reads item:<id> and tolerates a bare id (über den Auflöser)", () => {
    const a = statement("a")
    const pool = [a]
    expect(variantOfTarget(statement("b", "item:a"), pool)).toBe(a)
    expect(variantOfTarget(statement("b", "a"), pool)).toBe(a)
    expect(variantOfTarget(statement("b"), pool)).toBeUndefined()
    expect(variantOfTarget(statement("b", "item:"), pool)).toBeUndefined()
    // Eine Variante zeigt nur in ihren Space: qualifiziert nicht prüfbar.
    expect(variantOfTarget(statement("b", "space:x/item:a"), pool)).toBeUndefined()
    expect(variantOfValue({ id: "a" })).toBe("item:a")
  })
})

describe("statementFamily (resonance.md → Varianten)", () => {
  const a = statement("a", undefined, "2026-09-26T10:00:00.000Z")
  const b = statement("b", "item:a", "2026-09-26T10:01:00.000Z")
  const c = statement("c", "item:a", "2026-09-26T10:02:00.000Z")
  const d = statement("d", "item:b", "2026-09-26T10:03:00.000Z")
  const other = statement("x", undefined, "2026-09-26T10:04:00.000Z")
  const all = [d, other, c, b, a]

  it("origin first, then all variants breadth-first; unrelated statements stay out", () => {
    expect(ids(statementFamily(d, all).members)).toEqual(["a", "b", "c", "d"])
    expect(ids(statementFamily(a, all).members)).toEqual(["a", "b", "c", "d"])
  })

  it("names the parent and the direct variants", () => {
    const family = statementFamily(b, all)
    expect(family.parent).toBe(a)
    expect(ids(family.variants)).toEqual(["d"])
    expect(ids(statementFamily(a, all).variants)).toEqual(["b", "c"])
    expect(statementFamily(a, all).parent).toBeNull()
  })

  it('a missing target is „missing" and the family starts at the item', () => {
    const orphan = statement("o", "item:gone")
    const family = statementFamily(orphan, [orphan])
    expect(family.parent).toBe("missing")
    expect(ids(family.members)).toEqual(["o"])
  })

  it("tolerates cycles: every member exactly once", () => {
    const p = statement("p", "item:q", "2026-09-26T10:00:00.000Z")
    const q = statement("q", "item:p", "2026-09-26T10:01:00.000Z")
    const r = statement("r", "item:q", "2026-09-26T10:02:00.000Z")
    const family = statementFamily(r, [p, q, r])
    expect(ids(family.members).sort()).toEqual(["p", "q", "r"])
    expect(new Set(ids(family.members)).size).toBe(3)
  })

  it("a self-reference is no variant", () => {
    const self = statement("s", "item:s")
    const family = statementFamily(self, [self])
    expect(family.parent).toBeNull()
    expect(ids(family.members)).toEqual(["s"])
  })
})
