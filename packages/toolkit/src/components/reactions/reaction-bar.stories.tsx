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
 * Die Leiste liest ihre Reaktionen über `useReactions` aus dem Connector und
 * schreibt beim Klick eine Reaktion zurück. Deshalb steht hinter jeder Story
 * eine echte Datenquelle: Klicken wirkt, die Zahlen ändern sich, ein zweiter
 * Klick auf dieselbe Reaktion nimmt sie zurück. Ein Langdruck oder ein Klick
 * auf eine Pille öffnet „wer hat reagiert".
 */

/** Ein Beitrag mit genau den angegebenen Reaktionen, sonst leere Welt. */
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
  title: "RLS/Items/Detailansicht/Reaktionen und Kommentare/ReactionBar",
  component: ReactionBar,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof ReactionBar>

/** Vier Reaktionen, eine davon meine. */
export const Default: Story = {
  render: () => (
    <StoryWorld seed={withReactions(many("❤️", 12), many("👍", 5, true), many("😂", 3), many("🔥", 2))}>
      <div className="p-8">
        <ReactionBar itemId={STORY_POST.id} />
      </div>
    </StoryWorld>
  ),
}

/** Eine einzelne Reaktion — der häufigste Fall im Feed. */
export const SingleReaction: Story = {
  render: () => (
    <StoryWorld seed={withReactions(many("👍", 1))}>
      <div className="p-8">
        <ReactionBar itemId={STORY_POST.id} />
      </div>
    </StoryWorld>
  ),
}

/** Noch niemand hat reagiert: nur der Auslöser steht da. */
export const NoReactions: Story = {
  render: () => (
    <StoryWorld seed={withReactions()}>
      <div className="p-8">
        <ReactionBar itemId={STORY_POST.id} />
      </div>
    </StoryWorld>
  ),
}

/** Sechs verschiedene Reaktionen, die gerade noch alle passen. */
export const ManyReactions: Story = {
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

/** Mehr als `maxVisible`: der Rest wandert hinter eine Sammelpille. */
export const Overflow: Story = {
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

/** So sitzt die Leiste im Feed: als Fußzeile der Item-Karte. */
export const InPostCard: Story = {
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
