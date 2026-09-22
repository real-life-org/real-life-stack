import type { Meta, StoryObj } from "@storybook/react-vite"
import type { CommentWithAuthor } from "@/hooks/use-comments"
import type { Item } from "@real-life-stack/data-interface"
import { CommentInput } from "./comment-input"
import { CommentBubble } from "./comment-bubble"
import { CommentThread } from "./comment-thread"
import { CommentSection } from "./comment-section"
import { STORY_POST, StoryWorld } from "../../story-support/story-world"

// ---- Mock Data ----

function mockItem(id: string, createdBy: string, createdAt: string, data: Record<string, unknown>): Item {
  return { id, type: "comment", createdBy, createdAt, data, relations: [] }
}

const MOCK_COMMENTS: CommentWithAuthor[] = [
  {
    item: mockItem("c1", "user-1", "2026-03-20T10:00:00Z", { content: "Tolle Idee! Bin dabei." }),
    authorName: "Anna Schmidt",
    authorAvatar: "https://randomuser.me/api/portraits/women/44.jpg",
    replyCount: 2,
  },
  {
    item: mockItem("c2", "user-2", "2026-03-20T11:00:00Z", { content: "Wann genau? Samstag passt mir gut." }),
    authorName: "Thomas Müller",
    authorAvatar: "https://randomuser.me/api/portraits/men/32.jpg",
    replyCount: 0,
  },
  {
    item: mockItem("c3", "user-3", "2026-03-20T12:30:00Z", { content: "Ich bringe Kuchen mit! 🎂" }),
    authorName: "Lena Weber",
    authorAvatar: "https://randomuser.me/api/portraits/women/68.jpg",
    replyCount: 1,
  },
]

const MOCK_REPLIES_C1: CommentWithAuthor[] = [
  {
    item: mockItem("r1", "user-2", "2026-03-20T10:15:00Z", { content: "Super, ich komme auch!", replyTo: "c1" }),
    authorName: "Thomas Müller",
    authorAvatar: "https://randomuser.me/api/portraits/men/32.jpg",
    replyCount: 0,
  },
  {
    item: mockItem("r2", "user-3", "2026-03-20T10:30:00Z", {
      content: "Ich bringe Kuchen mit!",
      replyTo: "c1",
      replyToComment: "r1",
    }),
    authorName: "Lena Weber",
    authorAvatar: "https://randomuser.me/api/portraits/women/68.jpg",
    replyCount: 0,
  },
]


// ---- Standalone CommentSection for Storybook ----

// ---- Stories ----

const meta: Meta = {
  id: "rls-module-components-comments-commentsection",
  title: "RLS/Items/Detail view/Reactions and comments/CommentSection",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="p-8 min-h-screen">
        <div className="max-w-lg mx-auto">
          <Story />
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj

/**
 * Der ganze Bereich an einer echten Datenquelle: Liste, Antworten, Eingabe.
 * Schreiben wirkt — ein neuer Kommentar erscheint sofort, eine Antwort klappt
 * ihren Strang auf. `CommentSection` holt sich alles über `useComments`; die
 * Fläche gibt ihr nur die Kennung des Items.
 */
export const FullSection: Story = {
  name: "CommentSection",
  render: () => (
    <StoryWorld>
      <div className="h-[32rem] overflow-hidden rounded-lg border bg-background">
        <CommentSection itemId={STORY_POST.id} />
      </div>
    </StoryWorld>
  ),
}

export const InputDefault: Story = {
  name: "CommentInput — Default",
  render: () => (
    <div className="max-w-lg border rounded-lg bg-background">
      <CommentInput onSubmit={(text) => console.log("Submit:", text)} />
    </div>
  ),
}

export const InputWithReply: Story = {
  name: "CommentInput — Reply Mode",
  render: () => (
    <div className="max-w-lg border rounded-lg bg-background">
      <CommentInput
        onSubmit={(text) => console.log("Reply:", text)}
        replyTo={{ id: "c1", authorName: "Anna Schmidt", text: "Tolle Idee! Bin dabei." }}
        onCancelReply={() => console.log("Cancel reply")}
      />
    </div>
  ),
}

export const SingleBubble: Story = {
  name: "CommentBubble",
  render: () => (
    <div className="max-w-lg p-4">
      <CommentBubble
        authorName="Anna Schmidt"
        authorAvatar="https://randomuser.me/api/portraits/women/44.jpg"
        content="Tolle Idee! Bin dabei. Wer kommt noch mit?"
        timestamp={new Date(Date.now() - 2 * 3600000).toISOString()}
        onReply={() => console.log("Reply")}
      />
    </div>
  ),
}

export const BubbleWithQuote: Story = {
  name: "CommentBubble — with Quote",
  render: () => (
    <div className="max-w-lg p-4">
      <CommentBubble
        authorName="Lena Weber"
        authorAvatar="https://randomuser.me/api/portraits/women/68.jpg"
        content="Ich bringe Kuchen mit!"
        timestamp={new Date(Date.now() - 30 * 60000).toISOString()}
        quotedAuthor="Thomas"
        quotedText="Super, ich komme auch!"
        onReply={() => console.log("Reply")}
      />
    </div>
  ),
}

export const ThreadWithReplies: Story = {
  name: "CommentThread — with Replies",
  render: () => (
    <div className="max-w-lg p-4">
      <CommentThread
        comment={MOCK_COMMENTS[0]}
        replies={MOCK_REPLIES_C1}
        defaultExpanded
        onReply={(c) => console.log("Reply to:", c.authorName)}
      />
    </div>
  ),
}

export const ThreadCollapsed: Story = {
  name: "CommentThread — Collapsed",
  render: () => (
    <div className="max-w-lg p-4">
      <CommentThread
        comment={MOCK_COMMENTS[0]}
        replies={MOCK_REPLIES_C1}
        onReply={(c) => console.log("Reply to:", c.authorName)}
      />
    </div>
  ),
}
