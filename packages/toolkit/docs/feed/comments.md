# Comments — Requirements Specification

## 1. Overview

**Comments** allow users to discuss content items. The system supports two levels of nesting: first-level comments on items, and second-level replies on first-level comments. Comments are themselves items (`type: "comment"`) linked via `commentOn` relations.

### Commentable item types

All content items that can be created via the ContentComposer are commentable:
- **Posts** (`type: "post"`)
- **Events** (`type: "event"`)
- **Tasks** (`type: "task"`)

### Design principles

- **Two-level threading** — first-level comments on items, second-level replies on comments. No deeper nesting.
- **Reply to any comment** — users can reply to both first-level and second-level comments. Replies always appear as second-level under the first-level parent.
- **Messenger-style input** — the comment input resembles a chat message box: single-line initially, grows with content.
- **Quote on reply** — when replying to a specific comment, the input shows a quote reference above it.
- **Collapsible replies** — second-level comments are collapsed by default and must be expanded to be seen.
- **Reactions on comments** — comments support the same reaction system as posts/events.

---

## 2. Data Model

### Comment as an Item

A comment is a dedicated item type with its own data structure:

```typescript
{
  id: "comment-1",
  type: "comment",
  createdBy: "user-1",
  createdAt: "2026-03-20T14:30:00Z",
  data: {
    content: "Tolle Idee! Bin dabei.",
    replyTo: "comment-0",        // optional — ID of the comment being replied to
    reactions: { "👍": 3 },       // inherited from Reactable
    myReaction: "👍"              // inherited from Reactable
  },
  relations: [
    { predicate: "commentOn", target: "item:post-1" }
  ]
}
```

### Threading model

```
Post (or Event, Task)
├── Comment A (first-level) — commentOn → Post
│   ├── Comment B (second-level) — commentOn → Post, replyTo: A
│   └── Comment C (second-level) — commentOn → Post, replyTo: A
├── Comment D (first-level) — commentOn → Post
│   └── Comment E (second-level) — commentOn → Post, replyTo: D
│       ↑ Comment F replies to E — commentOn → Post, replyTo: D (grouped under D, not E)
```

**Key rules:**
- All comments carry a `commentOn` relation pointing to the **root item** (post/event/task), regardless of nesting level. This makes querying all comments for an item a single relation lookup.
- `data.replyTo` determines the **visual threading**: if set, the comment is a second-level reply displayed under the referenced first-level comment.
- When replying to a second-level comment (e.g. replying to Comment E), the reply is stored with `replyTo` pointing to the **first-level parent** (Comment D), not the second-level comment. This enforces the two-level limit. The replied-to comment (E) is referenced in `data.replyToComment` for the quote display.

### Updated data structure

```typescript
export interface CommentData extends Reactable {
  /** Comment text content. */
  content: string
  /** ID of the first-level comment this is a reply to. If undefined, this is a first-level comment. */
  replyTo?: string
  /** ID of the specific comment being replied to (for quote display). May differ from replyTo when replying to a second-level comment. */
  replyToComment?: string
}

export type CommentItem = Item & { type: "comment"; data: CommentData }
```

### Relations

```typescript
export interface CommentRelations {
  forward: {
    /** Comment belongs to a root item → any Item (scope: item:, 1) */
    commentOn: Item
  }
  reverse: {
    /** Reactions on this comment (reactsTo → this comment, 0..n) */
    reactsTo: ReactionItem
  }
}
```

### Querying

- **Get all comments for a post:** `getRelatedItems(postId, "commentOn", { direction: "to" })` — returns all first-level and second-level comments
- **Separate first/second level:** Filter by `data.replyTo`: undefined = first-level, set = second-level
- **Get replies for a first-level comment:** Filter all comments where `data.replyTo === commentId`
- **Get comment count:** Read from `item.data.commentCount` (denormalized, see below)

### Comment count on parent item

Like reactions, the comment count is denormalized on the parent item to avoid extra requests:

```typescript
// Mixin for item types that support comments
export interface Commentable {
  /** Total number of comments. Maintained by connector. */
  commentCount?: number
}
```

`PostData`, `EventData`, and `TaskData` extend `Commentable`.

---

## 3. User Stories

### Comment list

- **US-C1**: As a user I see a list of first-level comments below a post/event/task, sorted chronologically (oldest first).
- **US-C2**: As a user I see each comment with: author avatar, author name, relative timestamp (e.g. "vor 2 Stunden"), and comment text.
- **US-C3**: As a user I see a reply count indicator on first-level comments that have replies (e.g. "3 Antworten"). The replies are collapsed by default.
- **US-C4**: As a user I can click the reply count to expand/collapse the second-level replies below a first-level comment.
- **US-C5**: As a user I see second-level replies indented below their parent, sorted chronologically.
- **US-C6**: As a user I see a ReactionBar on each comment (first-level and second-level).
- **US-C7**: As a user I see a "Reply" button/link on each comment (first-level and second-level).

### Comment input

- **US-C8**: As a user I see a comment input sticky at the bottom of the view (like a messenger), always visible regardless of scroll position in the comment list.
- **US-C9**: As a user the input starts as a single line and grows vertically as I type more text (auto-expanding textarea, max ~5 lines before scrolling).
- **US-C10**: As a user I can submit my comment by pressing Enter (without Shift). Shift+Enter inserts a newline.
- **US-C11**: As a user I see a send button that is only enabled when the input is non-empty.
- **US-C12**: As a user, after submitting, the input clears and my comment appears immediately in the list (optimistic update).

### Replying

- **US-C13**: As a user, when I click "Reply" on a comment, the input box scrolls into view (if needed) and shows a **quote reference** above it with the replied-to comment's author name and a preview of their text (truncated).
- **US-C14**: As a user I can dismiss the quote reference (X button) to cancel the reply and return to writing a top-level comment.
- **US-C15**: As a user, when I reply to a first-level comment, my reply appears as a second-level comment under it.
- **US-C16**: As a user, when I reply to a second-level comment, my reply also appears as a second-level comment under the same first-level parent — but includes a quote reference showing who I replied to.
- **US-C17**: As a user I see the quote reference displayed inline in second-level replies that were made in response to another second-level comment (e.g. "↩ @Anna: Tolle Idee...").

### General

- **US-C18**: As a user I see a total comment count displayed on the parent item (e.g. "12 Kommentare").
- **US-C19**: As a user I see new comments from other users appear in real-time (via observable pattern).
- **US-C20**: As a user I can react to any comment using the same ReactionBar as on posts.
- **US-C21**: As an unauthenticated user I can read comments but the input box and reply buttons are hidden.
- **US-C22**: As a developer I can embed `<CommentSection itemId="..." />` on any commentable item. The component handles data fetching, threading, and mutations internally.

---

## 4. Component Architecture

### Components

```
CommentSection         — container: comment list + input, manages state
  CommentList          — renders first-level comments with collapsible replies
    CommentThread      — a first-level comment + its collapsed/expanded replies
      CommentBubble    — single comment: avatar, name, time, text, ReactionBar, reply button
      QuoteReference   — inline quote showing replied-to comment (in second-level replies)
  CommentInput         — messenger-style input with auto-expand, quote preview, send button
    CommentQuotePreview — quote reference above input when replying
```

### Hooks

```
useComments(itemId)      — returns first-level comments, reply counts, loading state
useReplies(commentId)    — returns second-level replies for a first-level comment, lazy-loaded
useCreateComment()       — creates a comment with commentOn relation + optional replyTo
```

### Component tree

```tsx
{/* CommentSection fills available height with flex layout */}
<CommentSection itemId="post-1" className="flex flex-col h-full">
  {/* Scrollable comment list */}
  <CommentList className="flex-1 overflow-y-auto">
    <CommentThread comment={firstLevel}>
      <CommentBubble comment={firstLevel} onReply={() => ...} />
      {/* Collapsed by default, expandable */}
      <div className="replies">
        <CommentBubble comment={secondLevel}>
          <QuoteReference author="Anna" text="Tolle Idee..." />
        </CommentBubble>
      </div>
    </CommentThread>
  </CommentList>

  {/* Sticky at the bottom — always visible */}
  <CommentInput
    onSubmit={(text) => createComment(text)}
    replyTo={selectedComment}  {/* shows quote preview when set */}
    onCancelReply={() => setSelectedComment(null)}
    className="sticky bottom-0 border-t bg-background"
  />
</CommentSection>
```

---

## 5. CommentInput Behavior

### Messenger-style input

The input mimics a chat/messenger input box and is always sticky at the bottom of the view:

- **Sticky bottom** — fixed to the bottom of the CommentSection, always visible regardless of scroll position in the comment list above
- **Single line by default** — starts as a standard input height (~40px)
- **Auto-expanding** — grows with content up to ~5 lines (~120px), then scrolls internally. The comment list above shrinks accordingly.
- **Submit on Enter** — Enter submits, Shift+Enter inserts newline
- **Send button** — visible on the right, enabled only when input is non-empty
- **Placeholder** — "Kommentar schreiben..." (or configurable)

### Quote preview (reply mode)

When replying to a comment, a quote preview appears above the input:

```
┌─────────────────────────────────────────────┐
│ ↩ Anna Schmidt                          ✕   │
│ "Tolle Idee! Bin dabei."                    │
├─────────────────────────────────────────────┤
│ [Your reply here...]              [Send]    │
└─────────────────────────────────────────────┘
```

- Author name is shown with a reply icon (↩)
- Text is truncated to ~80 characters with ellipsis
- X button dismisses the reply and returns to top-level comment mode
- The input auto-focuses when entering reply mode

### Implementation

```
<textarea> with:
  - rows="1"
  - overflow-y: hidden (until max height reached, then auto)
  - resize: none
  - height adjusts via JS on input event (scrollHeight measurement)
  - onKeyDown: Enter without Shift → submit, Shift+Enter → newline
```

No contentEditable, no rich text editor. Plain textarea with auto-resize.

---

## 6. Threading Display

### First-level comments

```
┌──────────────────────────────────────┐
│ 👤 Anna Schmidt · vor 2 Stunden     │
│ Tolle Idee! Bin dabei.               │
│ [❤️ 3  👍 1]  [↩ Reply]             │
│                                      │
│ ▸ 3 Antworten                        │  ← collapsed toggle
└──────────────────────────────────────┘
```

### Expanded replies (second-level)

```
┌──────────────────────────────────────┐
│ 👤 Anna Schmidt · vor 2 Stunden     │
│ Tolle Idee! Bin dabei.               │
│ [❤️ 3  👍 1]  [↩ Reply]             │
│                                      │
│ ▾ 3 Antworten                        │  ← expanded toggle
│                                      │
│   👤 Thomas Müller · vor 1 Stunde   │  ← indented
│   Super, ich komme auch!             │
│   [👍 1]  [↩ Reply]                 │
│                                      │
│   👤 Lena Weber · vor 30 Min.       │
│   ↩ @Thomas: Super, ich komme...    │  ← quote ref (replied to Thomas)
│   Ich bringe Kuchen mit!             │
│   [↩ Reply]                         │
└──────────────────────────────────────┘
```

### Indentation

- First-level: no indent
- Second-level: left padding (~40px or avatar-width offset)
- No third level — replies to second-level comments appear at second-level with a quote reference

---

## 7. Animations

- **Expand/collapse replies:** `grid-template-rows: 0fr → 1fr`, 200ms ease-out. No Framer Motion.
- **New comment appear:** Subtle fade-in (`opacity 0→1`, 150ms).
- **Quote preview appear/dismiss:** Slide-down/slide-up via `max-height` transition, 150ms.

---

## 8. Accessibility

- CommentInput is focusable and supports keyboard submission (Enter)
- Reply buttons are keyboard-accessible (Enter/Space)
- Expand/collapse toggle has `aria-expanded` state
- Comment count is announced: "3 Antworten, collapsed" / "3 Antworten, expanded"
- Quote reference has `aria-label` describing the replied-to comment
- Screen reader announces new comments

---

## 9. Props Interfaces

```typescript
interface CommentSectionProps {
  /** ID of the item to show comments for. */
  itemId: string
  /** Placeholder text for the input. Default: "Kommentar schreiben..." */
  placeholder?: string
  /** Additional CSS classes. */
  className?: string
}

interface CommentInputProps {
  /** Callback when a comment is submitted. */
  onSubmit: (text: string) => void
  /** Comment being replied to (shows quote preview). */
  replyTo?: { id: string; authorName: string; text: string } | null
  /** Callback to cancel reply mode. */
  onCancelReply?: () => void
  /** Placeholder text. */
  placeholder?: string
  /** Whether the input is disabled (e.g. unauthenticated). */
  disabled?: boolean
  /** Additional CSS classes. */
  className?: string
}

interface CommentBubbleProps {
  /** The comment item. */
  comment: Item
  /** Author info (resolved from createdBy). */
  author: { name: string; avatar?: string }
  /** Relative timestamp string. */
  timestamp: string
  /** Callback when reply button is clicked. */
  onReply?: (comment: Item) => void
  /** Quote reference for second-level replies to other second-level comments. */
  quotedAuthor?: string
  quotedText?: string
  /** Additional CSS classes. */
  className?: string
}

interface CommentThreadProps {
  /** The first-level comment. */
  comment: Item
  /** Second-level replies. */
  replies: Item[]
  /** Whether replies are initially expanded. Default: false. */
  defaultExpanded?: boolean
  /** Callback when reply button is clicked on any comment in the thread. */
  onReply?: (comment: Item) => void
}
```

---

## 10. Edge Cases and Behavioral Rules

### Authentication
- Unauthenticated users can read comments and reactions but the input box, reply buttons, and reaction toggle are hidden.

### Optimistic updates
- New comments appear immediately in the list after submission. If the request fails, the comment is removed with an error indication.

### Empty state
- If an item has no comments, only the input box is shown (no "no comments" message — the input itself is the invitation to comment).

### Self-commenting
- Users can comment on their own posts/events/tasks.

### Deleted users
- Comments from deleted users show "Unknown" as author name with a fallback avatar. The comment content remains visible.

### Long comments
- Comment text is displayed in full (no truncation). Very long comments get a scrollable container or "show more" expansion (future consideration).

### Comment deletion
- Not in scope for v1. Future consideration: author can delete own comments, showing "[Kommentar gelöscht]" placeholder.

### Comment editing
- Not in scope for v1.

---

## 11. Scope and Non-Goals

### In scope
- CommentSection with two-level threading
- CommentInput with messenger-style auto-expand and quote preview
- Reply to any comment (first or second level)
- Collapsible second-level replies
- Reactions on comments (via existing ReactionBar)
- Comment count denormalized on parent item
- Real-time updates via observable pattern
- Keyboard accessibility

### Not in scope (future)
- Comment editing
- Comment deletion
- Markdown/rich text in comments
- @mentions in comments
- Media attachments in comments
- Comment pagination / infinite scroll (relevant for items with many comments)
- Pinned comments
- Comment moderation tools

---

## Changelog

| Date | Change |
|---|---|
| 2026-03-20 | Initial requirements specification |
