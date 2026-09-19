import { useCallback } from "react"
import { useBlocker, type Location } from "react-router-dom"
import {
  DiscardChangesDialog,
  useBeforeUnloadWarning,
  useUnsavedChanges,
} from "@real-life-stack/toolkit"

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
 * Dialog und Verlassen-Warnung liegen im Toolkit; hier bleibt nur, was den
 * Router braucht — den kennt das Toolkit bewusst nicht.
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
