import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../../story-support/host-world"

/**
 * **The feed** is the aggregating view of a space: everything that stands as a
 * card of its own — posts, events, tasks, places — newest first, with comments
 * and reactions on the card. It is a toolkit module and runs inside the module
 * host (spec 01): this story contains no line of feed wiring.
 *
 * What is the feed's own: the sort order and the **pill** at the top, the entry
 * into writing. While the pill is in view, the host's plus button steps back;
 * once it is scrolled away, the plus button takes its place. Create opens
 * fullscreen (`options.createShell`) with "Beitrag" (post) suggested — all
 * types stay selectable.
 *
 * Without a write capability the pill and the plus button are gone; the feed
 * still reads. Without relations there are no comments and reactions; the
 * cards still show.
 *
 * Where next: the card is [ItemPreview](?path=/story/rls-items-item-preview--bare),
 * the detail on click [Detail view](?path=/story/rls-items-detail-body--event),
 * the host behind it [The module host](?path=/docs/rls-app-03-module-host--docs).
 */
function FeedModuleOverview() {
  return <HostWorld module="feed" />
}

const meta: Meta<typeof FeedModuleOverview> = {
  id: "rls-modules-feed",
  title: "RLS/Modules/Feed/Overview",
  component: FeedModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof FeedModuleOverview>

export const Default: Story = { name: "Feed inside the host" }
