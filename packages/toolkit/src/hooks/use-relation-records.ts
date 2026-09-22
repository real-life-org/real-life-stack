import { startTransition, useEffect, useMemo, useReducer } from "react"
import type {
  Observable,
  RelationRecord,
  RelationRecordFilter,
} from "@real-life-stack/data-interface"
import { hasRelationRecords } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

const EMPTY_RECORDS: RelationRecord[] = []

function useObservableSnapshot<T>(observable: Observable<T> | null, empty: T) {
  const [, rerender] = useReducer((value: number) => value + 1, 0)

  useEffect(() => {
    if (!observable) return
    rerender()
    return observable.subscribe(() => startTransition(rerender))
  }, [observable])

  return {
    data: observable?.current ?? empty,
    isLoading: observable?.loaded === false,
  }
}

/**
 * Which signed relation records match?
 *
 * @answers `{data, supported}`
 * @without empty — `supported: false`
 * @group relations
 * @see story rls-foundations-hooks--relations
 * @see spec docs/spec/08-relation-records.md
 */
export function useRelationRecords(filter?: RelationRecordFilter) {
  const connector = useConnector()
  const supported = hasRelationRecords(connector)
  const filterKey = JSON.stringify(filter ?? {})
  const observable = useMemo(
    () => supported ? connector.observeRelationRecords(filter) : null,
    // `filterKey` gives value semantics to the small filter object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connector, supported, filterKey],
  )
  const snapshot = useObservableSnapshot(observable, EMPTY_RECORDS)

  return { ...snapshot, supported }
}
