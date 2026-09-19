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
 * Die Leseansicht im Detail-Panel.
 *
 * Sie bringt selbst keinen Rahmen mit und keine Aktionen: Beides reicht die
 * Fläche durch. In der App ist das `ItemDetailView`, das oben rechts das
 * ⋮-Menü (`ItemDetailActions`: Bearbeiten, Teilen, Löschen, je nach Recht) und
 * unten die Reaktionsleiste einsetzt. Genau diese echten Bausteine stehen hier,
 * damit die Story nicht zeigt, was die App nicht tut.
 */

const REACTED = {
  items: [STORY_EVENT, STORY_POST, storyReaction("r1", "jonas", "👍", STORY_EVENT.id), storyReaction("r2", "lea", "👍", STORY_EVENT.id), storyReaction("r3", "mira", "🎉", STORY_EVENT.id)],
}

const meta: Meta<typeof ItemDetailBody> = {
  id: "detail-itemdetailbody",
  title: "RLS/Items/Detailansicht/Anatomie und Inhalt",
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

/** Ein Termin mit allem, was die Fläche beisteuert: Typ, Fakten, Menü, Reaktionen. */
export const Event: Story = {
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

/** Ein Beitrag ohne Titel, ohne Fakten, ohne Tags: nur Text und Urheber. */
export const NurText: Story = {
  render: () => (
    <ItemDetailBody
      item={{ ...STORY_POST, tags: undefined, data: { content: "Kurz notiert: der Schlüssel liegt wieder im Café." } } as Item}
      author={STORY_ME}
    />
  ),
}

/** Viele Tags: sie kappen, der Urheber bleibt in seiner Zeile. */
export const VieleTags: Story = {
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

/** Solange das Item noch nicht da ist. */
export const Laedt: Story = {
  render: () => <ItemDetailSkeleton />,
}
