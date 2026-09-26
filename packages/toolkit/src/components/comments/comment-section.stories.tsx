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
  id: "rls-items-comment-section",
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
 * **CommentSection** is the discussion under an item: the list, replies as
 * threads, the input. It runs on a real data source here — writing takes
 * effect, a new comment appears at once, a reply unfolds its thread.
 * `CommentSection` fetches everything through `useComments`; the surface only
 * hands it the item's id.
 *
 * Comments are items of the class `comment` with a relation `commentOn`; a
 * reply carries `replyTo`. Without relations there are no comments; without a
 * write capability the input is gone.
 *
 * The parts below the section — input, bubble, thread — are shown on their own
 * so their states can be compared.
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

/**
 * Beleg-Status (Spec 08 → Beleg erforderlich): ein belegter Kommentar ohne
 * Markierung, ein unsignierter (vor der Signatur entstanden) dezent markiert,
 * einer, dessen Text nicht zur Signatur passt, als „verändert". Markiert wird
 * nur auf Connectoren, die prüfen können.
 */
export const BubbleStanding: Story = {
  name: "CommentBubble — Beleg-Status",
  render: () => (
    <div className="max-w-lg space-y-4 p-4">
      <CommentBubble
        authorName="Anna Schmidt"
        authorAvatar="https://randomuser.me/api/portraits/women/44.jpg"
        content="Signiert und unverändert."
        timestamp={new Date(Date.now() - 3 * 3600000).toISOString()}
      />
      <CommentBubble
        authorName="Thomas Müller"
        authorAvatar="https://randomuser.me/api/portraits/men/32.jpg"
        content="Vor der Signaturpflicht geschrieben."
        timestamp={new Date(Date.now() - 2 * 3600000).toISOString()}
        mark="unsigned"
      />
      <CommentBubble
        authorName="Lena Weber"
        authorAvatar="https://randomuser.me/api/portraits/women/68.jpg"
        content="Nachträglich an der Signatur vorbei geändert."
        timestamp={new Date(Date.now() - 3600000).toISOString()}
        mark="altered"
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
