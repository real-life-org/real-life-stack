"use client"

import { useCallback, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { useComments } from "@/hooks/use-comments"
import type { CommentWithAuthor } from "@/hooks/use-comments"
import { CommentInput, type CommentQuote } from "./comment-input"
import { CommentThread } from "./comment-thread"

export interface CommentSectionProps {
  /** ID of the item to show comments for. */
  itemId: string
  /** Placeholder text for the input. Default: "Kommentar schreiben..." */
  placeholder?: string
  /** Slot builder for ReactionBar per comment. */
  renderReactions?: (itemId: string) => React.ReactNode
  /** Additional CSS classes. */
  className?: string
}

/**
 * Complete comment section: scrollable comment list + sticky input at the bottom.
 * Fills its container via flex layout. The consumer controls the container height.
 */
export function CommentSection({
  itemId,
  placeholder,
  renderReactions,
  className,
}: CommentSectionProps) {
  const { comments, allComments, canComment, createComment } = useComments(itemId)
  const [replyTo, setReplyTo] = useState<CommentQuote | null>(null)
  const [replyToFirstLevel, setReplyToFirstLevel] = useState<string | null>(null)

  // Build replies per first-level comment from allComments
  const repliesByParent = useMemo(() => {
    const map = new Map<string, CommentWithAuthor[]>()
    for (const c of allComments) {
      if (c.type !== "comment") continue
      const replyToId = (c.data as { replyTo?: string }).replyTo
      if (!replyToId) continue // first-level, skip

      const list = map.get(replyToId) ?? []
      list.push({
        item: c,
        authorName: c.createdBy,
        authorAvatar: undefined,
        replyCount: 0,
      })
      map.set(replyToId, list)
    }
    // Sort each list chronologically
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime())
    }
    return map
  }, [allComments])

  const handleReply = useCallback((comment: CommentWithAuthor) => {
    const data = comment.item.data as { content: string; replyTo?: string }
    const isSecondLevel = !!data.replyTo

    setReplyTo({
      id: comment.item.id,
      authorName: comment.authorName,
      text: (data.content ?? "").slice(0, 80),
    })

    setReplyToFirstLevel(isSecondLevel ? data.replyTo! : comment.item.id)
  }, [])

  const handleSubmit = useCallback(async (text: string) => {
    if (replyTo && replyToFirstLevel) {
      const replyToComment = replyTo.id !== replyToFirstLevel ? replyTo.id : undefined
      await createComment(text, replyToFirstLevel, replyToComment)
    } else {
      await createComment(text)
    }
    setReplyTo(null)
    setReplyToFirstLevel(null)
  }, [createComment, replyTo, replyToFirstLevel])

  const handleCancelReply = useCallback(() => {
    setReplyTo(null)
    setReplyToFirstLevel(null)
  }, [])

  return (
    <div className={cn("flex flex-col min-h-full", className)}>
      {/* Comment list — grows to push input to the bottom */}
      <div className="flex-1">
        {comments.length > 0 && (
          <div className="space-y-4 p-4">
            {comments.map((comment) => (
              <CommentThread
                key={comment.item.id}
                comment={comment}
                replies={repliesByParent.get(comment.item.id) ?? []}
                onReply={canComment ? handleReply : undefined}
                canReply={canComment}
                renderReactions={renderReactions}
              />
            ))}
          </div>
        )}
      </div>

      {/* Input at the bottom — sticky when scrolling, pushed down by flex-1 when not */}
      {canComment && (
        <div className="sticky bottom-0 bg-background z-10">
          <CommentInput
            onSubmit={handleSubmit}
            replyTo={replyTo}
            onCancelReply={handleCancelReply}
            placeholder={placeholder}
          />
        </div>
      )}
    </div>
  )
}
