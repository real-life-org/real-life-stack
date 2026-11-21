import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life/data-interface"

import { ItemDetailBody } from "./item-detail-body"
import { ItemDetailActions } from "./item-detail-actions"
import { ItemDetailSkeleton } from "./item-detail-skeleton"
import { ItemTypeBadge } from "../preview/item-type-badge"
import { resolveTypePresentation } from "../preview/type-presentation"
import { ReactionBar } from "../reactions/reaction-bar"
import { STORY_EVENT, STORY_ME, STORY_POST, STORY_TASK, STORY_USERS, StoryWorld, storyReaction } from "../../story-support/story-world"

const STORY_USERS_JONAS = STORY_USERS[1]

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
 * the type register picks the presentation from the item's classes. The meta
 * box is derived from the type's **field and edge register** (spec 06): one
 * row per field or edge with an icon, in the order people → time → place →
 * item edges → values. Empty fields produce no row.
 *
 * The body has nine slots in a fixed order (`head`, `meta`, `actions`,
 * `content`, `reverse`, `tags`, `bar`, `comments`, `note`); a slot without
 * content produces nothing.
 *
 * Where next: comments and reactions under the body in
 * [Content and discussion](?path=/docs/rls-items-detail-panel--docs).
 */

/** Die Meta-Box, wie der Detail-Host sie zeichnet: aus dem Register des Typs. */
function RegisterDetail({ item }: { item: Item }) {
  const Detail = resolveTypePresentation(item.type).detail
  return <Detail item={item} />
}

const INVITED_EVENT: Item = {
  ...STORY_EVENT,
  relations: [
    { predicate: "invited", target: "global:jonas" },
    { predicate: "invited", target: "global:lea" },
  ],
}

const REACTED = {
  items: [INVITED_EVENT, STORY_POST, STORY_TASK, storyReaction("r1", "jonas", "👍", STORY_EVENT.id), storyReaction("r2", "lea", "👍", STORY_EVENT.id), storyReaction("r3", "mira", "🎉", STORY_EVENT.id)],
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

/**
 * An event with everything the surface contributes: type, facts, menu,
 * reactions. The meta box comes from the register: invited people, date,
 * place — one row each.
 */
export const Event: Story = {
  name: "Event",
  render: () => (
    <ItemDetailBody
      item={INVITED_EVENT}
      author={STORY_ME}
      headerAdornment={<ItemTypeBadge type={INVITED_EVENT.type} />}
      actions={<ItemDetailActions item={INVITED_EVENT} title={String(INVITED_EVENT.data.title)} onEdit={() => {}} />}
      meta={<RegisterDetail item={INVITED_EVENT} />}
      footer={<ReactionBar itemId={INVITED_EVENT.id} />}
    />
  ),
}

/**
 * A task: who it is assigned to stands in the meta box like any other people
 * edge — no type footer. Status and order are in the register too; status
 * reads as a chip from S4, order never shows (module position).
 */
export const Task: Story = {
  name: "Task",
  render: () => (
    <ItemDetailBody
      item={STORY_TASK}
      author={STORY_USERS_JONAS}
      headerAdornment={<ItemTypeBadge type={STORY_TASK.type} />}
      meta={<RegisterDetail item={STORY_TASK} />}
      footer={<ReactionBar itemId={STORY_TASK.id} />}
    />
  ),
}

/**
 * The slot order with placeholders in the slots that later steps fill
 * (`actions` S2, `reverse` S3, `note` S5).
 */
export const Slots: Story = {
  name: "Slot order",
  render: () => (
    <ItemDetailBody
      item={INVITED_EVENT}
      author={STORY_ME}
      headerAdornment={<ItemTypeBadge type={INVITED_EVENT.type} />}
      meta={<RegisterDetail item={INVITED_EVENT} />}
      selfActions={<SlotMarker>actions — Selbstaktion (S2)</SlotMarker>}
      reverse={<SlotMarker>reverse — Rückwärts-Listen (S3)</SlotMarker>}
      footer={<ReactionBar itemId={INVITED_EVENT.id} />}
      note={<SlotMarker>note — Hinweis (S5)</SlotMarker>}
    />
  ),
}

function SlotMarker({ children }: { children: string }) {
  return <div className="w-full rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">{children}</div>
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
      meta={<RegisterDetail item={STORY_EVENT} />}
    />
  ),
}

/** While the item is not there yet. */
export const Loading: Story = {
  name: "Loading",
  render: () => <ItemDetailSkeleton />,
}
