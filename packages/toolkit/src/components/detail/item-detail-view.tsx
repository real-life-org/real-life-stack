"use client"

import { type ReactNode, useCallback, useState } from "react"
import type { Item } from "@real-life-stack/data-interface"
import { ItemDetailPanel } from "./item-detail-panel"
import { ItemDetailActions } from "./item-detail-actions"
import { ItemDetailSkeleton } from "./item-detail-skeleton"
import {
  type ContentComposerProps,
  type ContentTypeConfig,
  type WidgetData,
} from "../composer/content-composer"
import { ItemComposer } from "../composer/item-composer"
import type { ItemEditorMapper } from "../../hooks/use-item-editor"
import { useIsFrozen } from "../../hooks/use-item-frozen"
import { useItem } from "../../hooks/use-items"
import { useConnector } from "../../hooks/connector-context"
import { hasItemGroups, normalizeItemType } from "@real-life-stack/data-interface"

export interface ItemDetailViewProps {
  /** The item to show. The view subscribes via `useItem`, so it always renders
   *  the live item and reflects edits / external updates; a loading skeleton
   *  shows until it resolves. Key this component on `itemId` upstream so a
   *  different item starts fresh in read mode. */
  itemId: string
  /** Read-view body. Receives the live item plus the action menu (⋮ +
   *  „Bearbeiten") to embed in the card header (ItemPreview `actions` slot). */
  renderRead: (item: Item, actions: ReactNode) => ReactNode
  /** Composer config for editing (widget types + labels). Pass only the item's
   *  own type to avoid a type switcher. */
  contentTypes: ContentTypeConfig[]
  /** Edit-aware mapper (composer submission → item payload; uses `existingItem`). */
  mapper: ItemEditorMapper
  /** Pre-fill the composer from the (live) item. */
  editInitialData: (item: Item) => Partial<WidgetData>
  /** Extra ContentComposer props per module (people/tag suggestions, geocode,
   *  map-pick, liveUpdate, …). Core props (types/initialData/editMode/submit/
   *  cancel) stay owned here. */
  composerProps?: Partial<ContentComposerProps>
  /** Passthrough to ItemDetailPanel (reaction bars on comments). */
  renderCommentReactions?: (commentId: string) => ReactNode
  /** Cursor gleich ins Kommentarfeld — siehe {@link ItemDetailPanelProps}. */
  focusComposer?: boolean
  onComposerFocused?: () => void
  /** Close the panel — after a delete, or to clear the URL focus. */
  onClose: () => void
  /** Share/copy a link to the item. */
  onShare?: () => void
  /** Controlled read↔edit mode (e.g. URL-driven via `?edit`). When provided the
   *  view is controlled and reports transitions through {@link onModeChange};
   *  omit it to use internal state (the default). */
  mode?: "read" | "edit"
  onModeChange?: (mode: "read" | "edit") => void
}

/**
 * Shared item-detail body: a read view and an inline edit composer in the SAME
 * panel (read↔edit toggle), plus the permission-gated action menu (⋮ +
 * „Bearbeiten"). Owns its own `useItemEditor`, so a caller passes only
 * declarative config. Rendered by the app-level detail host above the outlet
 * (so it persists across module switches); the caller keys it on `itemId`.
 */
export function ItemDetailView({
  itemId,
  renderRead,
  contentTypes,
  mapper,
  editInitialData,
  composerProps,
  renderCommentReactions,
  focusComposer,
  onComposerFocused,
  onClose,
  onShare,
  mode: modeProp,
  onModeChange,
}: ItemDetailViewProps) {
  const { data: item } = useItem(itemId)
  const connector = useConnector()
  // Spec 08 → Einfrieren: once another person bound a reference to the
  // content, its wording can no longer be edited — the edit entry disappears
  // (resonance.md, Wortlaut rule 3; the type offers a new version instead).
  const frozen = useIsFrozen(item)
  // Uncontrolled by default; controlled when a `mode` prop is supplied (URL-driven).
  const [internalMode, setInternalMode] = useState<"read" | "edit">("read")
  const mode = modeProp ?? internalMode
  const changeMode = useCallback(
    (next: "read" | "edit") => {
      onModeChange?.(next)
      if (modeProp === undefined) setInternalMode(next)
    },
    [onModeChange, modeProp],
  )

  if (!item) {
    return (
      <ItemDetailPanel itemId={itemId} renderCommentReactions={renderCommentReactions}>
        <ItemDetailSkeleton />
      </ItemDetailPanel>
    )
  }

  // Lock the edit composer to the item's own template (no type switcher in
  // phase 1): narrow the caller's full type list to the one matching class. NO
  // fallback to the full list — for an item none of whose classes has a
  // template, editing is simply not offered (a fallback would show a wrong
  // type switcher / form).
  const vorlage = editTemplateFor(item, contentTypes)
  const composerTypes = vorlage ? contentTypes.filter((t) => t.id === vorlage) : []
  const canEdit = composerTypes.length > 0 && !frozen

  // Pre-fill the group widget with the item's ACTUAL group/space (not just the
  // config's defaultGroup = current space) so editing in the aggregate view
  // shows where the item really lives. Persisted back via useItemEditor.
  const itemGroup = hasItemGroups(connector) ? connector.getItemGroupId(item.id) : null
  const initialData = {
    ...editInitialData(item),
    ...(itemGroup ? { group: itemGroup } : {}),
  }

  const title = typeof item.data.title === "string" ? item.data.title : undefined
  const actions = (
    <ItemDetailActions
      item={item}
      title={title}
      onEdit={canEdit ? () => changeMode("edit") : undefined}
      onDeleted={onClose}
      onShare={onShare}
    />
  )

  return (
    <ItemDetailPanel
      itemId={item.id}
      renderCommentReactions={renderCommentReactions}
      focusComposer={focusComposer}
      onComposerFocused={onComposerFocused}
    >
      {mode === "read" ? (
        renderRead(item, actions)
      ) : (
        <ItemComposer
          key={item.id}
          className="p-4"
          existingItem={item}
          contentTypes={composerTypes}
          initialContentType={vorlage}
          initialData={initialData}
          mapper={mapper}
          composerProps={composerProps}
          onDone={() => changeMode("read")}
          onCancel={() => changeMode("read")}
        />
      )}
    </ItemDetailPanel>
  )
}

/**
 * Welche Vorlage bearbeitet dieses Item? Die erste Klasse des Items, fuer die
 * es einen Inhaltstyp gibt — ueber die normalisierte Klassenmenge, nie ueber
 * den rohen String (Spec 06, Regeln 7 und 9). Ein Item `["post", "statement"]`
 * bearbeitet als Beitrag; ohne Treffer gibt es kein Bearbeiten (rls#417).
 */
export function editTemplateFor(item: Pick<Item, "type">, contentTypes: readonly { id: string }[]): string | undefined {
  const ids = new Set(contentTypes.map((t) => t.id))
  return normalizeItemType(item.type).find((k) => ids.has(k))
}
