import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"

import { ItemDetailBody } from "./item-detail-body"
import { ItemDetailActions } from "./item-detail-actions"
import { ItemDetailSkeleton } from "./item-detail-skeleton"
import { ItemMetaRow } from "../preview/item-meta-row"
import { ItemTypeBadge } from "../preview/item-type-badge"
import { ReactionBar } from "../reactions/reaction-bar"
import { STORY_EVENT, STORY_ME, STORY_POST, StoryWorld, storyReaction } from "../../story-support/story-world"

/**
 * **ItemDetailBody** is the reading view inside the detail panel: title, type
 * badge, facts, text, tags, author. It brings no frame and no actions of its
 * own — both are handed in by the surface. In the app that is `ItemDetailView`,
 * which puts the ⋮ menu top right (`ItemDetailActions`: edit, share, delete,
 * by permission) and the reaction bar at the bottom. Exactly these real
 * building blocks stand here, so the story does not show what the app does
 * not do.
 *
 * What the body shows follows the **item**, never the module that opened it:
 * the type register picks the presentation from the item's classes.
 *
 * Where next: comments and reactions under the body in
 * [Content and discussion](?path=/docs/rls-items-detail-panel--docs).
 */

const REACTED = {
  items: [STORY_EVENT, STORY_POST, storyReaction("r1", "jonas", "👍", STORY_EVENT.id), storyReaction("r2", "lea", "👍", STORY_EVENT.id), storyReaction("r3", "mira", "🎉", STORY_EVENT.id)],
}

const meta: Meta<typeof ItemDetailBody> = {
  tags: ["autodocs"],
  id: "rls-items-detail-body",
  title: "RLS/Items/Detail view/Anatomy and content",
  component: ItemDetailBody,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <StoryWorld seed={REACTED}>
        {/* Der Rahmen gehört dem Panel, nicht der Ansicht: hier nachgestellt,
            damit sichtbar wird, dass die Ansicht selbst keinen mitbringt. */}
        <div className="w-[360px] overflow-hidden rounded-2xl border bg-background shadow-xl">{Story()}</div>
      </StoryWorld>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ItemDetailBody>

/** An event with everything the surface contributes: type, facts, menu, reactions. */
export const Event: Story = {
  name: "Event",
  render: () => (
    <ItemDetailBody
      item={STORY_EVENT}
      author={STORY_ME}
      headerAdornment={<ItemTypeBadge type={STORY_EVENT.type} />}
      actions={<ItemDetailActions item={STORY_EVENT} title={String(STORY_EVENT.data.title)} onEdit={() => {}} />}
      meta={<ItemMetaRow item={STORY_EVENT} />}
      footer={<ReactionBar itemId={STORY_EVENT.id} />}
    />
  ),
}

/** A post without title, facts or tags: only text and author. */
export const TextOnly: Story = {
  name: "Text only",
  render: () => (
    <ItemDetailBody
      item={{ ...STORY_POST, tags: undefined, data: { content: "Kurz notiert: der Schlüssel liegt wieder im Café." } } as Item}
      author={STORY_ME}
    />
  ),
}

/** Many tags: they clamp, the author keeps their row. */
export const ManyTags: Story = {
  name: "Many tags",
  render: () => (
    <ItemDetailBody
      item={{ ...STORY_EVENT, tags: ["repair", "community", "nachbarschaft", "werkstatt", "offen"] } as Item}
      author={STORY_ME}
      headerAdornment={<ItemTypeBadge type={STORY_EVENT.type} />}
      actions={<ItemDetailActions item={STORY_EVENT} title={String(STORY_EVENT.data.title)} onEdit={() => {}} />}
      meta={<ItemMetaRow item={STORY_EVENT} />}
    />
  ),
}

/** While the item is not there yet. */
export const Loading: Story = {
  name: "Loading",
  render: () => <ItemDetailSkeleton />,
}
