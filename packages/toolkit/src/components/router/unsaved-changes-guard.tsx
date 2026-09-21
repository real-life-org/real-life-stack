"use client"

import { useCallback } from "react"
import { useBlocker, type Location } from "react-router-dom"

import { useUnsavedChanges } from "../../hooks/use-unsaved-changes"
import { DiscardChangesDialog, useBeforeUnloadWarning } from "../../hooks/use-unsaved-warning"

/** Does this navigation leave the create/edit context (i.e. discard the open
 *  composer)? True only when we were composing (`?compose`/`?edit`) and the
 *  target no longer is. Navigations that stay in context — switching modules
 *  while creating (the query is carried), the map-pick detour — keep the param
 *  and pass through, so they're never blocked. */
function leavesComposer(current: Location, next: Location): boolean {
  const cur = new URLSearchParams(current.search)
  const dst = new URLSearchParams(next.search)
  const wasComposing = cur.has("compose") || cur.has("edit")
  const stillComposing = dst.has("compose") || dst.has("edit")
  return wasComposing && !stillComposing
}

/**
 * Warns before unsaved composer content is discarded. One mechanism covers every
 * path that could lose it:
 * - in-app navigation (cancel, opening another item) and browser-back →
 *   react-router's `useBlocker`, gated on {@link leavesComposer};
 * - hard reload / tab close / external nav → `useBeforeUnloadWarning`.
 *
 * Braucht den Router (`useBlocker`, also einen Data-Router) und liegt darum im
 * Unterpfad `/router`. Bis zum 21.09.2026 stand er in der Referenz-App — und
 * die Netzwerk-App hatte den Provider, aber nicht den Guard (rls#429, Codex).
 * Eine App mit Router mountet ihn einmal unter `UnsavedChangesProvider`.
 *
 * Only armed while a composer reports unsaved changes (see `useUnsavedChanges`),
 * so an untouched or empty form never triggers it. Mounted once, under the
 * router and the `UnsavedChangesProvider`.
 */
export function UnsavedChangesGuard() {
  const unsaved = useUnsavedChanges()
  const dirtyRef = unsaved?.dirtyRef
  useBeforeUnloadWarning(unsaved?.dirty ?? false)

  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }: { currentLocation: Location; nextLocation: Location }) =>
      !!dirtyRef?.current && leavesComposer(currentLocation, nextLocation),
    [dirtyRef],
  )
  const blocker = useBlocker(shouldBlock)

  return (
    <DiscardChangesDialog
      open={blocker.state === "blocked"}
      onKeepEditing={() => blocker.reset?.()}
      onDiscard={() => blocker.proceed?.()}
    />
  )
}
