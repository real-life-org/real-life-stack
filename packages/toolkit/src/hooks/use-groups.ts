import { useCallback, useEffect, useMemo, useReducer, startTransition } from "react"
import type { DataInterface, Group, GroupManager, User } from "@real-life-stack/data-interface"
import { hasGroups, hasItemGroups } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"
import { useInitialSync } from "./use-initial-sync"

/**
 * Where does an item belong that is shared with nobody?
 *
 * Id of the user's personal/private space („share with nobody"), or `null` for
 * connectors without one. Used by the sharing-scope picker to offer a „Privat"
 * option (pass the id to `moveItemToGroup` to make an item private).
 *
 * @answers `string | null`
 * @without null
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function usePersonalGroupId(): string | null {
  const connector = useConnector()
  if (!hasItemGroups(connector)) return null
  return connector.getPersonalGroupId?.() ?? null
}

/**
 * Groups are a capability, not a given (`GroupManager`). A connector that only
 * reads items — the handbook's example, a public view, an embed — has none, and
 * „no groups" is then the true answer, not an error. The reading hooks below
 * therefore answer empty instead of throwing, the same way `useInitialSync`
 * answers „not syncing" for backends without that notion.
 *
 * The writing hooks keep throwing, but only when the returned function is
 * actually called: preparing a callback must never break a render.
 */
function useOptionalGroupConnector() {
  const connector = useConnector()
  return hasGroups(connector) ? connector : null
}

function useGroupMutation<A extends unknown[], R>(
  run: (c: DataInterface & GroupManager, ...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  const connector = useConnector()
  return useCallback(
    (...args: A) => {
      if (!hasGroups(connector)) throw new Error("Connector does not support groups")
      return run(connector, ...args)
    },
    // `run` is a module-level function per hook, stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connector],
  )
}

const NO_GROUPS: Group[] = []
const NO_MEMBERS: User[] = []

/**
 * Which spaces do I see?
 *
 * @answers `{data, isLoading}`
 * @without empty
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useGroups() {
  const connector = useOptionalGroupConnector()
  const observable = useMemo(() => connector?.observeGroups() ?? null, [connector])
  // Read fresh each render (no stale snapshot across observable change); the
  // subscription only triggers re-renders. `isLoading` reflects the real
  // `loaded` flag, so "loaded, zero groups" is distinguishable from "still
  // loading" (e.g. the no-access notice for a deep-linked space). Sources
  // without the flag (sync Mock/Local) count as loaded.
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!observable) return
    rerender()
    return observable.subscribe(() => startTransition(rerender))
  }, [observable])

  // Der Erstsync zählt als „lädt noch": sonst meldet ein Deep-Link auf einen
  // Space „kein Zugriff", nur weil die Gruppenliste dieses Geräts noch
  // unterwegs ist (rls#265).
  const initialSync = useInitialSync()
  if (!observable) return { data: NO_GROUPS, isLoading: false }
  return { data: observable.current, isLoading: observable.loaded === false || initialSync.active }
}

/**
 * Which space am I in right now?
 *
 * @answers `Group | null`
 * @without null
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useCurrentGroup(): Group | null {
  const connector = useOptionalGroupConnector()
  const observable = useMemo(() => connector?.observeCurrentGroup() ?? null, [connector])
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!observable) return
    rerender()
    return observable.subscribe(() => startTransition(rerender))
  }, [observable])

  return observable?.current ?? null
}

/**
 * Create a space.
 *
 * @answers `(name, data?) => Promise`
 * @without throws on call
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useCreateGroup() {
  return useGroupMutation((c, name: string, data?: Record<string, unknown>) => c.createGroup(name, data))
}

/**
 * Change a space's name or data.
 *
 * @answers `(id, patch) => Promise`
 * @without throws on call
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useUpdateGroup() {
  return useGroupMutation((c, id: string, updates: Partial<Group>) => c.updateGroup(id, updates))
}

/**
 * Delete a space.
 *
 * @answers `(id) => Promise`
 * @without throws on call
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useDeleteGroup() {
  return useGroupMutation((c, id: string) => c.deleteGroup(id))
}

/**
 * Who belongs to this space, or with `null` to all of mine?
 *
 * @answers `{data, isLoading}`
 * @without empty
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useMembers(groupId: string | null) {
  const connector = useOptionalGroupConnector()
  const observable = useMemo(() => connector?.observeMembers(groupId) ?? null, [connector, groupId])
  // Read fresh each render (no stale snapshot across groupId change); `isLoading`
  // from the real `loaded` flag, so "loaded, no members" ≠ "still loading".
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!observable) return
    rerender()
    return observable.subscribe(() => startTransition(rerender))
  }, [observable])

  if (!observable) return { data: NO_MEMBERS, isLoading: false }
  return { data: observable.current, isLoading: observable.loaded === false }
}

/**
 * Invite someone into a space.
 *
 * @answers `(groupId, userId) => Promise`
 * @without throws on call
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useInviteMember() {
  return useGroupMutation((c, groupId: string, userId: string) => c.inviteMember(groupId, userId))
}

/**
 * Remove someone from a space.
 *
 * @answers `(groupId, userId) => Promise`
 * @without throws on call
 * @group people
 * @see spec docs/spec/04-items-relations-groups-spaces.md
 */
export function useRemoveMember() {
  return useGroupMutation((c, groupId: string, userId: string) => c.removeMember(groupId, userId))
}
