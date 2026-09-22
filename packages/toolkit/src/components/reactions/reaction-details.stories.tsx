import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"
import { ReactionDetails } from "./reaction-details"
import { useReactions } from "../../hooks/use-reactions"
import { STORY_POST, STORY_SEED, STORY_USERS, StoryWorld, storyReaction } from "../../story-support/story-world"

/**
 * **ReactionDetails** — "who reacted", the list behind a reaction pill.
 *
 * Names and pictures the component fetches itself through `useReactionUsers`
 * from the connector; the aggregated counts are handed in by the calling
 * surface so they are not counted twice. That is exactly what `ReactionBar`
 * does. The stories therefore show the same wiring on real data.
 */

const PEOPLE = [
  ["Anna Schmidt", "women/44"],
  ["Thomas Müller", "men/32"],
  ["Lena Weber", "women/68"],
  ["Sebastian Koch", "men/67"],
  ["Marie Fischer", null],
  ["Anton Berger", "men/45"],
  ["Timo Richter", null],
  ["Ulf Neumann", "men/52"],
  ["Clara Hoffmann", "women/22"],
  ["Jan Becker", null],
] as const

/** Ten people, spread over the given reactions. */
function withReactors(...groups: { emoji: string; count: number }[]) {
  const users = PEOPLE.map(([displayName, portrait], i) => ({
    id: `u${i + 1}`,
    displayName,
    ...(portrait ? { avatarUrl: `https://randomuser.me/api/portraits/${portrait}.jpg` } : {}),
  }))
  const items: Item[] = [STORY_POST]
  let next = 0
  for (const { emoji, count } of groups) {
    for (let i = 0; i < count; i++) items.push(storyReaction(`r${next + 1}`, users[next++ % users.length].id, emoji))
  }
  return { ...STORY_SEED, users: [...users, ...STORY_USERS], items }
}

/** How a surface opens the list: counts from `useReactions`, names it fetches itself. */
function DetailsSurface({ initialEmoji }: { initialEmoji?: string }) {
  const { reactions } = useReactions(STORY_POST.id)
  return (
    <div className="mx-auto h-80 max-w-sm overflow-hidden rounded-lg border bg-background shadow-lg">
      <ReactionDetails
        itemId={STORY_POST.id}
        reactions={reactions}
        initialEmoji={initialEmoji}
        onClose={() => {}}
      />
    </div>
  )
}

const meta: Meta<typeof ReactionDetails> = {
  id: "rls-items-reaction-details",
  title: "RLS/Items/Detail view/Reactions and comments/ReactionDetails",
  component: ReactionDetails,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="p-8">{Story()}</div>],
}

export default meta
type Story = StoryObj<typeof ReactionDetails>

/** All reactions, sorted by frequency. The tab at the top filters. */
export const AllReactions: Story = {
  name: "All reactions",
  render: () => (
    <StoryWorld seed={withReactors({ emoji: "❤️", count: 4 }, { emoji: "👍", count: 2 }, { emoji: "😂", count: 2 }, { emoji: "🔥", count: 2 })}>
      <DetailsSurface />
    </StoryWorld>
  ),
}

/** Pre-filtered, because the person pressed exactly this pill. */
export const FilteredByEmoji: Story = {
  name: "Filtered by one emoji",
  render: () => (
    <StoryWorld seed={withReactors({ emoji: "❤️", count: 4 }, { emoji: "👍", count: 2 }, { emoji: "😂", count: 2 }, { emoji: "🔥", count: 2 })}>
      <DetailsSurface initialEmoji="❤️" />
    </StoryWorld>
  ),
}

/** Few reactions: the list stays short, the filter is still there. */
export const FewReactions: Story = {
  name: "Few reactions",
  render: () => (
    <StoryWorld seed={withReactors({ emoji: "👍", count: 2 }, { emoji: "🎉", count: 1 })}>
      <DetailsSurface />
    </StoryWorld>
  ),
}
