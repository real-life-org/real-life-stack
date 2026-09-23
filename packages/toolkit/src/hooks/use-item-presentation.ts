import { useCallback, useMemo } from "react"
import { hasItemGroups, type Group, type Item } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"
import { useGroups, usePersonalGroupId } from "./use-groups"
import { getSpacePrimaryColor } from "../lib/utils"

/** Wie ein Item sich zeigt: aus welcher Gruppe es stammt, in welcher Farbe, und ob es privat ist. */
export interface ItemPresentation {
  /** Die Herkunftsgruppe, sofern der Connector sie kennt (`ItemGroupCapable`). */
  group: Group | undefined
  /** Die Farbe der Herkunftsgruppe; ohne Herkunft die Palettenfarbe des Items. */
  color: string
  /** Liegt das Item im persönlichen Space des angemeldeten Menschen? */
  isPrivate: boolean
}

/**
 * How does this item present itself: which group it comes from, in which colour, and whether it is private?
 *
 * Bis zum 23.09.2026 waren das drei Hooks (`useItemGroupResolver`,
 * `useItemGroupColorResolver`, `useItemPrivacyResolver`) in einer Datei, mit
 * vier Aufrufern, die meist zwei davon zugleich brauchten (Hook-Inventur,
 * Plan §12). Jetzt eine Ableitung: Herkunft einmal nachschlagen, Farbe und
 * Privatheit daraus. `activeGroupId` ist der Rückfall für die Farbe, wenn der
 * Connector keine Herkunft kennt — der Host gibt den aktiven Space mit.
 *
 * @answers `(item) => {group, color, isPrivate}`
 * @without value — no group, palette colour, `false`
 * @group item
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useItemPresentation(activeGroupId?: string): (item: Item) => ItemPresentation {
  const connector = useConnector()
  const { data: groups } = useGroups()
  const personalGroupId = usePersonalGroupId()
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const colorById = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of groups) map.set(g.id, getSpacePrimaryColor(g.id, (g.data?.primaryColor as string | undefined) ?? null))
    return map
  }, [groups])
  return useCallback(
    (item: Item) => {
      const originId = (hasItemGroups(connector) ? connector.getItemGroupId(item.id) : null) ?? null
      const colorId = originId ?? activeGroupId
      return {
        group: originId ? groupById.get(originId) : undefined,
        color: colorId ? (colorById.get(colorId) ?? getSpacePrimaryColor(colorId, null)) : getSpacePrimaryColor(item.id, null),
        isPrivate: !!personalGroupId && originId === personalGroupId,
      }
    },
    [connector, groupById, colorById, personalGroupId, activeGroupId],
  )
}
