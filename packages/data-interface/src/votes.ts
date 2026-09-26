import type { RelationRecord, RelationRecordInput } from "./index"
import type { VoteValue } from "./item-types"

/**
 * Votes (Resonance module) are RELATION RECORDS, not a free-standing item
 * type: `predicate: "votesOn"`, `from: global:<voterDid>`,
 * `to: item:<statementId>`, `fields: { value }`.
 *
 * The relation-record contract (docs/spec/08-relation-records.md) supplies the
 * guarantees the one-vote invariant needs: `createdBy` comes from the
 * authenticated identity (never the caller), the canonical id is a SHA-256
 * hash over `[createdBy, predicate, from, to]` (collision-safe, exactly one id
 * per (voter, statement)), a pre-seeded id with foreign identity fails instead
 * of succeeding idempotently, and update/delete check authorship.
 *
 * This module is the READ-side counterpart every aggregator shares: it accepts
 * only records whose endpoint is bound to their author and counts at most one
 * vote per (statement, voter) — deterministically, so all clients agree.
 */

export const VOTE_PREDICATE = "votesOn"

/** A validated vote, projected from a canonical votesOn relation record. */
export interface VoteRecord {
  /** The relation record's canonical id (`rel-<sha256>`). */
  recordId: string
  statementId: string
  voterId: string
  value: VoteValue
  createdAt: string
  /** Content hash of the statement wording this vote was cast on
      (`fields.contentHash`, spec 08 content-bound reference). */
  contentHash?: string
}

const VOTE_VALUES = new Set<string>(["green", "yellow", "red"])

export function isVoteValue(value: unknown): value is VoteValue {
  return typeof value === "string" && VOTE_VALUES.has(value)
}

/**
 * Validate + project a single record. Returns null unless:
 * - `predicate` is `votesOn`,
 * - `from` is exactly `global:<createdBy>` — the endpoint is BOUND to the
 *   author, so a record claiming someone else's endpoint never counts,
 * - `to` is a non-empty `item:` target,
 * - `fields.value` is a valid stance.
 */
export function voteFromRelationRecord(record: RelationRecord): VoteRecord | null {
  if (record.predicate !== VOTE_PREDICATE) return null
  if (record.from !== `global:${record.createdBy}`) return null
  if (!record.to.startsWith("item:")) return null
  const statementId = record.to.slice("item:".length)
  if (statementId.length === 0) return null
  const value = record.fields?.value
  if (!isVoteValue(value)) return null
  const contentHash = record.fields?.contentHash
  return {
    recordId: record.id,
    statementId,
    voterId: record.createdBy,
    value,
    createdAt: record.createdAt,
    ...(typeof contentHash === "string" ? { contentHash } : {}),
  }
}

/**
 * Vote rule 5 (modules/resonance.md): a vote counts only for the wording it
 * was cast on. `currentContentHash` is the content hash of the statement's
 * stored content — or null when the statement has no positive verdict, in
 * which case nothing counts. Votes whose hash differs are votes for another
 * version (shown to the voter, never counted); votes without a hash never
 * count. Callers pass votes that already passed claim verification.
 */
export function partitionVotesByContent(
  votes: VoteRecord[],
  currentContentHash: string | null,
): { counted: VoteRecord[]; otherVersion: VoteRecord[] } {
  if (currentContentHash === null) return { counted: [], otherVersion: [] }
  const counted: VoteRecord[] = []
  const otherVersion: VoteRecord[] = []
  for (const vote of votes) {
    if (vote.contentHash === undefined) continue
    if (vote.contentHash === currentContentHash) counted.push(vote)
    else otherVersion.push(vote)
  }
  return { counted, otherVersion }
}

/**
 * Validate a record set and enforce countability: at most ONE vote per
 * (statement, voter). Duplicate tuples (only producible by clients writing
 * past the store facade) collapse onto a deterministic winner — the
 * lexicographically smallest record id — so every client aggregates the same
 * result regardless of sync order. A duplicate only ever affects its own
 * author's counted stance.
 */
export function votesFromRelationRecords(records: RelationRecord[]): VoteRecord[] {
  const byTuple = new Map<string, VoteRecord>()
  for (const record of records) {
    const vote = voteFromRelationRecord(record)
    if (!vote) continue
    const key = `${vote.statementId}\u0000${vote.voterId}`
    const existing = byTuple.get(key)
    // Tiebreak: smallest record id, then smallest value. The value tiebreak
    // covers IDENTICAL ids surfacing twice through a cross-space read —
    // relation ids are space-local (spec 08), so the same canonical id may
    // exist as two edges in two spaces (e.g. a legacy pre-fix overview vote).
    const wins = !existing
      || vote.recordId < existing.recordId
      || (vote.recordId === existing.recordId && vote.value < existing.value)
    if (wins) byTuple.set(key, vote)
  }
  return [...byTuple.values()]
}

/** The canonical author-bound input for casting a vote via the relation store. */
export function voteRecordInput(
  voterId: string,
  statementId: string,
  value: VoteValue,
  contentHash?: string,
): RelationRecordInput {
  return {
    predicate: VOTE_PREDICATE,
    from: `global:${voterId}`,
    to: `item:${statementId}`,
    fields: contentHash === undefined ? { value } : { value, contentHash },
  }
}
