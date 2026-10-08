import { describe, expect, it } from "vitest"
import type { Item, RelationRecord } from "@real-life/data-interface"
import { itemContentHash } from "@real-life/data-interface"
import { buildExport, planImport } from "../src/lib/resonance-transfer"

const ME = "did:key:me"
const OTHER = "did:key:other"

function statement(id: string, createdBy: string, data: Record<string, unknown>, tags?: string[]): Item {
  return { id, type: "statement", createdBy, createdAt: "2026-09-27T10:00:00.000Z", data, ...(tags ? { tags } : {}) }
}

const existing = [
  statement("s-1", ME, { title: "Wir treffen uns montags" }),
  statement("s-2", OTHER, { title: "Wir kochen zusammen" }),
]

const file = (statements: unknown[]) => ({ format: "resonance-import/1", statements })

describe("planImport (resonance.md → Import)", () => {
  it("rejects a file with an unknown format or without statements — nothing is written", async () => {
    expect((await planImport({ format: "x", statements: [] }, { userId: ME, statements: existing })).errors[0]!.index).toBe(-1)
    expect((await planImport(file([]), { userId: ME, statements: existing })).errors).toHaveLength(1)
    expect((await planImport("text", { userId: ME, statements: existing })).errors).toHaveLength(1)
  })

  it("validates the whole file first and names every broken entry", async () => {
    const plan = await planImport(file([
      { title: "Gut" },
      { description: "ohne Titel" },
      { title: "Tags kaputt", tags: [1] },
      { title: "Variante ins Leere", variantOf: "item:gibt-es-nicht" },
      { title: "Falsche Form", variantOf: "s-1" },
    ]), { userId: ME, statements: existing })
    expect(plan.create).toEqual([])
    expect(plan.errors.map((error) => error.index)).toEqual([1, 2, 3, 4])
  })

  it("skips what the importing person already has with the same content; tags do not count", async () => {
    const plan = await planImport(file([
      { title: "Wir treffen uns montags", tags: ["neu"] },
      { title: "Wir kochen zusammen" },
      { title: "Neu", description: "Kontext", variantOf: "item:s-2", tags: ["a"] },
    ]), { userId: ME, statements: existing })
    expect(plan.errors).toEqual([])
    // „montags" exists by ME → skipped; „kochen" exists only by OTHER → created.
    expect(plan.skipped.map((entry) => entry.title)).toEqual(["Wir treffen uns montags"])
    expect(plan.create.map((entry) => entry.title)).toEqual(["Wir kochen zusammen", "Neu"])
    expect(plan.create[1]).toEqual({ title: "Neu", description: "Kontext", variantOf: "item:s-2", tags: ["a"] })
  })

  it("is idempotent within the file: a repeated entry is skipped", async () => {
    const plan = await planImport(file([{ title: "Doppelt" }, { title: "Doppelt", tags: ["x"] }]), { userId: ME, statements: [] })
    expect(plan.create).toHaveLength(1)
    expect(plan.skipped).toHaveLength(1)
  })
})

describe("buildExport (resonance.md → Export)", () => {
  it("exports only counted votes of the person set, with claims and the summary", async () => {
    const s1 = statement("s-1", ME, { title: "Wir treffen uns montags", claim: "stmt.claim" }, ["garten"])
    const hash = (await itemContentHash(s1))!
    const vote = (id: string, voter: string, value: string, contentHash: string | undefined, claim?: string): RelationRecord => ({
      id, predicate: "votesOn", from: `global:${voter}`, to: "item:s-1", createdBy: voter, createdAt: "2026-09-27T11:00:00.000Z",
      fields: { value, ...(contentHash ? { contentHash } : {}) }, ...(claim ? { claim } : {}),
    })
    const result = await buildExport({
      space: "g",
      exportedAt: "2026-09-27T12:00:00.000Z",
      statements: [s1],
      verifiedRecords: [
        vote("v-a", ME, "green", hash, "vote.claim"),
        vote("v-b", OTHER, "red", "sha256:earlier"),
        vote("v-c", "did:key:third", "yellow", hash),
        vote("v-d", "did:key:outside", "red", hash),
      ],
      contentHashes: new Map([["s-1", hash]]),
      population: { people: new Set([ME, OTHER, "did:key:third", "did:key:fourth"]), size: 4 },
      tags: ["garten"],
    })
    expect(result.format).toBe("resonance-export/1")
    expect(result.filter).toEqual({ people: ["did:key:fourth", ME, OTHER, "did:key:third"].sort(), tags: ["garten"] })
    const [exported] = result.statements
    expect(exported).toMatchObject({ id: "s-1", title: "Wir treffen uns montags", tags: ["garten"], contentHash: hash, claim: "stmt.claim" })
    // v-b is for an earlier wording, v-d outside the person set.
    expect(exported!.votes).toEqual([
      { voter: ME, value: "green", contentHash: hash, createdAt: "2026-09-27T11:00:00.000Z", claim: "vote.claim" },
      { voter: "did:key:third", value: "yellow", contentHash: hash, createdAt: "2026-09-27T11:00:00.000Z" },
    ])
    expect(exported!.summary).toEqual({ green: 1, yellow: 1, red: 0, noVote: 2 })
  })

  it("an unknown person set has no noVote and no people filter", async () => {
    const s1 = statement("s-1", ME, { title: "A" })
    const result = await buildExport({
      space: null, exportedAt: "x", statements: [s1], verifiedRecords: [], contentHashes: new Map(),
      population: { people: null, size: null }, tags: [],
    })
    expect(result.filter.people).toBeNull()
    expect(result.statements[0]!.summary.noVote).toBeNull()
    expect(result.statements[0]!.contentHash).toBe(await itemContentHash(s1))
  })
})
