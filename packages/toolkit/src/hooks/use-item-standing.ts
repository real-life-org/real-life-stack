import { useEffect, useMemo, useState, startTransition } from "react"
import type { ClaimVerdict, DataInterface, Item, ItemStanding } from "@real-life-stack/data-interface"
import {
  hasItemClaimVerification,
  isAuthorialItemType,
  itemContent,
  itemContentHash,
  itemStanding,
  jcsCanonicalize,
  standingCounts,
} from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

/** Verdict key binds everything the item claim signs — a verdict must never
    carry over to changed content, author or claim. */
function verdictKey(item: Item): string {
  return [
    item.id,
    item.type,
    item.createdBy,
    item.createdAt,
    typeof item.data?.claim === "string" ? item.data.claim : "",
    jcsCanonicalize(itemContent(item)),
  ].join("\u0000")
}

const EMPTY: ReadonlyMap<string, ClaimVerdict> = new Map()

/**
 * Is this statement, comment or reaction backed?
 *
 * Standing per item of a catalog type (spec 08 → Beleg erforderlich):
 * `attested`, `unsigned` (no claim, type requires none — shown, counted,
 * subtly marked) or `invalid` (never counted). FAIL CLOSED: while the verdict
 * is pending, or when the connector cannot verify, an item with a claim or of
 * a type that requires proof is `invalid`. Items outside the catalog are
 * absent from the map.
 *
 * @answers `ReadonlyMap<itemId, ItemStanding>`
 * @without verdicts — only unsigned items of types without proof requirement stand
 * @group relations
 * @see spec docs/spec/08-relation-records.md
 */
export function useItemStandings(items: readonly Item[]): ReadonlyMap<string, ItemStanding> {
  const connector = useConnector()
  // Callers often pass a fresh array per render (a `[]` default, a filter):
  // everything below follows the CONTENT of the list, not its identity.
  const listKey = items.map(verdictKey).join("\u0001")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableItems = useMemo(() => items, [listKey])
  const canVerify = hasItemClaimVerification(connector)
  // Verdicts are bound to the connector instance (verification epoch).
  const [state, setState] = useState<{ source: DataInterface | null; verdicts: ReadonlyMap<string, ClaimVerdict> }>({ source: null, verdicts: EMPTY })

  useEffect(() => {
    if (!canVerify) return
    const authorial = stableItems.filter((item) => isAuthorialItemType(item.type))
    if (authorial.length === 0) return
    let cancelled = false
    ;(async () => {
      const entries: Array<readonly [string, ClaimVerdict]> = []
      for (const item of authorial) {
        let verdict: ClaimVerdict
        try {
          verdict = await connector.verifyItemClaim(item)
        } catch {
          verdict = "invalid"
        }
        entries.push([verdictKey(item), verdict])
      }
      if (!cancelled) startTransition(() => setState({ source: connector, verdicts: new Map(entries) }))
    })()
    return () => { cancelled = true }
  }, [connector, canVerify, stableItems])

  return useMemo(() => {
    const verdicts = canVerify && state.source === connector ? state.verdicts : EMPTY
    const standings = new Map<string, ItemStanding>()
    for (const item of stableItems) {
      const standing = itemStanding(item, verdicts.get(verdictKey(item)))
      if (standing !== null) standings.set(item.id, standing)
    }
    return standings
  }, [canVerify, connector, stableItems, state])
}

/**
 * Which wording does a vote have to match?
 *
 * Content hash per counting item (spec 08: `attested` or `unsigned`); items
 * that do not count, and items whose hash is still being computed, are
 * absent — so a content-bound reference to them counts nowhere (resonance.md,
 * vote rule 5: no positive verdict, no votes).
 *
 * @answers `ReadonlyMap<itemId, contentHash>`
 * @without empty
 * @group relations
 * @see spec docs/spec/modules/resonance.md
 */
export function useCountingContentHashes(items: readonly Item[]): ReadonlyMap<string, string> {
  const standings = useItemStandings(items)
  const countingKey = items
    .filter((item) => standingCounts(standings.get(item.id) ?? null))
    .map(verdictKey)
    .join("\u0001")
  const counting = useMemo(
    () => items.filter((item) => standingCounts(standings.get(item.id) ?? null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countingKey],
  )
  const [hashes, setHashes] = useState<ReadonlyMap<string, { key: string; hash: string }>>(new Map())

  useEffect(() => {
    if (counting.length === 0) return
    let cancelled = false
    ;(async () => {
      const entries: Array<readonly [string, { key: string; hash: string }]> = []
      for (const item of counting) {
        const hash = await itemContentHash(item)
        if (hash !== null) entries.push([item.id, { key: jcsCanonicalize(itemContent(item)), hash }])
      }
      if (!cancelled) startTransition(() => setHashes(new Map(entries)))
    })()
    return () => { cancelled = true }
  }, [counting])

  return useMemo(() => {
    const result = new Map<string, string>()
    for (const item of counting) {
      const entry = hashes.get(item.id)
      // Stale hashes of changed content never count.
      if (entry && entry.key === jcsCanonicalize(itemContent(item))) result.set(item.id, entry.hash)
    }
    return result
  }, [counting, hashes])
}
