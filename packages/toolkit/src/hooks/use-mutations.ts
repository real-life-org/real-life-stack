import { useCallback, useMemo } from "react"
import type { CreateItemInput, DataInterface, Item } from "@real-life-stack/data-interface"
import { isWritable } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"

/**
 * Schreiben ist eine Fähigkeit, kein Muss. Eine Fläche darf ihren Knopf
 * trotzdem bauen — ob er etwas bewirkt, sagt die Prüfung (`isWritable`,
 * `useItemPermissions`), nicht eine Ausnahme beim Rendern.
 *
 * Bis 19.09.2026 warfen diese Hooks schon im Render. Damit riss eine einzige
 * vorbereitete Mutation die ganze Fläche mit, sobald der Connector nur lesen
 * konnte — auch wenn der Knopf gar nicht sichtbar war. Jetzt scheitert erst
 * das Drücken.
 */
function writable(connector: DataInterface) {
  if (!isWritable(connector)) throw new Error("Connector does not support writing items")
  return connector
}

export function useCreateItem() {
  const connector = useConnector()
  const mutate = useCallback((item: CreateItemInput) => writable(connector).createItem(item), [connector])
  return useMemo(() => ({ mutate }), [mutate])
}

export function useUpdateItem() {
  const connector = useConnector()
  const mutate = useCallback(
    (id: string, updates: Partial<Item>) => writable(connector).updateItem(id, updates),
    [connector],
  )
  return useMemo(() => ({ mutate }), [mutate])
}

export function useDeleteItem() {
  const connector = useConnector()
  const mutate = useCallback((id: string) => writable(connector).deleteItem(id), [connector])
  return useMemo(() => ({ mutate }), [mutate])
}
