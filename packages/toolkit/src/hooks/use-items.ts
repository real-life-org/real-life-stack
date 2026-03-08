import { useEffect, useMemo, useState } from "react"
import type { Item, ItemFilter } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

export function useItems(filter?: ItemFilter) {
  const connector = useConnector()
  const filterKey = JSON.stringify(filter)
  const observable = useMemo(
    () => connector.observe(filter ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connector, filterKey]
  )
  const [data, setData] = useState<Item[]>(observable.current)

  useEffect(() => {
    setData(observable.current)
    return observable.subscribe(setData)
  }, [observable])

  return { data, isLoading: data.length === 0 && observable.current.length === 0 }
}

export function useItem(id: string) {
  const connector = useConnector()
  const observable = useMemo(() => connector.observeItem(id), [connector, id])
  const [data, setData] = useState<Item | null>(observable.current)

  useEffect(() => {
    setData(observable.current)
    return observable.subscribe(setData)
  }, [observable])

  return { data, isLoading: data === null }
}
