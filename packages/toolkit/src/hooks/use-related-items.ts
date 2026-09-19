import { useEffect, useMemo, useState, useCallback, startTransition } from "react"
import type { Item, RelatedItemsOptions } from "@real-life-stack/data-interface"
import { hasRelations } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

const NO_ITEMS: Item[] = []

export function useRelatedItems(
  itemId: string,
  predicate?: string,
  options?: RelatedItemsOptions
) {
  const connector = useConnector()
  const supportsRelations = hasRelations(connector)
  const optionsKey = JSON.stringify(options ?? {})

  const observable = useMemo(() => {
    if (!supportsRelations) return null
    return connector.observeRelatedItems(itemId, predicate, options)
  }, [connector, supportsRelations, itemId, predicate, optionsKey])

  const [data, setData] = useState<Item[]>(observable?.current ?? [])
  const update = useCallback((items: Item[]) => startTransition(() => setData(items)), [])

  useEffect(() => {
    if (!observable) {
      setData(NO_ITEMS)
      return
    }
    setData(observable.current)
    return observable.subscribe(update)
  }, [observable, update])

  return { data }
}
