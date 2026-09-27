import { useCallback } from "react"
import type { CreateItemInput, CreateItemOptions, DataInterface, Item } from "@real-life-stack/data-interface"
import { hasGroupScope, isWritable } from "@real-life-stack/data-interface"
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
 * Create a new item — optionally directly in a given space (`{ group }`).
 *
 * Mit `group` nur an einen Connector mit `hasGroupScope()` (Spec 02 →
 * Anlegen in einem bestimmten Space, Regel 5): Ein anderer übergeht das
 * zweite Argument und legte im falschen Space an. Der Hook wirft dann,
 * statt es still zu tun.
 *
 * @answers `(input, options?) => Promise<Item>`
 * @without throws on call
 * @group write
 * @see story rls-foundations-hooks--write
 * @see spec docs/spec/02-data-interface.md
 */
export function useCreateItem() {
  const connector = useConnector()
  return useCallback((item: CreateItemInput, options?: CreateItemOptions) => {
    const writer = writable(connector)
    if (options?.group === undefined) return writer.createItem(item)
    if (!hasGroupScope(writer)) throw new Error("Connector cannot create items in a given space (GroupScopeCapable)")
    return writer.createItem(item, { group: options.group })
  }, [connector])
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
