import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"
import { ReactionDetails } from "./reaction-details"
import { useReactions } from "../../hooks/use-reactions"
import { STORY_POST, STORY_SEED, STORY_USERS, StoryWorld, storyReaction } from "../../story-support/story-world"

/**
 * „Wer hat reagiert" — die Liste hinter einer Reaktionspille.
 *
 * Die Namen und Bilder holt die Komponente selbst über `useReactionUsers` aus
 * dem Connector; die aggregierten Zahlen reicht die aufrufende Fläche durch,
 * damit sie nicht zweimal gezählt werden. Genau so macht es die `ReactionBar`.
 * Die Stories zeigen deshalb dieselbe Verdrahtung an echten Daten.
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

/** Zehn Menschen, verteilt auf die angegebenen Reaktionen. */
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

/** Wie eine Fläche die Liste öffnet: Zahlen aus `useReactions`, Namen holt sie selbst. */
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
  id: "rls-module-components-reactions-reactiondetails",
  title: "RLS/Items/Detailansicht/Reaktionen und Kommentare/ReactionDetails",
  component: ReactionDetails,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="p-8">{Story()}</div>],
}

export default meta
type Story = StoryObj<typeof ReactionDetails>

/** Alle Reaktionen, nach Häufigkeit sortiert. Der Reiter oben filtert. */
export const AllReactions: Story = {
  render: () => (
    <StoryWorld seed={withReactors({ emoji: "❤️", count: 4 }, { emoji: "👍", count: 2 }, { emoji: "😂", count: 2 }, { emoji: "🔥", count: 2 })}>
      <DetailsSurface />
    </StoryWorld>
  ),
}

/** Vorgefiltert, weil die Person auf genau diese Pille gedrückt hat. */
export const FilteredByEmoji: Story = {
  render: () => (
    <StoryWorld seed={withReactors({ emoji: "❤️", count: 4 }, { emoji: "👍", count: 2 }, { emoji: "😂", count: 2 }, { emoji: "🔥", count: 2 })}>
      <DetailsSurface initialEmoji="❤️" />
    </StoryWorld>
  ),
}

/** Wenige Reaktionen: die Liste bleibt kurz, der Filter trotzdem da. */
export const FewReactions: Story = {
  render: () => (
    <StoryWorld seed={withReactors({ emoji: "👍", count: 2 }, { emoji: "🎉", count: 1 })}>
      <DetailsSurface />
    </StoryWorld>
  ),
}
