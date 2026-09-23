"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

import { DRAFT_ITEM_ID } from "./use-draft-item"

/**
 * Der Fokus einer Modulfläche: welches Item offen ist, ob es bearbeitet
 * wird, ob der Cursor im Kommentarfeld steht, ob gerade erstellt wird.
 *
 * **Der Vertrag ist einer, die Ablage nicht.** In einer App mit Router lebt
 * der Fokus in der URL — `/{scope}/{modul}/{itemId}`, `?edit`, `?comment`,
 * `?compose=` — damit Zurück im Browser das Panel schließt und ein Link zum
 * Item führt. Das ist die Voreinstellung (Spec 01, „Der Modul-Host"), und sie
 * liegt in `@real-life-stack/toolkit/router`, weil sie den Router braucht.
 * Ohne Router — Story, Test, Einbettung ohne eigene Adresse — hält
 * {@link MemoryFocusProvider} denselben Vertrag im Speicher. Er ist der
 * Rückfall, keine zweite gleichwertige Betriebsart.
 *
 * Bis zum 21.09.2026 lebte der Vertrag in der Referenz-App, und die
 * Netzwerk-App hatte ihn nicht — sie hat den Fokus neu erfunden, ohne URL.
 */
export interface ItemFocus {
  /** Der Space, in dem man steht (URL-Slug oder Id); ohne Router die Angabe des Providers. */
  scope?: string
  /** Das Modul, in dem man steht. */
  module?: string
  /** Das offene Item, oder nichts. */
  itemId?: string
  /** Wird das offene Item bearbeitet? */
  isEditing: boolean
  /** Steht der Cursor im Kommentarfeld des offenen Items? */
  isCommenting: boolean
  /** Der Typ, der gerade erstellt wird — oder `null`, wenn nichts erstellt wird. */
  composeType: string | null
  /**
   * Ein Item in den Blick nehmen. Ein genanntes Modul wechselt zugleich die
   * Sicht — beides in EINEM Schritt, weil ein zweiter den ersten überschriebe.
   */
  focusItem(id: string, module?: string): void
  /** Den Blick lösen: kein Item offen. */
  clearFocus(): void
  /** Das offene Item bearbeiten. */
  editItem(): void
  /** Bearbeiten beenden, Item bleibt offen. */
  stopEditing(): void
  /** Ein Item öffnen, um dazu zu schreiben — Cursor im Kommentarfeld. */
  commentOnItem(id: string, module?: string): void
  /** Die Absicht ist erfüllt — der Cursor steht. */
  stopCommenting(): void
  /**
   * Erstellen beginnen. Ein offenes Item wird dabei losgelassen: Man erstellt
   * jetzt. Was vorbelegt wird (ein angeklickter Kalendertag), gehört nicht
   * hierher — das hält der Erstellen-Host; hier steht nur, DASS und WAS
   * erstellt wird.
   */
  startCompose(type: string): void
  /** Erstellen abbrechen. */
  stopCompose(): void
  /** Das eben erstellte Item in den Blick nehmen; das Erstellen ist damit vorbei. */
  focusCreated(id: string): void
}

export const ItemFocusContext = createContext<ItemFocus | null>(null)

/**
 * Which item is open, is it being edited, is something being created? The focus contract — in the app the URL (`UrlFocusProvider` from `/router`), otherwise memory.
 *
 * Der Fokus. Wirft ohne Provider — ein Modul ohne Fokus ist ein Kompositionsfehler.
 *
 * @answers `{itemId, isEditing, composeType, focusItem, editItem, startCompose, …}`
 * @without throws on render
 * @group host
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useItemFocus(): ItemFocus {
  const ctx = useContext(ItemFocusContext)
  if (!ctx) {
    throw new Error("useItemFocus braucht einen Fokus-Provider: UrlFocusProvider (toolkit/router) in der App, MemoryFocusProvider ohne Router.")
  }
  return ctx
}

/**
 * The focus, or `null` where a surface may stand without one.
 *
 * Der Fokus oder `null` — für Flächen, die auch ohne Fokus stehen dürfen (Story, Test).
 *
 * @answers `ItemFocus | null`
 * @without value — null
 * @group host
 * @see story rls-foundations-hooks--surfaces
 * @see spec docs/spec/01-app-composition.md
 */
export function useOptionalItemFocus(): ItemFocus | null {
  return useContext(ItemFocusContext)
}

export interface MemoryFocusProviderProps {
  /** Das Modul, in dem man steht. */
  module?: string
  /** Der Space, in dem man steht. */
  scope?: string
  /** Wird gerufen, wenn `focusItem` ein anderes Modul nennt. Ohne Angabe bleibt das Modul. */
  onModuleChange?: (module: string) => void
  children: ReactNode
}

/**
 * Der Fokus im Speicher — derselbe Vertrag wie in der URL, ohne Router.
 *
 * Für Storybook, Tests und Einbettungen ohne eigene Adresse. In einer App mit
 * Router ist er falsch: Dort MUSS der Fokus in der URL liegen (Spec 01).
 */
export function MemoryFocusProvider({ module, scope, onModuleChange, children }: MemoryFocusProviderProps) {
  const [itemId, setItemId] = useState<string | undefined>()
  const [isEditing, setEditing] = useState(false)
  const [isCommenting, setCommenting] = useState(false)
  const [composeType, setComposeType] = useState<string | null>(null)

  const wechsle = useCallback(
    (ziel?: string) => {
      if (ziel && ziel !== module) onModuleChange?.(ziel)
    },
    [module, onModuleChange],
  )

  const focusItem = useCallback(
    (id: string, ziel?: string) => {
      if (id === DRAFT_ITEM_ID) return
      wechsle(ziel)
      setItemId(id)
      setEditing(false)
      setCommenting(false)
      setComposeType(null)
    },
    [wechsle],
  )
  const clearFocus = useCallback(() => {
    setItemId(undefined)
    setEditing(false)
    setCommenting(false)
  }, [])
  const editItem = useCallback(() => setEditing((e) => (itemId ? true : e)), [itemId])
  const stopEditing = useCallback(() => setEditing(false), [])
  const commentOnItem = useCallback(
    (id: string, ziel?: string) => {
      if (id === DRAFT_ITEM_ID) return
      wechsle(ziel)
      setItemId(id)
      setEditing(false)
      setCommenting(true)
      setComposeType(null)
    },
    [wechsle],
  )
  const stopCommenting = useCallback(() => setCommenting(false), [])
  const startCompose = useCallback((type: string) => {
    setItemId(undefined)
    setEditing(false)
    setCommenting(false)
    setComposeType(type)
  }, [])
  const stopCompose = useCallback(() => setComposeType(null), [])
  const focusCreated = useCallback((id: string) => {
    setComposeType(null)
    setItemId(id)
  }, [])

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
