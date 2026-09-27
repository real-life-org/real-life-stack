import { describe, expect, it } from "vitest"
import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { aggregateVoteStats, noVoteCount, sortStatements, type StatementVoteStats } from "../src/lib/resonance-sort"

function statement(id: string, createdAt: string): Item {
  return { id, type: "statement", createdAt, createdBy: "did:key:author", data: { title: id } }
}

function vote(statementId: string, voter: string, value: string, createdAt: string, overrides: Partial<RelationRecord> = {}): RelationRecord {
  return {
    id: `rel-${statementId}-${voter}`,
    predicate: "votesOn",
    from: `global:${voter}`,
    to: `item:${statementId}`,
    fields: { value, contentHash: `hash-${statementId}` },
    createdBy: voter,
    createdAt,
    ...overrides,
  }
}

const HASHES: ReadonlyMap<string, string> = new Map([["a", "hash-a"], ["b", "hash-b"]])

describe("aggregateVoteStats", () => {
  it("groups validated vote records by statement and tracks the latest vote time", () => {
    const stats = aggregateVoteStats([
      vote("a", "u1", "green", "2026-08-01T10:00:00.000Z"),
      vote("a", "u2", "red", "2026-08-01T12:00:00.000Z"),
      vote("b", "u1", "yellow", "2026-08-01T11:00:00.000Z"),
    ], HASHES)
    expect(stats.get("a")).toMatchObject({ green: 1, yellow: 0, red: 1, total: 2, lastVoteAt: "2026-08-01T12:00:00.000Z" })
    expect(stats.get("b")).toMatchObject({ green: 0, yellow: 1, red: 0, total: 1, lastVoteAt: "2026-08-01T11:00:00.000Z" })
    expect([...stats.get("a")!.voters!]).toEqual([["u1", "green"], ["u2", "red"]])
  })

  it("shares the record validation: forged, malformed and duplicate records don't skew the sort", () => {
    const stats = aggregateVoteStats([
      // Forged: endpoint not bound to the author.
      vote("a", "u1", "green", "2026-08-01T10:00:00.000Z", { createdBy: "did:key:mallory" }),
      // Malformed value.
      vote("a", "u2", "purple", "2026-08-01T10:00:00.000Z"),
      // Duplicate tuple under two ids — counts once.
      vote("b", "u1", "green", "2026-08-01T10:00:00.000Z", { id: "rel-z" }),
      vote("b", "u1", "green", "2026-08-01T10:00:00.000Z", { id: "rel-a" }),
    ], HASHES)
    expect(stats.get("a")).toBeUndefined()
    expect(stats.get("b")?.total).toBe(1)
  })

  it("counts a vote only for the current wording of a counting statement (resonance vote rule 5)", () => {
    const stats = aggregateVoteStats([
      vote("a", "u1", "green", "2026-08-01T10:00:00.000Z"),
      // Cast on an earlier wording.
      vote("a", "u2", "red", "2026-08-01T10:00:00.000Z", { fields: { value: "red", contentHash: "hash-old" } }),
      // No hash at all.
      vote("a", "u3", "red", "2026-08-01T10:00:00.000Z", { fields: { value: "red" } }),
      // Statement without a positive verdict: absent from the map.
      vote("c", "u1", "green", "2026-08-01T10:00:00.000Z"),
    ], HASHES)
    expect(stats.get("a")).toMatchObject({ green: 1, yellow: 0, red: 0, total: 1, lastVoteAt: "2026-08-01T10:00:00.000Z" })
    expect(stats.get("c")).toBeUndefined()
  })
})

describe("Personenmenge (resonance.md → Auswertung)", () => {
  it("counts only votes of the chosen people", () => {
    const stats = aggregateVoteStats([
      vote("a", "u1", "green", "2026-08-01T10:00:00.000Z"),
      vote("a", "u2", "red", "2026-08-01T11:00:00.000Z"),
      vote("a", "u3", "yellow", "2026-08-01T12:00:00.000Z"),
    ], HASHES, new Set(["u1", "u3"]))
    expect(stats.get("a")).toMatchObject({ green: 1, yellow: 1, red: 0, total: 2 })
    expect([...stats.get("a")!.voters!.keys()]).toEqual(["u1", "u3"])
  })

  it('„ohne Stimme" is the set size minus voters, never red; unknown size → null', () => {
    expect(noVoteCount({ total: 2 }, { people: new Set(["u1", "u2", "u3", "u4"]), size: 4 })).toBe(2)
    expect(noVoteCount({ total: 5 }, { people: new Set(["u1"]), size: 1 })).toBe(0)
    expect(noVoteCount({ total: 2 }, { people: null, size: null })).toBeNull()
  })
})

describe("sortStatements", () => {
  const s1 = statement("s1", "2026-08-01T09:00:00.000Z") // oldest, most votes, best approval
  const s2 = statement("s2", "2026-08-02T09:00:00.000Z") // middle, latest vote activity
  const s3 = statement("s3", "2026-08-03T09:00:00.000Z") // newest, no votes
  const stats = new Map<string, StatementVoteStats>([
    ["s1", { green: 3, yellow: 0, red: 0, total: 3, lastVoteAt: "2026-08-02T10:00:00.000Z" }],
    ["s2", { green: 1, yellow: 0, red: 1, total: 2, lastVoteAt: "2026-08-03T10:00:00.000Z" }],
  ])

  it("newest: sorts by statement creation date desc", () => {
    expect(sortStatements([s1, s2, s3], stats, "newest").map((s) => s.id)).toEqual(["s3", "s2", "s1"])
  })

  it("votes: sorts by vote count desc, unvoted last", () => {
    expect(sortStatements([s3, s2, s1], stats, "votes").map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })

  it("approval: sorts by green share desc", () => {
    // s1: 3/3 green, s2: 1/2 green, s3: no votes → 0
    expect(sortStatements([s3, s2, s1], stats, "approval").map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })

  it("activity: sorts by latest vote desc, unvoted last", () => {
    expect(sortStatements([s1, s3, s2], stats, "activity").map((s) => s.id)).toEqual(["s2", "s1", "s3"])
  })

  it("votes: breaks a count tie by approval share", () => {
    const a = statement("a", "2026-08-01T00:00:00.000Z")
    const b = statement("b", "2026-08-01T00:00:00.000Z")
    const tied = new Map<string, StatementVoteStats>([
      ["a", { green: 1, yellow: 0, red: 1, total: 2, lastVoteAt: "2026-08-01T10:00:00.000Z" }],
      ["b", { green: 2, yellow: 0, red: 0, total: 2, lastVoteAt: "2026-08-01T09:00:00.000Z" }],
    ])
    expect(sortStatements([a, b], tied, "votes").map((s) => s.id)).toEqual(["b", "a"])
  })

  it("concerns / rejection: sort by yellow / red share desc, then vote count", () => {
    const a = statement("a", "2026-08-01T00:00:00.000Z")
    const b = statement("b", "2026-08-02T00:00:00.000Z")
    const c = statement("c", "2026-08-03T00:00:00.000Z")
    const shares = new Map<string, StatementVoteStats>([
      ["a", { green: 0, yellow: 2, red: 2, total: 4, lastVoteAt: null }],
      ["b", { green: 1, yellow: 1, red: 0, total: 2, lastVoteAt: null }],
      ["c", { green: 0, yellow: 0, red: 1, total: 1, lastVoteAt: null }],
    ])
    // yellow: a 0.5, b 0.5 (a has more votes), c 0
    expect(sortStatements([c, b, a], shares, "concerns").map((s) => s.id)).toEqual(["a", "b", "c"])
    // red: c 1.0, a 0.5, b 0
    expect(sortStatements([a, b, c], shares, "rejection").map((s) => s.id)).toEqual(["c", "a", "b"])
  })

  it("participation: voters ÷ size of the person set desc", () => {
    const population = { people: new Set(["u1", "u2", "u3", "u4"]), size: 4 }
    // s1: 3/4, s2: 2/4, s3: 0/4
    expect(sortStatements([s3, s2, s1], stats, "participation", population).map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })

  it("does not mutate the input array", () => {
    const input = [s1, s2, s3]
    sortStatements(input, stats, "newest")
    expect(input.map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })
})
