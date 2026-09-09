"use client"

import { useCallback, useState, type ReactNode } from "react"
import { CommentSection } from "../comments/comment-section"
import { CommentInput, type CommentQuote } from "../comments/comment-input"
import { cn } from "../../lib/utils"

/**
 * Shared skeleton for an item's detail panel: a scrollable area with a
 * caller-provided top slot, the item's comment list below it, and a
 * comment input pinned to the bottom (outside the scroll container).
 *
 * The top slot is deliberately a plain children slot — the module decides
 * what "detail" means for it: the Feed renders a read-only ItemPreview
 * card, Kanban renders a live-updating ContentComposer in edit mode. Both
 * share the identical comment wiring below, which used to be duplicated
 * in the reference app (FeedView detail panel + TaskEditPanel).
 *
 * What this component does NOT decide: how it is opened or framed
 * (AdaptivePanel, dialog, route — caller's choice) and what the top slot
 * looks like. Those are UX decisions that stay with the consumer.
 */
export interface ItemDetailPanelProps {
  /** Item whose comments are shown and where new comments land. */
  itemId: string
  /** Top slot: view card, edit form, … rendered inside the scroll area. */
  children: ReactNode
  /** Optional reactions renderer for individual comments. */
  renderCommentReactions?: (commentId: string) => ReactNode
  /**
   * @deprecated Ohne Wirkung. Die Diskussion traegt keine Ueberschrift mehr —
   * Blasen unter einem Item sind als Kommentare erkennbar, und ohne Kommentare
   * stuende dort eine Ueberschrift ohne Inhalt.
   */
  commentsLabel?: string
  className?: string
}

export function ItemDetailPanel({
  itemId,
  children,
  renderCommentReactions,
  className,
}: ItemDetailPanelProps) {
  // Reply wiring: CommentSection owns the comment tree and hands us its
  // submit/cancel callbacks whenever the reply target changes; CommentInput
  // sits outside the scroll container so it stays visible while scrolling.
  const [replyTo, setReplyTo] = useState<CommentQuote | null>(null)
  const [submit, setSubmit] = useState<((text: string) => Promise<void>) | null>(null)
  const [cancel, setCancel] = useState<(() => void) | null>(null)

  // The mirrored reply state above is per-item. When the panel is reused
  // for a different item (same instance, no remount), drop it immediately
  // instead of waiting for CommentSection's onReplyChange effect — that
  // fires only after commit, leaving one frame of the previous item's
  // reply quote in the input. CommentSection resets its own state the
  // same way.
  const [prevItemId, setPrevItemId] = useState(itemId)
  if (itemId !== prevItemId) {
    setPrevItemId(itemId)
    setReplyTo(null)
    setSubmit(null)
    setCancel(null)
  }

  const handleReplyChange = useCallback(
    (nextReplyTo: CommentQuote | null, nextSubmit: (text: string) => Promise<void>, nextCancel: () => void) => {
      setReplyTo(nextReplyTo)
      setSubmit(() => nextSubmit)
      setCancel(() => nextCancel)
    },
    [],
  )

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex-1 overflow-y-auto min-h-0">
        {children}

        {/* Keine Ueberschrift ueber der Diskussion: Blasen unter einem Item
            sind als Kommentare erkennbar, und ohne Kommentare stuende dort
            eine Ueberschrift ohne Inhalt. Der Trenner gehoert zur
            Aktionszeile darueber, nicht hierher. */}
        <CommentSection
          itemId={itemId}
          renderReactions={renderCommentReactions}
          hideInput
          onReplyChange={handleReplyChange}
        />
      </div>

      <CommentInput
        onSubmit={submit ?? (async () => {})}
        replyTo={replyTo}
        onCancelReply={cancel ?? undefined}
      />
    </div>
  )
}
