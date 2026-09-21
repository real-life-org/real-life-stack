"use client"

import { memo, useMemo, useCallback, useEffect, useRef } from "react"
import { FileText, SearchX } from "lucide-react"
import { isAggregateVisibleItemType, type Item, type User } from "@real-life-stack/data-interface"

import { useCurrentUser } from "../hooks/use-auth"
import { useModuleFilteredItems } from "../hooks/use-filterable-items"
import { useItemGroupResolver, useItemPrivacyResolver } from "../hooks/use-item-group-color"
import { useItemFocus } from "../hooks/use-item-focus"
import { useResolvedUsers } from "../hooks/use-resolved-users"
import { FeedComposerTrigger } from "../components/feed/feed-composer-trigger"
import { useSharedFilter } from "../components/filter/filter-store"
import { useCreate } from "../components/host/create-host"
import { useModuleHost } from "../components/host/module-host"
import { ModuleToolbar } from "../components/layout/module-toolbar"
import { useModulePanel } from "../components/module-panel/module-panel"
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
 * search), not a field-activated module like map or calendar. So it shows every
 * item that forms an entry of its own and asks `isAggregateVisibleItemType` instead of
 * enumerating types — a place, task or project reaches the feed the day it
 * exists, without a second list to maintain here (Anton, 2026-08-17: the feed
 * shows all that is new, not only posts).
 *
 * Exported as a plain function so the membership rule is testable without
 * mounting the feed.
 */
export function selectFeedItems(items: readonly Item[]): Item[] {
  return items.filter((item) => isAggregateVisibleItemType(item.type)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Das Feed-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host; B1,
 * 21.09.2026 — bis dahin `FeedView` in der Referenz-App). Der Host laedt
 * UNGEFILTERT (kein `presents` im Eintrag): the feed's job is "what's new
 * here", so it reads the scope's items and drops only what has no card of its
 * own (see selectFeedItems). A field-based query would tie feed membership to
 * `data.content` — a place with a description would show up, the same place
 * without one would not. Mitglieder, Aggregat-Fall und Gruppenfarben kommen
 * vom Host; Detail, Erstellen (Vollbild) und Plusknopf stellt er.
 */
export function FeedModule({ items = [], itemsLoading: isLoading = false }: ModuleViewProps) {
  const { members, isOverview, resolveItemGroupColor, setCreateAnchor } = useModuleHost()
  const { data: currentUser } = useCurrentUser()

  const feedItems = useMemo(() => selectFeedItems(items), [items])

  // Resolve author info as a User the shared ItemPreview can render
  // directly. Falls back to undefined when the createdBy id isn't a
  // known member; ItemPreview then shows the raw id with an initials
  // avatar.
  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  )
  // Members can lag behind synced items (membership entry not yet arrived) —
  // resolve unknown authors through the connector cascade (contacts!) before
  // ever showing a raw DID.
  const unknownAuthorIds = useMemo(
    () => [...new Set(feedItems.map(({ createdBy }) => createdBy))].filter((id) => !memberMap.has(id) && id !== currentUser?.id),
    [feedItems, memberMap, currentUser],
  )
  const resolvedAuthors = useResolvedUsers(unknownAuthorIds)
  const resolveAuthor = useCallback(
    (createdBy: string): User | undefined => {
      const member = memberMap.get(createdBy)
      if (member) return member
      if (currentUser?.id === createdBy) return currentUser
      return resolvedAuthors.get(createdBy)
    },
    [memberMap, currentUser, resolvedAuthors],
  )

  // Detail panel — shared single panel via ModulePanelProvider
  const modulePanel = useModulePanel()
  // URL is the single source of truth for the focused item: a click writes
  // `/{scope}/feed/{id}` and an effect below opens the detail + scrolls to it;
  // browser-back clears the URL and closes the panel.
  const { itemId: focusedId, focusItem } = useItemFocus()
  // Origin group per item — only surfaced as a badge in the aggregate view.
  const resolveItemGroup = useItemGroupResolver()
  // Private items (in the personal space, shared with nobody) get a „Privat" badge.
  const isItemPrivate = useItemPrivacyResolver()

  // Reveal: scroll the focused card into view once it is in the rendered
  // (filtered) list. The host opens the detail panel itself; this only handles
  // the feed-specific scroll. Filtered out → the panel still opens, scroll no-ops.
  const revealedIdRef = useRef<string | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  useEffect(() => {
    if (!focusedId) {
      revealedIdRef.current = null
      return
    }
    if (revealedIdRef.current === focusedId) return
    const el = itemRefs.current.get(focusedId)
    if (!el) return // not rendered yet — re-runs when feedItems updates
    revealedIdRef.current = focusedId
    el.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focusedId, feedItems])

  // Filter und Suche gehoeren der App-Shell, nicht diesem View: Der Kopf der
  // Modulflaeche zeigt sie, und beim Wechsel ins Kanban wirken sie weiter.
  const { value: filterBarValue, searchText } = useSharedFilter()
  const filteredFeedItems = useModuleFilteredItems(feedItems)
  // The type filter offers the types actually PRESENT — same derivation as the
  // tags above. Label and icon come from the type register (spec 06), so a new
  // type is filterable without touching this view. `type` may drive a user
  // filter (spec 06 Z.93), it just must not decide feed membership.
  // Distinguishes "no items at all" from "filtered/searched to nothing" for the
  // empty state copy.
  const filterActive =
    searchText.trim() !== "" || filterBarValue.tags.length > 0 || filterBarValue.types.length > 0

  // Erstellen laeuft ueber den Modul-Host (Vollbild, `options.createShell`
  // im Eintrag). Die Pille schlaegt nur den Beitrag vor.
  const { startCreate } = useCreate()

  // Die Pille ist der Einstieg ins Schreiben, solange sie im Bild ist; der
  // Plusknopf des Hosts beobachtet sie (`setCreateAnchor`) und tritt an ihre
  // Stelle, sobald sie weggescrollt ist (Spec shared-components →
  // „Feed-Sonderfall").

  // Stable so a card's wrapper keeps its ref callback across renders —
  // otherwise React detaches and reattaches every card on every render of the
  // list.
  const registerItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }, [])

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
              active={modulePanel.current?.itemId === item.id}
              activeColor={resolveItemGroupColor(item)}
              groupName={group?.name}
              groupColor={group ? resolveItemGroupColor(item) : undefined}
              isPrivate={isOverview && isItemPrivate(item)}
              onFocus={focusItem}
              registerRef={registerItemRef}
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
  registerRef: (id: string, el: HTMLDivElement | null) => void
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
