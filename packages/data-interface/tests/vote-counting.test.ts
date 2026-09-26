import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import type { Item, RelationRecord } from "../src/index"
import { itemContentHash, verifyItemClaim, verifyRelationClaim } from "../src/claims"
import { partitionVotesByContent, voteFromRelationRecord, type VoteRecord } from "../src/votes"

const REPO_ROOT = join(__dirname, "..", "..", "..")

const VECTORS = JSON.parse(
  readFileSync(join(REPO_ROOT, "docs", "spec", "schemas", "claims", "vectors", "resonance-1.json"), "utf8"),
) as {
  counting: Array<{
    name: string
    mode: "signed" | "authoritative" | "none"
    expect: "counts" | "notCounted"
    statement: Item
    vote: RelationRecord
  }>
}

// Verdicts per claim mode (spec 08): signed verifies cryptographically,
// authoritative stores vouch with "trusted", no claim mode yields nothing.
async function statementVerified(mode: string, statement: Item): Promise<boolean> {
  if (mode === "authoritative") return true
  if (mode === "signed") return (await verifyItemClaim(statement)) === "valid"
  return false
}
async function voteVerified(mode: string, vote: RelationRecord): Promise<boolean> {
  if (mode === "authoritative") return true
  if (mode === "signed") return (await verifyRelationClaim(vote)) === "valid"
  return false
}

describe("Resonance — vote counting (canonical vectors, Vote rule 5)", () => {
  for (const vector of VECTORS.counting) {
    it(`${vector.name} → ${vector.expect}`, async () => {
      const votes: VoteRecord[] = []
      if (await voteVerified(vector.mode, vector.vote)) {
        const vote = voteFromRelationRecord(vector.vote)
        if (vote) votes.push(vote)
      }
      const verified = await statementVerified(vector.mode, vector.statement)
      const { counted } = partitionVotesByContent(votes, verified ? await itemContentHash(vector.statement) : null)
      expect(counted.length === 1 ? "counts" : "notCounted").toBe(vector.expect)
    })
  }
})

describe("partitionVotesByContent", () => {
  const vote = (voterId: string, contentHash?: string): VoteRecord => ({
    recordId: `rel-${voterId}`,
    statementId: "s1",
    voterId,
    value: "green",
    createdAt: "2026-09-26T10:00:00.000Z",
    ...(contentHash ? { contentHash } : {}),
  })

  it("counts matching votes, separates votes for another version, drops unbound votes", () => {
    const result = partitionVotesByContent([vote("a", "sha256:1"), vote("b", "sha256:2"), vote("c")], "sha256:1")
    expect(result.counted.map((v) => v.voterId)).toEqual(["a"])
    expect(result.otherVersion.map((v) => v.voterId)).toEqual(["b"])
  })

  it("counts nothing when the statement has no positive verdict", () => {
    const result = partitionVotesByContent([vote("a", "sha256:1")], null)
    expect(result.counted).toEqual([])
    expect(result.otherVersion).toEqual([])
  })
})

describe("voteFromRelationRecord — content hash", () => {
  const record = (fields: Record<string, unknown>): RelationRecord => ({
    id: "rel-x",
    predicate: "votesOn",
    from: "global:did:key:zA",
    to: "item:s1",
    fields,
    createdBy: "did:key:zA",
    createdAt: "2026-09-26T10:00:00.000Z",
  })

  it("projects fields.contentHash", () => {
    expect(voteFromRelationRecord(record({ value: "red", contentHash: "sha256:abc" }))?.contentHash).toBe("sha256:abc")
  })

  it("leaves contentHash absent when the field is missing or not a string", () => {
    expect(voteFromRelationRecord(record({ value: "red" }))?.contentHash).toBeUndefined()
    expect(voteFromRelationRecord(record({ value: "red", contentHash: 42 }))?.contentHash).toBeUndefined()
  })
})
