import { useEffect, useMemo, useState, startTransition } from "react"
import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { hasRelationRecords, isAuthorialItemType, isFrozenByRecords } from "@real-life-stack/data-interface"
import { useOptionalConnector } from "./connector-context"

const NO_RECORDS: RelationRecord[] = []

/**
 * Is the wording of this item frozen?
 *
 * Spec 08 → Einfrieren: another person holds a content-bound reference (a
 * relation record with `fields.contentHash`, e.g. a vote) to an item of a
 * catalog type — its content may no longer change. Surfaces hide „Bearbeiten"
 * for the content then (resonance.md, Wortlaut rule 3). Same rule the write
 * path enforces (`isFrozen`); this hook only decides what is offered.
 *
 * @answers `boolean`
 * @without value — `false` (nothing to freeze without relation records)
 * @group relations
 * @see spec docs/spec/08-relation-records.md
 */
export function useIsFrozen(item: Item | null | undefined): boolean {
  const connector = useOptionalConnector()
  const itemId = item && isAuthorialItemType(item.type) ? item.id : null
  const observable = useMemo(
    () => (connector && itemId !== null && hasRelationRecords(connector)
      ? connector.observeRelationRecords({ to: `item:${itemId}` })
      : null),
    [connector, itemId],
  )
  const [records, setRecords] = useState<RelationRecord[]>(observable?.current ?? NO_RECORDS)
  useEffect(() => {
    if (!observable) {
      setRecords(NO_RECORDS)
      return
    }
    setRecords(observable.current)
    return observable.subscribe((next) => startTransition(() => setRecords(next)))
  }, [observable])

  return useMemo(
    () => (item && itemId !== null ? isFrozenByRecords(item, records) : false),
    [item, itemId, records],
  )
}
