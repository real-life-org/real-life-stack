"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { Item } from "@real-life-stack/data-interface"

/** Synthetic id for a not-yet-saved create draft (edit drafts reuse the real id). */
export const DRAFT_ITEM_ID = "__draft__"

interface DraftItemValue {
  /** The item currently being composed (create or edit), or null. Not persisted. */
  draft: Item | null
  setDraft: (draft: Item | null) => void
}

const DraftItemContext = createContext<DraftItemValue | null>(null)

/**
 * Holds the live "draft" item — the in-progress create/edit composer state as an
 * Item — so modules can show it as a preview before it's saved (a task in its
 * column, a calendar pill, a map marker). Nothing is persisted; on save the real
 * item replaces the draft, on cancel the draft just vanishes.
 *
 * One draft at a time (you can't create and edit at once). The composer
 * publishes via {@link useSetDraftItem}; modules read via {@link useItemsWithDraft}.
 */
/**
 * How long the modules may lag behind the keyboard.
 *
 * Long enough to be worth it — at 120 ms every keystroke still landed in its
 * own window and nothing was saved — and short enough that the preview still
 * follows along while a title is written. Measured in the browser on a feed of
 * 60 cards, one typed sentence: 134 renders of that feed without it, 70 with.
 * A second of coalescing would halve it again, at the price of a preview that
 * visibly trails the keyboard.
 */
const COALESCE_MS = 300

export function DraftItemProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<Item | null>(null)
  const pending = useRef<Item | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commit = useCallback((next: Item | null) => {
    setDraftState((prev) => {
      if (prev === next) return prev
      // A keystroke that maps to identical output must not churn the reference
      // every module consumes.
      if (prev && next && JSON.stringify(prev) === JSON.stringify(next)) return prev
      return next
    })
  }, [])

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    pending.current = null
  }, [])

  // Hand on whatever arrived during the window, and keep the window open for as
  // long as drafts keep coming.
  const flush = useCallback(() => {
    timer.current = null
    const queued = pending.current
    pending.current = null
    if (!queued) return
    commit(queued)
    timer.current = setTimeout(() => flush(), COALESCE_MS)
  }, [commit])

  /**
   * Publish the draft that modules preview.
   *
   * The composer republishes on every keystroke, and every module showing items
   * re-renders with it — feed, calendar, kanban, map. Writing a sentence cost
   * one full render of that surface per character. So the first draft lands at
   * once, and what arrives while typing continues is coalesced into one update
   * per window. The last one always arrives.
   *
   * Clearing is never delayed: it follows a save or a cancel, and a draft
   * landing afterwards would be the ghost of an item that no longer exists.
   */
  const setDraft = useCallback(
    (next: Item | null) => {
      if (next === null) {
        stop()
        commit(null)
        return
      }

      if (timer.current) {
        pending.current = next
        return
      }

      commit(next)
      timer.current = setTimeout(() => flush(), COALESCE_MS)
    },
    [commit, flush, stop],
  )

  // A timer outliving a quickly closed composer would publish into a tree that
  // is gone.
  useEffect(() => stop, [stop])
  const value = useMemo<DraftItemValue>(() => ({ draft, setDraft }), [draft, setDraft])
  return <DraftItemContext.Provider value={value}>{children}</DraftItemContext.Provider>
}

/** The live draft item (or null). Returns null outside a DraftItemProvider. */
export function useDraftItem(): Item | null {
  return useContext(DraftItemContext)?.draft ?? null
}

/** Publish/clear the live draft (used by the shared item composer). No-op without a provider. */
export function useSetDraftItem(): (draft: Item | null) => void {
  const ctx = useContext(DraftItemContext)
  return ctx?.setDraft ?? (() => {})
}
