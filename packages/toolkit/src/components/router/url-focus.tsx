"use client"

import { useCallback, useMemo, useRef, type ReactNode } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { ItemFocusContext, type ItemFocus } from "../../hooks/use-item-focus"
import { DRAFT_ITEM_ID } from "../../hooks/use-draft-item"
import { moduleIds } from "../../lib/module-register"

/** Split a pathname into scope/module/item — module only when it's a real module. */
export function parsePath(pathname: string): { scope?: string; module?: string; itemId?: string } {
  const [scope, seg, item] = pathname.split("/").filter(Boolean)
  if (seg && moduleIds().includes(seg)) return { scope, module: seg, itemId: item }
  // Module-less or bare path — no module-focus context (e.g. the transient
  // `/{scope}/{itemId}` before the app's routing redirects it).
  return { scope }
}

/**
 * Build a URL for the focus/edit state, toggling `?edit` and preserving other
 * query params — but always dropping `?compose`: focusing or clearing an item
 * means "look at this item", which leaves any in-progress create (same as it
 * leaves edit). So clicking another item while creating works like it does while
 * editing.
 */
export function buildUrl(
  pathname: string,
  search: string,
  opts: { edit: boolean; comment?: boolean },
): string {
  const params = new URLSearchParams(search)
  params.delete("compose")
  if (opts.edit) params.set("edit", "1")
  else params.delete("edit")
  // Die Absicht „ich will hier schreiben" — wie `edit` ein Zustand des
  // geoeffneten Items, nicht ein Ereignis. So ueberlebt sie den Modulwechsel,
  // und ein Zurueck im Verlauf schaelt sie wieder ab.
  if (opts.comment) params.set("comment", "1")
  else params.delete("comment")
  const q = params.toString()
  return q ? `${pathname}?${q}` : pathname
}

/**
 * Der Fokus in der URL — die Voreinstellung fuer jede App mit Router
 * (Spec 01, „Der Modul-Host").
 *
 * `/{scope}/{module}/{itemId}` ist das offene Item (lesen), `?edit` schaltet
 * auf Bearbeiten, `?comment` setzt den Cursor ins Kommentarfeld, `?compose=`
 * erstellt. Jedes Oeffnen schreibt die URL; Zurueck im Browser schaelt eine
 * Schicht ab (edit → read → module), und ein Link fuehrt zum Item.
 *
 * Warum ein Provider ueber den Routen statt eines Hakens je Modul: Das
 * geteilte Panel ueberlebt den Modulwechsel, also kann sein `onClose` lange
 * nach dem Modul feuern, das es oeffnete. Die Callbacks lesen darum den
 * LEBENDEN Ort zur Aufrufzeit und schreiben den Pfad des Moduls um, in dem
 * man tatsaechlich steht.
 */
export function UrlFocusProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname
  const searchRef = useRef(location.search)
  searchRef.current = location.search

  const focusItem = useCallback((id: string, targetModule?: string) => {
    if (id === DRAFT_ITEM_ID) return
    const { scope, module } = parsePath(pathRef.current)
    if (!scope || !module) return
    // Ein genanntes Zielmodul gewinnt — in EINER Navigation: Der Pfad im Ref
    // traegt direkt nach einem Modulwechsel noch das alte Modul.
    const ziel = targetModule ?? module
    const target = buildUrl(`/${scope}/${ziel}/${id}`, searchRef.current, { edit: false })
    if (`${pathRef.current}${searchRef.current}` !== target) navigate(target)
  }, [navigate])

  const clearFocus = useCallback(() => {
    const { scope, module, itemId } = parsePath(pathRef.current)
    if (scope && module && itemId) {
      navigate(buildUrl(`/${scope}/${module}`, searchRef.current, { edit: false }))
    }
  }, [navigate])

  const editItem = useCallback(() => {
    const { scope, module, itemId } = parsePath(pathRef.current)
    if (!scope || !module || !itemId) return
    navigate(buildUrl(`/${scope}/${module}/${itemId}`, searchRef.current, { edit: true }))
  }, [navigate])

  const stopEditing = useCallback(() => {
    const { scope, module, itemId } = parsePath(pathRef.current)
    if (!scope || !module || !itemId) return
    navigate(buildUrl(`/${scope}/${module}/${itemId}`, searchRef.current, { edit: false }), { replace: true })
  }, [navigate])

  const commentOnItem = useCallback((id: string, targetModule?: string) => {
    if (id === DRAFT_ITEM_ID) return
    const { scope, module } = parsePath(pathRef.current)
    if (!scope || !module) return
    const ziel = targetModule ?? module
    navigate(buildUrl(`/${scope}/${ziel}/${id}`, searchRef.current, { edit: false, comment: true }))
  }, [navigate])

  const stopCommenting = useCallback(() => {
    const { scope, module, itemId } = parsePath(pathRef.current)
    if (!scope || !module || !itemId) return
    navigate(buildUrl(`/${scope}/${module}/${itemId}`, searchRef.current, { edit: false }), { replace: true })
  }, [navigate])

  const startCompose = useCallback((type: string) => {
    const { scope, module } = parsePath(pathRef.current)
    if (!scope || !module) return
    const params = new URLSearchParams(searchRef.current)
    params.set("compose", type)
    params.delete("edit")
    params.delete("comment")
    // Kein Item-Segment: Ein offenes Item wird losgelassen, man erstellt jetzt.
    navigate(`/${scope}/${module}?${params.toString()}`)
  }, [navigate])

  const stopCompose = useCallback(() => {
    const { scope, module } = parsePath(pathRef.current)
    if (!scope || !module) return
    navigate(buildUrl(`/${scope}/${module}`, searchRef.current, { edit: false }), { replace: true })
  }, [navigate])

  const focusCreated = useCallback((id: string) => {
    const { scope, module } = parsePath(pathRef.current)
    if (!scope || !module) return
    // Ersetzt, nicht gepusht: Das Formular gehoert nicht in den Verlauf.
    navigate(buildUrl(`/${scope}/${module}/${id}`, searchRef.current, { edit: false }), { replace: true })
  }, [navigate])

  const { scope, module, itemId } = parsePath(location.pathname)
  const params = new URLSearchParams(location.search)
  const isEditing = !!itemId && params.has("edit")
  const isCommenting = !!itemId && params.has("comment")
  const composeType = module ? params.get("compose") : null
  const value = useMemo<ItemFocus>(
    () => ({
      scope, module, itemId, isEditing, isCommenting, composeType,
      focusItem, clearFocus, editItem, stopEditing, commentOnItem, stopCommenting,
      startCompose, stopCompose, focusCreated,
    }),
    [scope, module, itemId, isEditing, isCommenting, composeType, focusItem, clearFocus, editItem, stopEditing, commentOnItem, stopCommenting, startCompose, stopCompose, focusCreated],
  )
  return <ItemFocusContext.Provider value={value}>{children}</ItemFocusContext.Provider>
}
