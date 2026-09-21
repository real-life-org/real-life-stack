"use client"

import { memo, useMemo, useCallback } from "react"
import { FileText, SearchX } from "lucide-react"
import type { Item, User } from "@real-life-stack/data-interface"

import { useItemGroupResolver, useItemPrivacyResolver } from "../hooks/use-item-group-color"
import { useItemFocus } from "../hooks/use-item-focus"
import { FeedComposerTrigger } from "../components/feed/feed-composer-trigger"
import { useCreate } from "../components/host/create-host"
import { useModuleHost } from "../components/host/module-host"
import { ModuleToolbar } from "../components/layout/module-toolbar"
import { ItemCommentCount } from "../components/preview/item-comment-count"
import { ItemGroupBadge } from "../components/preview/item-group-badge"
import { ItemMetaRow } from "../components/preview/item-meta-row"
import { ItemPreview } from "../components/preview/item-preview"
import { ItemPreviewSkeleton } from "../components/preview/item-preview-skeleton"
import { ItemPrivateBadge } from "../components/preview/item-private-badge"
import { ItemTypeBadge } from "../components/preview/item-type-badge"
import { renderTypeFooter } from "../components/preview/type-presentation"
import { EmptyState } from "../components/primitives/empty-state"
import { ReactionBar } from "../components/reactions/reaction-bar"
import type { ModuleViewProps } from "../lib/module-register"

/**
 * Everything new in the network, newest first: the feed is an AGGREGATING view
 * (spec 06 §"Verhältnis zwischen Schema- und Feldfiltern" names it alongside
 * search), not a field-activated module like map or calendar. Welche Items
 * als eigene Karte stehen, entscheidet der Host fuer jedes aggregierende
 * Modul (`isAggregateVisibleItemType`) — a place, task or project reaches the
 * feed the day it exists (Anton, 2026-08-17). Was dem Feed bleibt, ist die
 * Reihenfolge: das Neueste zuerst.
 */
export function selectFeedItems(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function FeedModule({ items = [], itemsLoading: isLoading = false }: ModuleViewProps) {
  const { currentUser, resolveAuthor, activeItemId, filterActive, registerItemElement, isOverview, resolveItemGroupColor, setCreateAnchor } = useModuleHost()
  const feedItems = useMemo(() => selectFeedItems(items), [items])
  const { focusItem } = useItemFocus()
  // Origin group per item — only surfaced as a badge in the aggregate view.
  const resolveItemGroup = useItemGroupResolver()
  // Private items (in the personal space, shared with nobody) get a „Privat" badge.
  const isItemPrivate = useItemPrivacyResolver()
  // Erstellen laeuft ueber den Modul-Host (Vollbild, `options.createShell`
  // im Eintrag). Die Pille schlaegt nur den Beitrag vor.
  const { startCreate } = useCreate()
  const filteredFeedItems = feedItems

  return (
    <div className="space-y-4">
      <ModuleToolbar />

      {/* Composer trigger — hands off to the create host (fullscreen). */}
      <div ref={setCreateAnchor}>
        <FeedComposerTrigger
          placeholder="Was gibt's Neues?"
          userName={currentUser?.displayName}
          userAvatar={currentUser?.avatarUrl}
          onCompose={(initialText) => startCreate("post", initialText ? { text: initialText } : undefined)}
        />
      </div>

      {/* Feed items — skeleton while loading, empty state once loaded with
          nothing, otherwise the list. */}
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ItemPreviewSkeleton key={`skeleton-${i}`} />)
        ) : filteredFeedItems.length === 0 ? (
          <EmptyState
            icon={filterActive ? SearchX : FileText}
            title={filterActive ? "Keine Treffer" : "Noch nichts hier"}
            description={
              filterActive
                ? "Passe Suche oder Filter an."
                : "Hier erscheint alles Neue — Beiträge, Termine, Orte, Aufgaben."
            }
          />
        ) : (
          filteredFeedItems.map((item) => {
          // In the aggregate view, show which group an item comes from — a chip
          // next to the type badge (analogous to it). Omitted inside a single group.
          const group = isOverview ? resolveItemGroup(item) : undefined
          return (
            <FeedCard
              key={item.id}
              item={item}
              author={resolveAuthor(item.createdBy)}
              active={activeItemId === item.id}
              activeColor={resolveItemGroupColor(item)}
              groupName={group?.name}
              groupColor={group ? resolveItemGroupColor(item) : undefined}
              isPrivate={isOverview && isItemPrivate(item)}
              onFocus={focusItem}
              registerRef={registerItemElement}
            />
          )
          })
        )}
      </div>
    </div>
  )
}

/**
 * Feed card footer: a ReactionBar on the left, the comment count on the right.
 *
 * Reactions are NOT type-dependent. Tasks were excluded here ("Tasks
 * intentionally don't get reactions in the feed view today"); Anton corrected
 * that — an item is reactable regardless of its type.
 *
 * Exported as a plain function so the rule is testable without mounting the
 * whole feed.
 */
/**
 * One row of the feed.
 *
 * Its own component so its props can stay stable: the badges, the click and the
 * ref are built in here instead of in the list. That is what lets the memo on
 * {@link ItemPreview} bite — while someone writes in the composer the draft is
 * republished, this list renders again, and without this every card on screen
 * rendered with it.
 */
const FeedCard = memo(function FeedCard({
  item,
  author,
  active,
  activeColor,
  groupName,
  groupColor,
  isPrivate,
  onFocus,
  registerRef,
}: {
  item: Item
  author: User | undefined
  active: boolean
  activeColor?: string
  groupName?: string
  groupColor?: string
  isPrivate: boolean
  onFocus: (id: string) => void
  registerRef: (id: string, el: Element | null) => void
}) {
  const focus = useCallback(() => onFocus(item.id), [onFocus, item.id])
  const ref = useCallback(
    (el: HTMLDivElement | null) => registerRef(item.id, el),
    [registerRef, item.id],
  )

  return (
    <div ref={ref}>
      <ItemPreview
        item={item}
        author={author}
        active={active}
        activeColor={activeColor}
        onClick={focus}
        headerAdornment={
          <>
            <ItemTypeBadge type={item.type} />
            {groupName && groupColor && <ItemGroupBadge name={groupName} color={groupColor} />}
            {isPrivate && <ItemPrivateBadge />}
          </>
        }
        metaAdornment={<ItemMetaRow item={item} />}
        footerAdornment={feedFooter(item, focus)}
      />
    </div>
  )
})

export function feedFooter(item: Item, onCommentClick: () => void) {
  const commentCount = (item.data as Record<string, unknown>).commentCount
  const count = typeof commentCount === "number" ? commentCount : 0
  // Type-own footer (statement -> votes, task -> assignees) comes from the
  // type register (spec 06, rule 3) - this surface adds ONLY its own
  // conventions: reactions left, comment count right. No type branching.
  return (
    <div className="flex w-full flex-col gap-2">
      {renderTypeFooter(item)}
      <div className="flex items-center">
        <ReactionBar itemId={item.id} />
        {count > 0 && (
          <div className="ml-auto">
            <ItemCommentCount count={count} onClick={onCommentClick} />
          </div>
        )}
      </div>
    </div>
  )
}
