import type { Item, RelationRecord } from "./index.js"
import {
  isAuthorialItemType,
  itemContent,
  jcsCanonicalize,
  signItemClaim,
  type ClaimSigner,
} from "./claims.js"
import { relationRecordFromItem } from "./relation-records.js"

/**
 * The write path for authorial items (spec 08 → "Aussagen einer Person",
 * Schreibweg). Every connector calls these from its generic createItem /
 * updateItem — they are driven by the catalog alone and contain no
 * type-specific logic. The connector owns `data.claim`: callers never set it.
 */

/** How a connector writes claims: `signed` connectors sign with the
    authenticated identity; `authoritative` stores write none (spec 08). */
export interface AuthoredIngress {
  /** The authenticated identity performing the write. */
  actorId: string
  mode: "signed" | "authoritative"
  /** The identity's signer — required in `signed` mode for catalog types. */
  signer: ClaimSigner | null
}

/**
 * Frozen (spec 08 → Einfrieren): another person holds a content-bound
 * reference — a relation record carrying `fields.contentHash` — to the item.
 * Callers pass the relation items they can see for the item's space.
 */
export function isFrozen(target: Pick<Item, "id" | "createdBy">, items: Iterable<Item>): boolean {
  const records: RelationRecord[] = []
  for (const item of items) {
    if (item.type !== "relation") continue
    const record = relationRecordFromItem(item)
    if (record) records.push(record)
  }
  return isFrozenByRecords(target, records)
}

/** {@link isFrozen} over relation records, for surfaces that observe the
    record projection (e.g. to hide „Bearbeiten" on a frozen item). */
export function isFrozenByRecords(target: Pick<Item, "id" | "createdBy">, records: Iterable<RelationRecord>): boolean {
  for (const record of records) {
    if (record.to !== `item:${target.id}`) continue
    if (typeof record.fields?.contentHash !== "string") continue
    if (record.createdBy !== target.createdBy) return true
  }
  return false
}

const withoutClaim = (data: Record<string, unknown> | undefined): Record<string, unknown> => {
  const { claim: _ignored, ...rest } = data ?? {}
  return rest
}

/**
 * Create path, authoritative stores: for catalog types a caller-supplied
 * claim is dropped (authoritative stores write none). Synchronous, so it can
 * run inside a store transaction.
 */
export function withoutAuthoredClaim<T extends { type: string; data?: Record<string, unknown> }>(item: T): T {
  if (!isAuthorialItemType(item.type)) return item
  return { ...item, data: withoutClaim(item.data) }
}

/**
 * Create path. `item` is the item exactly as it will be stored — id,
 * createdAt and createdBy already set by the connector. For catalog types a
 * caller-supplied claim is dropped and, in `signed` mode, replaced by the
 * identity's signature. Other types pass through untouched (a relation
 * record keeps the claim its facade wrote).
 */
export async function withAuthoredCreateClaim(item: Item, ingress: AuthoredIngress): Promise<Item> {
  if (!isAuthorialItemType(item.type)) return item
  const clean = withoutAuthoredClaim(item)
  if (ingress.mode === "authoritative") return clean
  if (!ingress.signer) {
    throw new Error(`Creating a ${item.type} needs the signing identity — it is never written unsigned (spec 08)`)
  }
  return { ...clean, data: { ...clean.data, claim: await signItemClaim(clean, ingress.signer) } } as Item
}

/** Updates to apply plus the content they were planned against. */
export interface AuthoredUpdatePlan {
  updates: Partial<Item>
  /** JCS of the content the plan was based on; the connector re-checks it
      inside its write transaction ({@link assertAuthoredCommitAllowed}). */
  contentGuard: string | null
  /** Whether the plan changes the content — then the freeze is re-checked
      at commit, because a foreign vote may arrive while signing. */
  changesContent: boolean
}

const contentKey = (item: Item): string => jcsCanonicalize(itemContent(item))

interface ResolvedUpdate {
  updates: Partial<Item>
  base: string
  /** Set when the content changes: the item as it will be stored. */
  changed: Item | null
}

function resolveAuthoredUpdate(existing: Item, updates: Partial<Item>, actorId: string, frozen: boolean): ResolvedUpdate {
  const nextData = withoutClaim(updates.data !== undefined ? updates.data : existing.data)
  const next = {
    ...existing,
    data: nextData,
    ...(updates.relations !== undefined ? { relations: updates.relations } : {}),
  } as Item
  const base = contentKey(existing)

  if (contentKey(next) === base) {
    if (updates.data === undefined) return { updates, base, changed: null }
    const keep = existing.data?.claim !== undefined ? { claim: existing.data.claim } : {}
    return { updates: { ...updates, data: { ...nextData, ...keep } }, base, changed: null }
  }

  if (actorId !== existing.createdBy) {
    throw new Error(`Only the author may change the content of a ${existing.type}`)
  }
  if (frozen) {
    throw new Error(
      `This ${existing.type} is frozen: another person has bound a reference to its content — create a new version instead`,
    )
  }
  return { updates: { ...updates, data: nextData }, base, changed: next }
}

/**
 * Update path, authoritative stores (no claims). Same rules as
 * {@link planAuthoredUpdate}, synchronous so it runs inside the store's
 * transaction against the atomically read row.
 */
export function authoredUpdateAuthoritative(
  existing: Item,
  updates: Partial<Item>,
  actorId: string,
  frozen: boolean,
): Partial<Item> {
  if (!isAuthorialItemType(existing.type)) return updates
  return resolveAuthoredUpdate(existing, updates, actorId, frozen).updates
}

/**
 * Update path. Changes outside the content are open to everyone under the
 * general item rules and keep the existing claim — also when `updates.data`
 * replaces the whole data object. A content change (content fields or
 * content relations) is the author's alone, is refused while the item is
 * frozen, and is re-signed in `signed` mode. A caller-supplied claim is
 * always ignored. `frozen` comes from {@link isFrozen}.
 */
export async function planAuthoredUpdate(
  existing: Item,
  updates: Partial<Item>,
  ingress: AuthoredIngress,
  frozen: boolean,
): Promise<AuthoredUpdatePlan> {
  if (!isAuthorialItemType(existing.type)) return { updates, contentGuard: null, changesContent: false }
  const resolved = resolveAuthoredUpdate(existing, updates, ingress.actorId, frozen)
  const changesContent = resolved.changed !== null
  if (resolved.changed === null || ingress.mode === "authoritative") {
    return { updates: resolved.updates, contentGuard: resolved.base, changesContent }
  }
  if (!ingress.signer) {
    throw new Error(`Changing a ${existing.type} needs the signing identity — it is never written unsigned (spec 08)`)
  }
  const claim = await signItemClaim(resolved.changed, ingress.signer)
  return {
    updates: { ...resolved.updates, data: { ...resolved.changed.data, claim } },
    contentGuard: resolved.base,
    changesContent,
  }
}

/**
 * Concurrency guard: signing happens before the (synchronous) write
 * transaction, so the connector re-checks inside it that the content is
 * still the one the plan was based on. Throws when it changed in between.
 */
export function assertContentUnchanged(current: Item, contentGuard: string | null): void {
  if (contentGuard === null) return
  if (contentKey(current) !== contentGuard) {
    throw new Error(`The content of ${current.type} ${current.id} changed concurrently — retry the update`)
  }
}

/**
 * Commit guard for a plan made outside the write transaction (spec 08):
 * inside the transaction, immediately before the first mutation, the content
 * must still be the planned one and — for a content change — the item must
 * not have been frozen in the meantime by a content-bound reference that
 * arrived while signing (#497). Changes outside the content stay allowed.
 * Covers what the local handle already sees; it does not serialise against
 * devices that have not synced yet.
 */
export function assertAuthoredCommitAllowed(
  current: Item,
  plan: Pick<AuthoredUpdatePlan, "contentGuard" | "changesContent">,
  relationItems: Iterable<Item>,
): void {
  assertContentUnchanged(current, plan.contentGuard)
  if (plan.changesContent && isFrozen(current, relationItems)) {
    throw new Error(
      `This ${current.type} is frozen: another person has bound a reference to its content — create a new version instead`,
    )
  }
}
