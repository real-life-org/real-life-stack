import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { votesFromRelationRecords } from "@real-life-stack/data-interface"

/**
 * Reihenfolge der Aussagen im Resonanz-Modul.
 *
 * Resonanz ist ein Kernmodul (module-register), seine Sortierung folgt der
 * Spezifikation (docs/spec/modules/resonance.md → Sortierungen). Sie lag bis
 * 19.09.2026 in der Referenz-App; jede andere App hätte sie nachbauen müssen.
 */

/** Sort modes of the Resonance view (docs/spec/modules/resonance.md → Sortierungen). */
export type ResonanceSortMode = "newest" | "votes" | "approval" | "activity"

export interface StatementVoteStats {
  green: number
  yellow: number
  red: number
  total: number
  /** ISO timestamp of the most recent vote, null when unvoted. */
  lastVoteAt: string | null
}

/**
 * Group vote records by statement, using the SHARED validation
 * (`votesFromRelationRecords`): only author-bound canonical records count,
 * at most one per (statement, voter) — the same contract the per-statement
 * aggregation in useVotes applies, so list order and card counts agree.
 * A vote counts only for the current wording (resonance.md, vote rule 5):
 * `contentHashes` maps each COUNTING statement to its content hash
 * (`useCountingContentHashes`); votes for other versions, votes without a
 * hash and votes on statements absent from the map never count.
 */
export function aggregateVoteStats(
  records: RelationRecord[],
  contentHashes: ReadonlyMap<string, string>,
): Map<string, StatementVoteStats> {
  const stats = new Map<string, StatementVoteStats>()
  for (const vote of votesFromRelationRecords(records)) {
    const current = contentHashes.get(vote.statementId)
    if (current === undefined || vote.contentHash !== current) continue
    const entry = stats.get(vote.statementId) ?? { green: 0, yellow: 0, red: 0, total: 0, lastVoteAt: null }
    entry[vote.value] += 1
    entry.total += 1
    if (entry.lastVoteAt === null || vote.createdAt > entry.lastVoteAt) entry.lastVoteAt = vote.createdAt
    stats.set(vote.statementId, entry)
  }
  return stats
}

const EMPTY_STATS: StatementVoteStats = { green: 0, yellow: 0, red: 0, total: 0, lastVoteAt: null }

/** Approval = share of green among all votes; unvoted counts as 0. */
function approvalShare(s: StatementVoteStats): number {
  return s.total === 0 ? 0 : s.green / s.total
}

/**
 * Sort statements per the spec's tiebreaker chains. Comparators return the
 * FIRST non-zero difference in the chain; every chain ends on `createdAt`
 * desc so the order is total and stable across clients.
 */
export function sortStatements(
  statements: Item[],
  stats: Map<string, StatementVoteStats>,
  mode: ResonanceSortMode,
): Item[] {
  const of = (item: Item) => stats.get(item.id) ?? EMPTY_STATS
  const lastVote = (s: StatementVoteStats) => s.lastVoteAt ?? ""
  const chains: Record<ResonanceSortMode, ((a: Item, b: Item) => number)[]> = {
    newest: [
      (a, b) => b.createdAt.localeCompare(a.createdAt),
      (a, b) => lastVote(of(b)).localeCompare(lastVote(of(a))),
      (a, b) => of(b).total - of(a).total,
    ],
    votes: [
      (a, b) => of(b).total - of(a).total,
      (a, b) => approvalShare(of(b)) - approvalShare(of(a)),
      (a, b) => lastVote(of(b)).localeCompare(lastVote(of(a))),
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    ],
    approval: [
      (a, b) => approvalShare(of(b)) - approvalShare(of(a)),
      (a, b) => of(b).total - of(a).total,
      (a, b) => lastVote(of(b)).localeCompare(lastVote(of(a))),
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    ],
    activity: [
      (a, b) => lastVote(of(b)).localeCompare(lastVote(of(a))),
      (a, b) => of(b).total - of(a).total,
      (a, b) => approvalShare(of(b)) - approvalShare(of(a)),
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    ],
  }
  const chain = chains[mode]
  return [...statements].sort((a, b) => {
    for (const compare of chain) {
      const diff = compare(a, b)
      if (diff !== 0) return diff
    }
    return 0
  })
}
