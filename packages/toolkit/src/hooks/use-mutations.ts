import { useCallback } from "react"
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

/**
 * Create a new item.
 *
 * @answers `(input) => Promise<Item>`
 * @without throws on call
 * @group write
 * @see story rls-foundations-hooks--write
 * @see spec docs/spec/02-data-interface.md
 */
export function useCreateItem() {
  const connector = useConnector()
  return useCallback((item: CreateItemInput) => writable(connector).createItem(item), [connector])
}

/**
 * Change an existing item.
 *
 * @answers `(id, updates) => Promise<Item>`
 * @without throws on call
 * @group write
 * @see story rls-foundations-hooks--write
 * @see spec docs/spec/02-data-interface.md
 */
export function useUpdateItem() {
  const connector = useConnector()
  return useCallback(
    (id: string, updates: Partial<Item>) => writable(connector).updateItem(id, updates),
    [connector],
  )
}

/**
 * Delete an item.
 *
 * @answers `(id) => Promise<void>`
 * @without throws on call
 * @group write
 * @see story rls-foundations-hooks--write
 * @see spec docs/spec/02-data-interface.md
 */
export function useDeleteItem() {
  const connector = useConnector()
  return useCallback((id: string) => writable(connector).deleteItem(id), [connector])
}
