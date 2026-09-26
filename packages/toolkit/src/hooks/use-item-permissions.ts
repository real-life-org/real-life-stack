import { useMemo } from "react"
import type { DataInterface, Item } from "@real-life-stack/data-interface"
import { hasAuthorization, isAuthoredItemType, isWritable } from "@real-life-stack/data-interface"
import { useConnector } from "./connector-context"
import { useOptionalCurrentUser } from "./use-auth"

export interface ItemPermissions {
  canEdit: boolean
  canDelete: boolean
}

const NONE: ItemPermissions = { canEdit: false, canDelete: false }

/**
 * Pure resolver behind {@link useItemPermissions} — exported so it can be unit
 * tested without React. Order: a non-writable connector grants nothing; a
 * connector with an authorization model is the source of truth (UCAN chain /
 * RLS flags); otherwise the default below.
 *
 * **Default: space members may edit each other's content.** Creator-owns was
 * never the technical model — every member holds the space key in WoT, and
 * the Supabase policy `edit item` has always allowed it. The UI merely hid
 * the button, promising a protection that did not exist while withholding an
 * edit that was already permitted.
 *
 * The exception are authored items (`isAuthoredItemType`: the item-authorial
 * catalog of spec 08 — statement, comment, reaction — plus relation records),
 * which carry a visible statement BY someone: editing a foreign statement or
 * comment puts words in their mouth, editing a reaction or a vote casts a
 * ballot for them.
 *
 * This hook is UX, never a boundary — it only decides whether a button is
 * shown. The rule is enforced at the write ingress (`planAuthoredUpdate`,
 * `assertMayMutateAuthoredItem`), in WoT additionally by the item claim (a
 * foreign content change invalidates it), and by the backend where one
 * exists: Supabase (migrations 0009 and 0012) and the GraphQL store.
 */
export function resolveItemPermissions(
  connector: DataInterface,
  item: Item | null | undefined,
  currentUserId: string | undefined,
): ItemPermissions {
  if (!item || !isWritable(connector)) return NONE
  if (hasAuthorization(connector)) {
    return {
      canEdit: connector.can("item/edit", item),
      canDelete: connector.can("item/delete", item),
    }
  }
  if (!currentUserId) return NONE
  const mine = item.createdBy === currentUserId
  const speaksForSomeone = isAuthoredItemType(item.type)
  const allowed = mine || !speaksForSomeone
  return { canEdit: allowed, canDelete: allowed }
}

/**
 * Pure resolver for „may I create here". A non-writable connector can't
 * create; a connector with an authorization model decides; otherwise any
 * writable connector may create (space membership is enforced backend-side).
 */
export function resolveCanCreate(
  connector: DataInterface,
  spaceId: string | null | undefined,
  type: string | undefined,
): boolean {
  if (!isWritable(connector)) return false
  if (hasAuthorization(connector)) {
    // The authorization model is the source of truth. Without a space context
    // (loading / no-access / overview) we cannot ask it — fail closed rather
    // than optimistically allow.
    if (!spaceId) return false
    return connector.can("item/create", { space: spaceId, ...(type ? { type } : {}) })
  }
  return true
}

/**
 * May I show the ⋮ menu here?
 *
 * Whether the current user may edit / delete a given item — drives the detail
 * action menu (⋮). UI affordance only; the backend/protocol enforces. See
 * `AuthorizationCapable` in data-interface and the concept doc
 * `docs/concepts/item-edit-delete-2026-06.md`.
 *
 * @answers `{canEdit, canDelete}`
 * @without value — both `false`
 * @group permissions
 * @see story rls-foundations-hooks--permissions
 * @see spec docs/spec/03-capabilities.md
 */
export function useItemPermissions(item: Item | null | undefined): ItemPermissions {
  const connector = useConnector()
  // A read-only connector has no sign-in; the resolver then grants nothing anyway.
  const { data: currentUser } = useOptionalCurrentUser()
  return useMemo(
    () => resolveItemPermissions(connector, item, currentUser?.id),
    [connector, item, currentUser?.id],
  )
}

