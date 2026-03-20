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
  const { comments, isLoading, canComment, createComment } = useComments(itemId)
  const [replyTo, setReplyTo] = useState<CommentQuote | null>(null)
  // Track which first-level comment the reply belongs to (for replyTo field)
  const [replyToFirstLevel, setReplyToFirstLevel] = useState<string | null>(null)

  // Build a map of comment ID → replies (second-level)
  // We need all comments including second-level for threading
  // The useComments hook returns first-level only, but we need replies too
  // For now, replies are loaded lazily inside CommentThread

  const handleReply = useCallback((comment: CommentWithAuthor) => {
    const data = comment.item.data as { content: string; replyTo?: string }
    const isSecondLevel = !!data.replyTo

    setReplyTo({
      id: comment.item.id,
      authorName: comment.authorName,
      text: (data.content ?? "").slice(0, 80),
    })

    // If replying to a second-level comment, the replyTo field should be the first-level parent
    setReplyToFirstLevel(isSecondLevel ? data.replyTo! : comment.item.id)
  }, [])

  const handleSubmit = useCallback(async (text: string) => {
    if (replyTo && replyToFirstLevel) {
      // Reply — replyTo is always the first-level parent
      // replyToComment is the actual comment being replied to (for quote display)
      const replyToComment = replyTo.id !== replyToFirstLevel ? replyTo.id : undefined
      await createComment(text, replyToFirstLevel, replyToComment)
    } else {
      // Top-level comment
      await createComment(text)
    }
    setReplyTo(null)
    setReplyToFirstLevel(null)
  }, [createComment, replyTo, replyToFirstLevel])

  const handleCancelReply = useCallback(() => {
    setReplyTo(null)
    setReplyToFirstLevel(null)
  }, [])

  // TODO: replies are not yet loaded here — CommentThread would need them
  // For now, pass empty replies (the useReplies hook can be integrated later)
  const emptyReplies = useMemo(() => [] as CommentWithAuthor[], [])

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Scrollable comment list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Loading...
          </div>
        ) : comments.length === 0 ? (
          // Empty state — no message, the input is the invitation
          null
        ) : (
          <div className="space-y-4 p-4">
            {comments.map((comment) => (
              <CommentThread
                key={comment.item.id}
                comment={comment}
                replies={emptyReplies}
                onReply={canComment ? handleReply : undefined}
                canReply={canComment}
                renderReactions={renderReactions}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sticky input at the bottom */}
      {canComment && (
        <CommentInput
          onSubmit={handleSubmit}
          replyTo={replyTo}
          onCancelReply={handleCancelReply}
          placeholder={placeholder}
        />
      )}
    </div>
  )
}
