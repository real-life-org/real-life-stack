import { startTransition, useEffect, useMemo, useState } from "react"
import { hasGroupScope, type Item } from "@real-life-stack/data-interface"

import { useOptionalConnector } from "../../hooks/connector-context"
import { itemHasBindings } from "../../lib/item-bindings"

/**
 * Hat das Item Beziehungen, die es in seinem Space halten? `undefined`, solange geladen wird.
 *
 * Beziehungen nach shared-components → Space des Formulars, Regel 5:
 * Item-Kanten und feste Item-Verweise in beiden Richtungen, Records von
 * Personen (Stimmen, Zusagen), Kommentare und Reaktionen. Gelesen werden die
 * Items im Space des Items — mit `hasGroupScope()` genau dieser
 * (`ItemFilter.group`), sonst die sichtbaren Items des Connectors.
 */
export function useItemHasBindings(item: Item | null, spaceId: string | null): boolean | undefined {
  const connector = useOptionalConnector()
  const filterKey = JSON.stringify(connector && spaceId && hasGroupScope(connector) ? { group: spaceId } : {})
  const observable = useMemo(
    () => (connector && item ? connector.observe(JSON.parse(filterKey)) : null),
    // Nur die Id zählt für die Abfrage; das Item selbst geht unten ein.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connector, filterKey, item?.id],
  )
  const [state, setState] = useState<{ items: readonly Item[]; loaded: boolean }>(() => ({
    items: observable?.current ?? [],
    loaded: observable ? observable.loaded !== false : false,
  }))
  useEffect(() => {
    if (!observable) return
    const read = () => ({ items: observable.current, loaded: observable.loaded !== false })
    setState(read())
    return observable.subscribe(() => startTransition(() => setState(read())))
  }, [observable])
  if (!item || !observable || !state.loaded) return undefined
  return itemHasBindings(item, state.items, spaceId)
}
