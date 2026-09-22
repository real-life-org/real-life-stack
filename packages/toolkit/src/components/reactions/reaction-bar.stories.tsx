import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"
import { ReactionBar } from "./reaction-bar"
import { ItemPreview } from "../preview/item-preview"
import { ItemTypeBadge } from "../preview/item-type-badge"
import {
  STORY_ME,
  STORY_POST,
  STORY_SEED,
  STORY_USERS,
  StoryWorld,
  storyReaction,
} from "../../story-support/story-world"

/**
 * **ReactionBar** reads its reactions through `useReactions` from the connector
 * and writes one back on click. That is why a real data source stands behind
 * every story: clicking takes effect, the numbers change, a second click on
 * the same reaction takes it back. A long press or a click on a pill opens
 * "who reacted".
 *
 * A reaction is an item of the class `reaction` with a relation `reactsTo`.
 * Without relations the bar is gone; without a write capability it is
 * read-only. Where it sits: as the footer of the card in the feed and at the
 * bottom of the detail — a rule of the type, not of the module.
 */

/** A post with exactly the given reactions, otherwise an empty world. */
function withReactions(...reactions: { emoji: string; by: string[] }[]) {
  const items: Item[] = [STORY_POST]
  let n = 0
  for (const { emoji, by } of reactions) {
    for (const user of by) items.push(storyReaction(`r${++n}`, user, emoji))
  }
  return {
    ...STORY_SEED,
    // Genug Menschen für die größeren Beispiele, ohne den Grundbestand zu ändern.
    users: [...STORY_USERS, ...Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, displayName: `Person ${i + 1}` }))],
    items,
  }
}

const many = (emoji: string, count: number, withMe = false) => ({
  emoji,
  by: [...(withMe ? [STORY_ME.id] : []), ...Array.from({ length: count - (withMe ? 1 : 0) }, (_, i) => `p${i}`)],
})

const meta: Meta<typeof ReactionBar> = {
  id: "rls-module-components-reactions-reactionbar",
  title: "RLS/Items/Detail view/Reactions and comments/ReactionBar",
  component: ReactionBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof ReactionBar>

/** Four reactions, one of them mine. */
export const Default: Story = {
  name: "Four reactions, one mine",
  render: () => (
    <StoryWorld seed={withReactions(many("❤️", 12), many("👍", 5, true), many("😂", 3), many("🔥", 2))}>
      <div className="p-8">
        <ReactionBar itemId={STORY_POST.id} />
      </div>
    </StoryWorld>
  ),
}

/** A single reaction — the most common case in the feed. */
export const SingleReaction: Story = {
  name: "A single reaction",
  render: () => (
    <StoryWorld seed={withReactions(many("👍", 1))}>
      <div className="p-8">
        <ReactionBar itemId={STORY_POST.id} />
      </div>
    </StoryWorld>
  ),
}

/** Nobody has reacted yet: only the trigger stands there. */
export const NoReactions: Story = {
  name: "No reactions yet",
  render: () => (
    <StoryWorld seed={withReactions()}>
      <div className="p-8">
        <ReactionBar itemId={STORY_POST.id} />
      </div>
    </StoryWorld>
  ),
}

/** Six different reactions that just about all fit. */
export const ManyReactions: Story = {
  name: "Six reactions",
  render: () => (
    <StoryWorld
      seed={withReactions(
        many("❤️", 8),
        many("👍", 6, true),
        many("😂", 4),
        many("🔥", 3),
        many("🎉", 2),
        many("👏", 1),
      )}
    >
      <div className="p-8">
        <ReactionBar itemId={STORY_POST.id} />
      </div>
    </StoryWorld>
  ),
}

/** More than `maxVisible`: the rest goes behind an overflow pill. */
export const Overflow: Story = {
  name: "Overflow behind a pill",
  render: () => (
    <StoryWorld
      seed={withReactions(
        many("❤️", 8),
        many("👍", 6),
        many("😂", 4),
        many("🔥", 3),
        many("🎉", 2),
        many("👏", 2),
        many("🙏", 1),
      )}
    >
      <div className="p-8">
        <ReactionBar itemId={STORY_POST.id} maxVisible={4} />
      </div>
    </StoryWorld>
  ),
}

/** How the bar sits in the feed: as the footer of the item card. */
export const InPostCard: Story = {
  name: "Inside the post card",
  render: () => (
    <StoryWorld seed={withReactions(many("❤️", 12), many("👍", 5, true), many("😂", 3))}>
      <div className="mx-auto max-w-lg p-8">
        <ItemPreview
          item={STORY_POST}
          author={STORY_ME}
          headerAdornment={<ItemTypeBadge type={STORY_POST.type} />}
          footerAdornment={<ReactionBar itemId={STORY_POST.id} />}
        />
      </div>
    </StoryWorld>
  ),
}
