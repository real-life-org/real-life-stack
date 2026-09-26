import { useCallback, useEffect, useMemo, useState, startTransition } from "react"
import type { Item, RelatedItemsOptions } from "@real-life-stack/data-interface"
import { isWritable, hasRelations, isAuthenticatable, deriveContext } from "@real-life-stack/data-interface"
import { useOptionalConnector, useConnector } from "./connector-context"
import { standingMark, useCanVerifyItems, useItemStandings, type StandingMark } from "./use-item-standing"

const NO_COMMENT_ITEMS: Item[] = []

/** A comment with resolved author info, for UI rendering. */
export interface CommentWithAuthor {
  item: Item
  authorName: string
  authorAvatar?: string
  replyCount: number
  /** Standing mark (spec 08 → Beleg erforderlich): `unsigned` or `altered`
      are shown subtly marked; null is unmarked. */
  mark?: StandingMark
}

/** Return value of useComments hook. */
export interface UseCommentsResult {
  /** First-level comments sorted chronologically (oldest first). */
  data: CommentWithAuthor[]
  /** All shown comments (first + second level) for threading. Invalid
      comments without a claim are left out (spec 08 → Beleg erforderlich). */
  allComments: Item[]
  /** Standing mark per comment id, for surfaces building their own lists. */
  marks: ReadonlyMap<string, StandingMark>
  /**
   * Resolved author info per user id, covering authors of ALL comments
   * (first + second level). Consumers building reply lists from
   * `allComments` use this instead of showing the raw `createdBy`
   * (which is a DID on the WoT connector).
   */
  authors: Map<string, { name: string; avatar?: string }>
  /** Whether the data is still loading. */
  isLoading: boolean
  /** Whether the current user can comment (authenticated + writable connector). */
  canComment: boolean
  /** Create a new comment. */
  createComment: (text: string, replyTo?: string, replyToComment?: string) => Promise<void>
}

/**
 * Darf hier ueberhaupt kommentiert werden? Nur die Faehigkeiten (Spec 03),
 * ohne die Kommentare zu laden — fuer Flaechen, die allein entscheiden, ob
 * sie zum Kommentieren einladen (die Karte im Feed). Intern: `useComments`
 * beantwortet dieselbe Frage nebenbei mit.
 */
export function useCanComment(): boolean {
  // Optional, nicht werfend: Eine Karte darf auch ohne Provider gerendert
  // werden (Storybook, Tests) — dann kann niemand kommentieren.
  const connector = useOptionalConnector()
  return !!connector && isWritable(connector) && hasRelations(connector)
}

/**
 * What was said, by whom, and may I reply?
 *
 * Hook for reading and creating comments on an item.
 * Returns first-level comments with reply counts.
 *
 * @answers `{data, isLoading, canComment, createComment, …}`
 * @without empty — writing no-op
 * @group relations
 * @see story rls-foundations-hooks--relations
 * @see spec docs/spec/08-relation-records.md
 */
export function useComments(itemId: string): UseCommentsResult {
  const connector = useConnector()
  const supportsRelations = hasRelations(connector)
  const canComment = useCanComment()

  const optionsKey = JSON.stringify({ direction: "to" } satisfies RelatedItemsOptions)

  const observable = useMemo(() => {
    if (!supportsRelations) return null
    return connector.observeRelatedItems(itemId, "commentOn", { direction: "to" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connector, supportsRelations, itemId, optionsKey])

  const [relatedItems, setAllComments] = useState<Item[]>(observable?.current ?? [])
  const update = useCallback((items: Item[]) => startTransition(() => setAllComments(items)), [])

  useEffect(() => {
    if (!observable) {
      setAllComments(NO_COMMENT_ITEMS)
      return
    }
    setAllComments(observable.current)
    return observable.subscribe(update)
  }, [observable, update])

  // Standing per comment: marks for unsigned/altered, and invalid comments
  // without a claim are not shown at all.
  const standings = useItemStandings(relatedItems)
  const verifiable = useCanVerifyItems()
  const marks = useMemo(() => {
    const result = new Map<string, StandingMark>()
    for (const item of relatedItems) {
      if (item.type === "comment") result.set(item.id, standingMark(item, standings.get(item.id), verifiable))
    }
    return result
  }, [relatedItems, standings, verifiable])
  const allComments = useMemo(
    () => relatedItems.filter((item) => marks.get(item.id) !== "hidden"),
    [relatedItems, marks],
  )

  // Resolve authors and separate first/second level
  const comments: CommentWithAuthor[] = useMemo(() => {
    const commentItems = allComments.filter((c) => c.type === "comment")

    // Count replies per first-level comment
    const replyCounts = new Map<string, number>()
    for (const c of commentItems) {
      const replyTo = (c.data as { replyTo?: string }).replyTo
      if (replyTo) {
        replyCounts.set(replyTo, (replyCounts.get(replyTo) ?? 0) + 1)
      }
    }

    // First-level comments only (no replyTo)
    const firstLevel = commentItems
      .filter((c) => !(c.data as { replyTo?: string }).replyTo)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((item) => ({
        item,
        authorName: item.createdBy,
        authorAvatar: undefined as string | undefined,
        replyCount: replyCounts.get(item.id) ?? 0,
        mark: marks.get(item.id) ?? null,
      }))

    return firstLevel
  }, [allComments, marks])

  // Resolve author info asynchronously
  const [resolvedAuthors, setResolvedAuthors] = useState<Map<string, { name: string; avatar?: string }>>(new Map())

  useEffect(() => {
    if (!isAuthenticatable(connector)) return

    const authConnector = connector
    const userIds = [...new Set(allComments.map((c) => c.createdBy))]
    let cancelled = false

    async function resolve() {
      const resolved = new Map<string, { name: string; avatar?: string }>()
      for (const userId of userIds) {
        try {
          const user = await authConnector.getUser(userId)
          if (user && !cancelled) {
            resolved.set(userId, { name: user.displayName ?? user.id, avatar: user.avatarUrl })
          }
        } catch {
          // Fallback to userId
        }
      }
      if (!cancelled) {
        setResolvedAuthors(resolved)
      }
    }

    resolve()
    return () => { cancelled = true }
  }, [connector, allComments])

  // Merge resolved authors into comments
  const commentsWithAuthors: CommentWithAuthor[] = useMemo(() => {
    return comments.map((c) => {
      const author = resolvedAuthors.get(c.item.createdBy)
      return {
        ...c,
        authorName: author?.name ?? c.item.createdBy,
        authorAvatar: author?.avatar,
      }
    })
  }, [comments, resolvedAuthors])

  const createComment = useCallback(async (text: string, replyTo?: string, replyToComment?: string) => {
    if (!isWritable(connector) || !hasRelations(connector)) return

    let currentUserId = "anonymous"
    if (isAuthenticatable(connector)) {
      try {
        const user = await connector.getCurrentUser()
        if (user) currentUserId = user.id
      } catch {
        // Fallback
      }
    }

    const data: Record<string, unknown> = { content: text }
    if (replyTo) data.replyTo = replyTo
    if (replyToComment) data.replyToComment = replyToComment

    await connector.createItem({
      type: "comment",
      createdBy: currentUserId,
      "@context": deriveContext("comment", data),
      data,
      relations: [{ predicate: "commentOn", target: `item:${itemId}` }],
    })
  }, [connector, itemId])

  return {
    data: commentsWithAuthors,
    allComments,
    marks,
    authors: resolvedAuthors,
    isLoading: false,
    canComment,
    createComment,
  }
}

/** Return value of useReplies hook. */
export interface UseRepliesResult {
  /** Second-level replies sorted chronologically (oldest first). */
  data: CommentWithAuthor[]
  /** Whether the data is still loading. */
  isLoading: boolean
}

/**
 * Which replies does this comment have?
 *
 * Hook for loading second-level replies to a first-level comment.
 * Filters from the parent item's full comment list.
 *
 * @answers `{data, isLoading}`
 * @without empty
 * @group relations
 * @see story rls-foundations-hooks--relations
 * @see spec docs/spec/08-relation-records.md
 */
export function useReplies(itemId: string, commentId: string): UseRepliesResult {
  const connector = useConnector()
  const supportsRelations = hasRelations(connector)

  const [replies, setReplies] = useState<CommentWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!hasRelations(connector)) {
      setIsLoading(false)
      return
    }

    const relConnector = connector
    let cancelled = false

    async function load() {
      try {
        const allComments = await relConnector.getRelatedItems(itemId, "commentOn", { direction: "to" })
        if (cancelled) return

        const replyItems = allComments
          .filter((c: Item) => c.type === "comment" && (c.data as { replyTo?: string }).replyTo === commentId)
          .sort((a: Item, b: Item) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

        // Resolve authors
        const resolved: CommentWithAuthor[] = await Promise.all(
          replyItems.map(async (item: Item) => {
            let authorName = item.createdBy
            let authorAvatar: string | undefined

            if (isAuthenticatable(connector)) {
              try {
                const user = await connector.getUser(item.createdBy)
                if (user) {
                  authorName = user.displayName ?? user.id
                  authorAvatar = user.avatarUrl
                }
              } catch {
                // Fallback
              }
            }

            return { item, authorName, authorAvatar, replyCount: 0 }
          })
        )

        if (!cancelled) {
          setReplies(resolved)
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [connector, supportsRelations, itemId, commentId])

  // Same standing rule as useComments: mark unsigned/altered, hide invalid
  // replies without a claim.
  const replyItems = useMemo(() => replies.map((reply) => reply.item), [replies])
  const standings = useItemStandings(replyItems)
  const verifiable = useCanVerifyItems()
  const shown = useMemo(
    () => replies
      .map((reply) => ({ ...reply, mark: standingMark(reply.item, standings.get(reply.item.id), verifiable) }))
      .filter((reply) => reply.mark !== "hidden"),
    [replies, standings, verifiable],
  )

  return { data: shown, isLoading }
}
