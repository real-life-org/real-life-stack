import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react"
import type { ClaimVerdict, DataInterface, Item, RelationRecord, VoteRecord, VoteValue } from "@real-life-stack/data-interface"
import {
  VOTE_PREDICATE,
  partitionVotesByContent,
  hasClaimVerification,
  hasRelationRecords,
  hasRelationRecordWriter,
  isAuthenticatable,
  jcsCanonicalize,
  relationAuthorialPayload,
  voteRecordInput,
  votesFromRelationRecords,
} from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"
import { useCountingContentHashes } from "./use-item-standing"

/**
 * Claim-verdict filter (spec 08 L1–L3): returns only records the connector
 * vouches for (`valid` or `trusted`) — FAIL CLOSED from the first frame:
 * pending verification counts like invalid, connectors without the
 * verification capability yield an empty authorial aggregate, and the
 * transition is monotone (unverified → counted, never back for unchanged
 * records). The aggregator owns re-emission: state updates re-render
 * consumers once verification settles.
 */
/** Verdict key binds id + claim + SEMANTIC CONTENT — a stale id-keyed
    verdict must never carry over to changed content (a manipulated peer
    write would briefly count with the old "valid"). Null = unverifiable. */
function verdictKey(record: RelationRecord): string | null {
  try {
    return `${record.id}|${record.claim ?? ""}|${jcsCanonicalize(relationAuthorialPayload(record))}`
  } catch {
    return null
  }
}

const EMPTY_VERDICTS: ReadonlyMap<string, ClaimVerdict> = new Map()

/**
 * Which of those are cryptographically covered?
 *
 * @answers `RelationRecord[]`
 * @without empty — also while checking
 * @group relations
 * @see story rls-foundations-hooks--relations
 * @see spec docs/spec/08-relation-records.md
 */
export function useVerifiedRelationRecords(records: RelationRecord[]): RelationRecord[] {
  const connector = useConnector()
  const canVerify = hasClaimVerification(connector)
  // Verdicts are bound to the CONNECTOR INSTANCE (verification epoch): a
  // connector switch must not let the previous instance's verdicts count
  // for even one frame — the pair is read synchronously below.
  const [state, setState] = useState<{ source: DataInterface | null; verdicts: ReadonlyMap<string, ClaimVerdict> }>({ source: null, verdicts: EMPTY_VERDICTS })

  useEffect(() => {
    if (!canVerify || records.length === 0) return
    let cancelled = false
    ;(async () => {
      const entries: Array<readonly [string, ClaimVerdict]> = []
      for (const record of records) {
        const key = verdictKey(record)
        if (key === null) continue
        let verdict: ClaimVerdict
        try {
          verdict = await (connector as DataInterface & { verifyRecordClaim(r: RelationRecord): Promise<ClaimVerdict> }).verifyRecordClaim(record)
        } catch {
          // A rejecting verifier is an invalid record, never an unhandled gap.
          verdict = "invalid"
        }
        entries.push([key, verdict])
      }
      if (!cancelled) startTransition(() => setState({ source: connector, verdicts: new Map(entries) }))
    })()
    return () => { cancelled = true }
  }, [connector, canVerify, records])

  return useMemo(() => {
    if (!canVerify) return []
    // Epoch check: verdicts from a different connector instance are void.
    const verdicts = state.source === connector ? state.verdicts : EMPTY_VERDICTS
    return records.filter((record) => {
      const key = verdictKey(record)
      if (key === null) return false
      const verdict = verdicts.get(key)
      return verdict === "valid" || verdict === "trusted"
    })
  }, [canVerify, connector, records, state])
}

/** The statement item, reactive — its wording decides which votes count. */
function useStatement(statementId: string): Item | null {
  const connector = useConnector()
  const observable = useMemo(() => connector.observeItem(statementId), [connector, statementId])
  const [statement, setStatement] = useState<Item | null>(observable.current)
  useEffect(() => {
    setStatement(observable.current)
    return observable.subscribe((next) => startTransition(() => setStatement(next)))
  }, [observable])
  return statement
}

/**
 * Vote rule 5 (resonance.md): of the verified votes, only those cast on the
 * CURRENT wording of a statement with a positive verdict count. The others
 * are votes for another version — shown to their voter, never counted.
 */
function useVotesForWording(statementId: string, verifiedRecords: RelationRecord[]) {
  const statement = useStatement(statementId)
  const statements = useMemo(() => (statement ? [statement] : []), [statement])
  const contentHash = useCountingContentHashes(statements).get(statementId) ?? null
  const partition = useMemo(() => {
    const all = votesFromRelationRecords(verifiedRecords)
    const { counted } = partitionVotesByContent(all, contentHash)
    const countedIds = new Set(counted.map((vote) => vote.recordId))
    // Everything verified that does not count for this wording: votes for an
    // earlier version and votes without a hash. Shown to their voter only.
    return { counted, notCounted: all.filter((vote) => !countedIds.has(vote.recordId)) }
  }, [verifiedRecords, contentHash])
  return { statement, contentHash, ...partition }
}

/** Aggregated vote distribution for a statement. */
export interface VoteSummary {
  green: number
  yellow: number
  red: number
  total: number
  /** The current user's stance, if any. */
  myVote?: VoteValue
  /** The current user's stance on an EARLIER wording (or a vote without a
      content hash): it does not count until they vote again (resonance.md,
      vote rule 5). */
  myVoteOtherVersion?: VoteValue
}

/** Return value of useVotes hook. */
export interface UseVotesResult {
  data: VoteSummary
  /** Set or toggle the current user's vote. Same value = withdraw, different value = switch. */
  vote: (value: VoteValue) => Promise<void>
  isLoading: boolean
  /** Whether the current user can vote (authenticated + connector has the record writer). */
  canVote: boolean
}

/**
 * How does the resonance stand, and how do I vote?
 *
 * Hook for reading and casting votes on a statement (Resonance module).
 *
 * Votes are RELATION RECORDS written through the auth-bound relation store
 * (docs/spec/08-relation-records.md): `createdBy` comes from the authenticated
 * identity, the canonical hash id binds (voter, statement) — one record per
 * tuple, structurally. The read side accepts only validated records
 * (`votesFromRelationRecords`): endpoint bound to the author, at most one
 * counted vote per (statement, voter). A vote counts only for the current
 * wording of a statement with a positive verdict: it carries the wording's
 * content hash (`fields.contentHash`), and votes for an earlier wording show
 * up as `myVoteOtherVersion` for their voter. See
 * docs/spec/modules/resonance.md (vote rule 5).
 *
 * @answers `{data, isLoading, vote, canVote}`
 * @without empty — without signature verification no vote counts
 * @group relations
 * @see story rls-foundations-hooks--relations
 * @see spec docs/spec/08-relation-records.md
 */
export function useVotes(statementId: string): UseVotesResult {
  const connector = useConnector()
  const canRead = hasRelationRecords(connector)
  const recordsObservable = useMemo(
    () => (canRead
      ? connector.observeRelationRecords({ predicate: VOTE_PREDICATE, to: `item:${statementId}` })
      : null),
    [canRead, connector, statementId],
  )
  const [records, setRecords] = useState<RelationRecord[]>(recordsObservable?.current ?? [])
  useEffect(() => {
    if (!recordsObservable) return
    setRecords(recordsObservable.current)
    return recordsObservable.subscribe((next) => startTransition(() => setRecords(next)))
  }, [recordsObservable])

  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!isAuthenticatable(connector)) return
    const observable = connector.observeCurrentUser()
    setCurrentUserId(observable.current?.id)
    return observable.subscribe((user) => setCurrentUserId(user?.id))
  }, [connector])

  // Votes are identity-bound and transparent — never written as "anonymous".
  // Without Authenticatable there is no identity, hence no voting.
  const canWrite = hasRelationRecordWriter(connector)
  const verifiedRecords = useVerifiedRelationRecords(records)
  const { contentHash, counted: votes, notCounted } = useVotesForWording(statementId, verifiedRecords)
  // Voting needs a COUNTING wording: the verified content hash of a statement
  // with a positive verdict — never a hash computed from unverified content.
  const canVote = canWrite && canRead && isAuthenticatable(connector) && currentUserId !== undefined && contentHash !== null

  // Optimistic overlay for the own vote: applied on click, dropped as soon as
  // the records observable reflects the write. Bound to the wording it was
  // cast on: once that wording no longer counts (changed content, lost
  // verdict), the overlay is void and never counts.
  const [rawPending, setPending] = useState<{ value: VoteValue | null; contentHash: string } | null>(null)
  const pending = rawPending !== null && rawPending.contentHash === contentHash ? rawPending : null

  const persistedMyVote = useMemo(
    () => (currentUserId ? votes.find((vote) => vote.voterId === currentUserId)?.value : undefined),
    [votes, currentUserId],
  )
  const myVote = pending ? pending.value ?? undefined : persistedMyVote

  useEffect(() => {
    if (!rawPending) return
    if (!pending || (pending.value ?? undefined) === persistedMyVote) setPending(null)
  }, [rawPending, pending, persistedMyVote])

  const summary: VoteSummary = useMemo(() => {
    const result: VoteSummary = { green: 0, yellow: 0, red: 0, total: 0 }
    for (const vote of votes) {
      if (pending && currentUserId && vote.voterId === currentUserId) continue
      result[vote.value] += 1
      result.total += 1
    }
    if (pending?.value) {
      result[pending.value] += 1
      result.total += 1
    }
    if (myVote) result.myVote = myVote
    // Only against a counting wording: on a statement without a positive
    // verdict nothing counts, and "earlier version" would be wrong.
    const mineElsewhere = currentUserId && !myVote && contentHash !== null
      ? notCounted.find((vote) => vote.voterId === currentUserId)?.value
      : undefined
    if (mineElsewhere) result.myVoteOtherVersion = mineElsewhere
    return result
  }, [votes, notCounted, contentHash, pending, currentUserId, myVote])

  // Latest-wins + write chain, mirroring use-reactions.
  const latestRef = useRef(0)
  const chainRef = useRef<Promise<void>>(Promise.resolve())

  const performVote = useCallback(async (value: VoteValue) => {
    if (!hasRelationRecordWriter(connector) || !hasRelationRecords(connector)) return
    if (!isAuthenticatable(connector)) return

    // The vote binds the wording on display (resonance.md → Aktionen) — the
    // verified, counting one. Without it there is nothing to vote on.
    if (contentHash === null) return

    const requestId = ++latestRef.current
    // Optimistic feedback from the rendered state; the WRITE decision below
    // uses freshly read records, so serialized double-clicks resolve against
    // the true current stance, not a stale render.
    setPending({ value: myVote === value ? null : value, contentHash })

    try {
      const userId = currentUserId ?? (await connector.getCurrentUser())?.id
      if (userId === undefined) {
        if (latestRef.current === requestId) setPending(null)
        return
      }
      const freshRecords = await connector.getRelationRecords({
        predicate: VOTE_PREDICATE,
        to: `item:${statementId}`,
      })
      if (latestRef.current !== requestId) return
      const existingMine = votesFromRelationRecords(freshRecords)
        .find((vote) => vote.voterId === userId)

      if (existingMine) {
        if (existingMine.value === value && existingMine.contentHash === contentHash) {
          // Same stance on the same wording again — withdraw the own vote.
          if (latestRef.current === requestId) setPending({ value: null, contentHash })
          await connector.deleteRelationRecord(existingMine.recordId)
        } else {
          // Stance change, or a vote for an earlier wording renewed: update
          // the OWN record — the canonical id stays stable.
          await connector.updateRelationRecord(existingMine.recordId, { fields: { value, contentHash } })
        }
        return
      }
      const created = await connector.createRelationRecord(voteRecordInput(userId, statementId, value, contentHash))
      // Idempotent create returns a PRE-EXISTING canonical record UNCHANGED —
      // including one with an invalid or missing fields.value (or a stale
      // hash) that the validated read path rightly ignores (#211). Detect the
      // mismatch and repair the OWN record, otherwise the optimistic vote
      // never converges.
      if (created.fields?.value !== value || created.fields?.contentHash !== contentHash) {
        await connector.updateRelationRecord(created.id, { fields: { value, contentHash } })
      }
    } catch {
      if (latestRef.current === requestId) setPending(null)
    }
  }, [connector, statementId, contentHash, myVote, currentUserId])

  const vote = useCallback((value: VoteValue) => {
    const next = chainRef.current.then(() => performVote(value))
    chainRef.current = next.catch(() => undefined)
    return next
  }, [performVote])

  return { data: summary, vote, isLoading: recordsObservable === null, canVote }
}

/** Voter entry for the transparent voter list — votes are transparent by design. */
export interface VoteUser {
  id: string
  displayName: string
  avatarUrl?: string
  value: VoteValue
}

export interface UseVoteUsersResult {
  data: VoteUser[]
  isLoading: boolean
}

/**
 * Who voted how?
 *
 * Reactive list of voters (with stance) for a statement: subscribes to the
 * vote records and re-resolves display names when the set changes.
 *
 * @answers `{data, isLoading}`
 * @without empty
 * @group relations
 * @see story rls-foundations-hooks--relations
 * @see spec docs/spec/08-relation-records.md
 */
export function useVoteUsers(statementId: string, enabled = true): UseVoteUsersResult {
  const connector = useConnector()
  const canRead = hasRelationRecords(connector)
  const recordsObservable = useMemo(
    () => (enabled && canRead
      ? connector.observeRelationRecords({ predicate: VOTE_PREDICATE, to: `item:${statementId}` })
      : null),
    [enabled, canRead, connector, statementId],
  )
  const [records, setRecords] = useState<RelationRecord[]>(recordsObservable?.current ?? [])
  useEffect(() => {
    if (!recordsObservable) return
    setRecords(recordsObservable.current)
    return recordsObservable.subscribe((next) => startTransition(() => setRecords(next)))
  }, [recordsObservable])

  const verifiedRecords = useVerifiedRelationRecords(records)
  const { counted } = useVotesForWording(statementId, verifiedRecords)
  const votes = useMemo(
    () => [...counted].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [counted],
  )

  const [users, setUsers] = useState<VoteUser[]>([])
  const [isLoading, setIsLoading] = useState(enabled)

  useEffect(() => {
    if (!recordsObservable) {
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    ;(async () => {
      try {
        const resolved = await Promise.all(
          votes.map(async (vote: VoteRecord) => {
            const user = isAuthenticatable(connector) ? await connector.getUser(vote.voterId) : null
            return {
              id: vote.voterId,
              displayName: user?.displayName ?? vote.voterId,
              avatarUrl: user?.avatarUrl,
              value: vote.value,
            }
          }),
        )
        if (!cancelled) setUsers(resolved)
      } catch {
        if (!cancelled) setUsers([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [connector, recordsObservable, votes])

  return { data: users, isLoading }
}
