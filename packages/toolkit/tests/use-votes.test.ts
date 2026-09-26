import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { DataInterface, Item, Observable, RelationRecord, RelationRecordInput } from "@real-life-stack/data-interface"
import { itemContentHash } from "@real-life-stack/data-interface"

interface HookSlot {
  cleanup?: () => void
  deps?: readonly unknown[]
  value?: unknown
}

const harness = {
  connector: null as unknown as DataInterface,
  hookIndex: 0,
  slots: [] as HookSlot[],
}

function sameDeps(left: readonly unknown[] | undefined, right: readonly unknown[]): boolean {
  return left !== undefined && left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
}

function resetHarness(): void {
  for (const slot of harness.slots) slot?.cleanup?.()
  harness.hookIndex = 0
  harness.slots = []
}

function renderHook<T>(render: () => T): T {
  harness.hookIndex = 0
  return render()
}

/** Render twice: effects fill state slots (e.g. currentUserId) on the first pass. */
function renderHookSettled<T>(render: () => T): T {
  renderHook(render)
  return renderHook(render)
}

/** Render, flush async effects, render again — the fail-closed aggregation
    only counts after verification settles. Several rounds: record and item
    verdicts settle first, the statement's content hash after them. */
async function renderHookVerified<T>(render: () => T): Promise<T> {
  renderHook(render)
  for (let round = 0; round < 4; round++) {
    renderHook(render)
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return renderHook(render)
}

function staticObservable<T>(value: T): Observable<T> {
  return { current: value, loaded: true, subscribe: () => () => {} }
}

const ME = "did:key:me"
const OTHER = "did:key:other"
const STATEMENT = "statement-1"
const STATEMENT_ITEM: Item = {
  id: STATEMENT,
  type: "statement",
  createdBy: OTHER,
  createdAt: "2026-08-01T00:00:00.000Z",
  data: { title: "Wir treffen uns montags." },
}
/** Content hash of STATEMENT_ITEM's wording — set in beforeAll. */
let HASH = ""

function voteRecord(id: string, voter: string, value: string, overrides: Partial<RelationRecord> = {}): RelationRecord {
  return {
    id,
    predicate: "votesOn",
    from: `global:${voter}`,
    to: `item:${STATEMENT}`,
    fields: { value, contentHash: HASH },
    createdBy: voter,
    createdAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  }
}

interface FakeWrites {
  created: RelationRecordInput[]
  updated: Array<{ id: string; updates: unknown }>
  deleted: string[]
}

/**
 * Stateful record fake: writes mutate the record set, so a second serialized
 * vote() call reads the effect of the first — the double-click contract.
 */
function connector(initialRecords: RelationRecord[], opts?: { userId?: string | null; authenticatable?: boolean; verdicts?: false | ((record: RelationRecord) => "valid" | "invalid" | "trusted"); statementVerdict?: "valid" | "invalid" | "trusted" }) {
  const writes: FakeWrites = { created: [], updated: [], deleted: [] }
  const records = [...initialRecords]
  const userId = opts?.userId === undefined ? ME : opts.userId
  const matches = (filter?: { predicate?: string; to?: string }) =>
    records.filter((record) =>
      (filter?.predicate === undefined || record.predicate === filter.predicate) &&
      (filter?.to === undefined || record.to === filter.to))
  const fake: Record<string, unknown> = {
    init: async () => {},
    dispose: async () => {},
    getItems: async () => [],
    getItem: async () => null,
    observe: () => staticObservable([]),
    observeItem: (id: string) => staticObservable(id === STATEMENT ? STATEMENT_ITEM : null),
    // RelationRecordCapable
    getRelationRecords: vi.fn(async (filter?: { predicate?: string; to?: string }) => matches(filter)),
    observeRelationRecords: vi.fn((filter?: { predicate?: string; to?: string }) => staticObservable(matches(filter))),
    getRelationNeighbors: async () => [],
    observeRelationNeighbors: () => staticObservable([]),
    // RelationRecordWriterCapable — stamps createdBy like the real facade and
    // mirrors its IDEMPOTENCE: an existing record of the same canonical tuple
    // is returned UNCHANGED (fields are not reconciled — issue #211).
    createRelationRecord: vi.fn(async (input: RelationRecordInput) => {
      writes.created.push(input)
      const existing = records.find((record) =>
        record.predicate === input.predicate && record.from === input.from && record.to === input.to)
      if (existing) return existing
      const record = voteRecord(`rel-${records.length}`, userId ?? "nobody", String(input.fields?.value), {
        predicate: input.predicate,
        from: input.from,
        to: input.to,
        fields: { ...input.fields },
      })
      records.push(record)
      return record
    }),
    updateRelationRecord: vi.fn(async (id: string, updates: { fields?: Record<string, unknown> }) => {
      writes.updated.push({ id, updates })
      const record = records.find((candidate) => candidate.id === id)
      if (record && updates.fields) record.fields = updates.fields
      return record
    }),
    deleteRelationRecord: vi.fn(async (id: string) => {
      writes.deleted.push(id)
      const index = records.findIndex((candidate) => candidate.id === id)
      if (index >= 0) records.splice(index, 1)
    }),
  }
  if (opts?.verdicts !== false) {
    // Default: authoritative-style trusted verdict, overridable per record.
    const verdictFor = typeof opts?.verdicts === "function" ? opts.verdicts : () => "trusted" as const
    fake.verifyRecordClaim = vi.fn(async (record: RelationRecord) => verdictFor(record))
    // The statement stands (authoritative-style): its wording decides.
    fake.verifyItemClaim = vi.fn(async () => (opts?.statementVerdict ?? "trusted"))
  }
  if (opts?.authenticatable !== false) {
    Object.assign(fake, {
      getCurrentUser: async () => (userId ? { id: userId, displayName: "Me" } : null),
      observeCurrentUser: () => staticObservable(userId ? { id: userId, displayName: "Me" } : null),
      getUser: async (id: string) => ({ id, displayName: `Name of ${id}` }),
      getAuthState: () => staticObservable({ status: userId ? "authenticated" : "unauthenticated" }),
      getAuthMethods: () => [],
      authenticate: async () => { throw new Error("unused") },
      logout: async () => {},
    })
  }
  return { connector: fake as unknown as DataInterface, writes }
}

let hooks: typeof import("../src/hooks/use-votes")

beforeAll(async () => {
  HASH = (await itemContentHash(STATEMENT_ITEM))!
  vi.doMock("react", () => ({
    startTransition: (callback: () => void) => callback(),
    useMemo: <T>(factory: () => T, deps: readonly unknown[]) => {
      const index = harness.hookIndex++
      const previous = harness.slots[index]
      if (previous && sameDeps(previous.deps, deps)) return previous.value as T
      const value = factory()
      harness.slots[index] = { deps, value }
      return value
    },
    useCallback: <T>(callback: T, deps: readonly unknown[]) => {
      const index = harness.hookIndex++
      const previous = harness.slots[index]
      if (previous && sameDeps(previous.deps, deps)) return previous.value as T
      harness.slots[index] = { deps, value: callback }
      return callback
    },
    useState: <T>(initial: T) => {
      const index = harness.hookIndex++
      const slot = harness.slots[index] ?? (harness.slots[index] = { value: typeof initial === "function" ? (initial as () => T)() : initial })
      const setter = (next: T | ((prev: T) => T)) => {
        slot.value = typeof next === "function" ? (next as (prev: T) => T)(slot.value as T) : next
      }
      return [slot.value as T, setter] as const
    },
    useRef: <T>(initial: T) => {
      const index = harness.hookIndex++
      const slot = harness.slots[index] ?? (harness.slots[index] = { value: { current: initial } })
      return slot.value as { current: T }
    },
    useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
      const index = harness.hookIndex++
      const previous = harness.slots[index]
      if (previous && sameDeps(previous.deps, deps)) return
      previous?.cleanup?.()
      const cleanup = effect()
      harness.slots[index] = { deps, ...(typeof cleanup === "function" ? { cleanup } : {}) }
    },
  }))
  vi.doMock("../src/hooks/connector-context", () => ({
    useConnector: () => harness.connector,
  }))
  hooks = await import("../src/hooks/use-votes")
})

beforeEach(resetHarness)

describe("useVotes — write contract (auth-bound record facade)", () => {
  it("casts a vote through createRelationRecord with the canonical author-bound input — never a caller-supplied createdBy", async () => {
    const { connector: c, writes } = connector([])
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    await result.vote("green")

    expect(writes.created).toEqual([{
      predicate: "votesOn",
      from: `global:${ME}`,
      to: `item:${STATEMENT}`,
      fields: { value: "green", contentHash: HASH },
    }])
    expect("createdBy" in (writes.created[0] as object)).toBe(false)
    expect(writes.updated).toHaveLength(0)
    expect(writes.deleted).toHaveLength(0)
  })

  it("switches stance via updateRelationRecord on the OWN record — no delete/create churn", async () => {
    const mine = voteRecord("rel-mine", ME, "green")
    const { connector: c, writes } = connector([mine])
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    await result.vote("red")

    expect(writes.updated).toEqual([{ id: "rel-mine", updates: { fields: { value: "red", contentHash: HASH } } }])
    expect(writes.created).toHaveLength(0)
    expect(writes.deleted).toHaveLength(0)
  })

  it("withdraws the vote via deleteRelationRecord when the same value is cast again", async () => {
    const mine = voteRecord("rel-mine", ME, "yellow")
    const { connector: c, writes } = connector([mine])
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    await result.vote("yellow")

    expect(writes.deleted).toEqual(["rel-mine"])
    expect(writes.created).toHaveLength(0)
    expect(writes.updated).toHaveLength(0)
  })

  it("resolves rapid serialized same-value clicks against FRESH records: create, then withdraw", async () => {
    // Two quick green clicks with no re-render in between: the second must see
    // the first one's record (fresh read) and withdraw it — not compare
    // against the stale rendered myVote and vote again.
    const { connector: c, writes } = connector([])
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    await result.vote("green")
    await result.vote("green")

    expect(writes.created).toHaveLength(1)
    expect(writes.deleted).toEqual(["rel-0"])
  })

  it("repairs an existing canonical record with an INVALID value via update — no permanently optimistic vote (#211)", async () => {
    // The idempotent create returns the pre-existing broken record unchanged;
    // the hook must detect the mismatch and repair the OWN record.
    const broken = voteRecord("rel-mine", ME, "purple")
    const { connector: c, writes } = connector([broken])
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    await result.vote("green")

    expect(writes.updated).toEqual([{ id: "rel-mine", updates: { fields: { value: "green", contentHash: HASH } } }])
    expect(writes.deleted).toHaveLength(0)
  })

  it("repairs an existing canonical record with a MISSING value the same way (#211)", async () => {
    const broken = voteRecord("rel-mine", ME, "unused", { fields: {} })
    const { connector: c, writes } = connector([broken])
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    await result.vote("yellow")

    expect(writes.updated).toEqual([{ id: "rel-mine", updates: { fields: { value: "yellow", contentHash: HASH } } }])
    expect(writes.deleted).toHaveLength(0)
  })

  it("never votes anonymously: no user → no write and canVote=false", async () => {
    const { connector: c, writes } = connector([], { userId: null })
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    expect(result.canVote).toBe(false)
    await result.vote("green")
    expect(writes.created).toHaveLength(0)
  })

  it("requires Authenticatable: a writer without identity cannot vote", async () => {
    const { connector: c, writes } = connector([], { authenticatable: false })
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    expect(result.canVote).toBe(false)
    await result.vote("green")
    expect(writes.created).toHaveLength(0)
  })
})

describe("useVotes — aggregation (shared validation)", () => {
  it("aggregates the distribution and marks the own stance", async () => {
    harness.connector = connector([
      voteRecord("rel-1", OTHER, "green"),
      voteRecord("rel-2", "did:key:third", "green"),
      voteRecord("rel-3", "did:key:fourth", "red"),
      voteRecord("rel-4", ME, "yellow"),
    ]).connector
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(result.data).toEqual({ green: 2, yellow: 1, red: 1, total: 4, myVote: "yellow" })
  })

  it("ignores forged records (endpoint not bound to author) and malformed values", async () => {
    harness.connector = connector([
      voteRecord("rel-1", OTHER, "green"),
      // Forged: claims OTHER's endpoint but was written by a third DID.
      voteRecord("rel-2", OTHER, "red", { createdBy: "did:key:mallory" }),
      voteRecord("rel-3", "did:key:third", "purple"),
    ]).connector
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(result.data).toEqual({ green: 1, yellow: 0, red: 0, total: 1 })
  })

  it("counts at most one vote per voter even when duplicate records exist", async () => {
    harness.connector = connector([
      voteRecord("rel-b", OTHER, "green"),
      voteRecord("rel-a", OTHER, "red"),
    ]).connector
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(result.data.total).toBe(1)
    expect(result.data.red).toBe(1) // deterministic winner: smallest record id
  })
})

describe("useVotes — claim verdicts (fail closed, spec 08 L1-L3)", () => {
  it("counts only after verification settles — fail closed from the first frame", async () => {
    harness.connector = connector([voteRecord("rel-1", OTHER, "green")]).connector
    // First frames: verdicts pending → nothing counts.
    const early = renderHookSettled(() => hooks.useVotes(STATEMENT))
    expect(early.data.total).toBe(0)
    // After the verdict effect settles: counted (monotone unverified→counted).
    const settled = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(settled.data).toEqual({ green: 1, yellow: 0, red: 0, total: 1 })
  })

  it("invalid records never count", async () => {
    harness.connector = connector([
      voteRecord("rel-good", OTHER, "green"),
      voteRecord("rel-bad", "did:key:third", "red"),
    ], { verdicts: (record) => (record.id === "rel-bad" ? "invalid" : "valid") }).connector
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(result.data).toEqual({ green: 1, yellow: 0, red: 0, total: 1 })
  })

  it("a connector WITHOUT the verification capability yields an empty authorial aggregate", async () => {
    harness.connector = connector([voteRecord("rel-1", OTHER, "green")], { verdicts: false }).connector
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(result.data.total).toBe(0)
  })
})

describe("useVotes — a vote counts for one wording (resonance.md, vote rule 5)", () => {
  it("counts only votes on the current wording; the own earlier vote shows as myVoteOtherVersion", async () => {
    harness.connector = connector([
      voteRecord("rel-1", "did:key:third", "green"),
      voteRecord("rel-2", "did:key:fourth", "red", { fields: { value: "red", contentHash: "sha256:earlier" } }),
      voteRecord("rel-3", "did:key:fifth", "red", { fields: { value: "red" } }),
      voteRecord("rel-4", ME, "yellow", { fields: { value: "yellow", contentHash: "sha256:earlier" } }),
    ]).connector
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(result.data).toEqual({ green: 1, yellow: 0, red: 0, total: 1, myVoteOtherVersion: "yellow" })
  })

  it("re-voting the same stance on a NEW wording renews the hash instead of withdrawing", async () => {
    const mine = voteRecord("rel-mine", ME, "yellow", { fields: { value: "yellow", contentHash: "sha256:earlier" } })
    const { connector: c, writes } = connector([mine])
    harness.connector = c
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    await result.vote("yellow")
    expect(writes.updated).toEqual([{ id: "rel-mine", updates: { fields: { value: "yellow", contentHash: HASH } } }])
    expect(writes.deleted).toHaveLength(0)
  })

  it("repairs an idempotent create that returns the own record with a stale hash", async () => {
    const stale = voteRecord("rel-mine", ME, "green", { fields: { value: "green", contentHash: "sha256:earlier" } })
    const { connector: c, writes } = connector([stale])
    // Fresh read misses it (e.g. not yet synced), the create hits it.
    ;(c as unknown as { getRelationRecords: ReturnType<typeof vi.fn> }).getRelationRecords.mockImplementation(async () => [])
    harness.connector = c
    const result = renderHookSettled(() => hooks.useVotes(STATEMENT))
    await result.vote("green")
    expect(writes.updated).toEqual([{ id: "rel-mine", updates: { fields: { value: "green", contentHash: HASH } } }])
  })

  it("an own vote WITHOUT a hash does not count but is shown to its voter", async () => {
    harness.connector = connector([voteRecord("rel-4", ME, "green", { fields: { value: "green" } })]).connector
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(result.data).toEqual({ green: 0, yellow: 0, red: 0, total: 0, myVoteOtherVersion: "green" })
  })

  it("no vote counts on a statement without a positive verdict", async () => {
    harness.connector = connector([
      voteRecord("rel-1", OTHER, "green"),
      voteRecord("rel-2", ME, "red"),
    ], { statementVerdict: "invalid" }).connector
    const result = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    // Nothing counts, and the own vote is not an "earlier version" either.
    expect(result.data).toEqual({ green: 0, yellow: 0, red: 0, total: 0 })
  })
})

describe("useVotes — verdict binds CONTENT, not just the record id (#235 review)", () => {
  it("a content change under the same id does NOT reuse the old valid verdict", async () => {
    const record = voteRecord("rel-1", OTHER, "green")
    // Emit-capable observable, like the real record stream.
    let current = [record]
    const listeners = new Set<(value: RelationRecord[]) => void>()
    const live = {
      get current() { return current },
      loaded: true,
      subscribe: (callback: (value: RelationRecord[]) => void) => {
        listeners.add(callback)
        return () => listeners.delete(callback)
      },
    }
    const { connector: c } = connector([record], {
      // Content-dependent verdict: green is valid, red is invalid.
      verdicts: (candidate) => ((candidate.fields as { value?: string }).value === "green" ? "valid" : "invalid"),
    })
    ;(c as unknown as { observeRelationRecords: ReturnType<typeof vi.fn> }).observeRelationRecords
      .mockImplementation(() => live)
    harness.connector = c
    const counted = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(counted.data.total).toBe(1)

    // A manipulated peer write: SAME id, changed content, emitted as a new
    // array — exactly what the real observable does.
    current = [{ ...record, fields: { value: "red", contentHash: HASH } }]
    for (const listener of listeners) listener(current)

    // FAIL CLOSED immediately: the stale id-keyed verdict must not carry
    // over to different content — even BEFORE re-verification settles.
    const early = renderHook(() => hooks.useVotes(STATEMENT))
    expect(early.data.total).toBe(0)

    // And after settling, the invalid verdict keeps it out.
    const settled = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(settled.data.total).toBe(0)
  })
})

describe("useVotes — verdicts are bound to the connector instance (#235 round 2)", () => {
  it("a connector switch drops prior verdicts synchronously — fail closed on the first frame", async () => {
    const records = [voteRecord("rel-1", OTHER, "green")]
    harness.connector = connector(records).connector
    const counted = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(counted.data.total).toBe(1)

    // New connector instance, same records: the previous instance's verdicts
    // must not carry over for even one frame.
    harness.connector = connector(records).connector
    const early = renderHook(() => hooks.useVotes(STATEMENT))
    expect(early.data.total).toBe(0)

    const settled = await renderHookVerified(() => hooks.useVotes(STATEMENT))
    expect(settled.data.total).toBe(1)
  })
})

describe("useVoteUsers — transparent voter list", () => {
  it("subscribes to the records observable instead of a one-shot read", () => {
    const { connector: c } = connector([voteRecord("rel-1", OTHER, "green")])
    const subscribeSpy = vi.fn(() => () => {})
    const observeSpy = (c as unknown as { observeRelationRecords: ReturnType<typeof vi.fn> }).observeRelationRecords
    observeSpy.mockImplementation(() => ({
      current: [voteRecord("rel-1", OTHER, "green")],
      loaded: true,
      subscribe: subscribeSpy,
    }))
    harness.connector = c
    renderHookSettled(() => hooks.useVoteUsers(STATEMENT))
    expect(observeSpy).toHaveBeenCalled()
    // The reactive contract: the hook actually SUBSCRIBES — a later record
    // change re-renders the voter list, it is not a one-shot read.
    expect(subscribeSpy).toHaveBeenCalled()
  })
})
