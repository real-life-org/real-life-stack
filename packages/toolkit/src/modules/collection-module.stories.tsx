import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../story-support/host-world"

/**
 * **The list** shows everything in a space that stands as a card of its own,
 * as a list or a grid; the density toggle sits in the header next to the
 * search. It is a toolkit module and runs inside the module host (spec 01)
 * without a line of wiring here: the host loads (no `presents` — the list
 * aggregates), filters, and provides detail, create and the plus button.
 *
 * The list is the plain view: no field, no order of its own beyond the
 * connector's. It is the fallback when no field picks a module — a notification
 * about a post lands here.
 *
 * Without a write capability there is no plus button; the list still reads.
 *
 * Where next: the view underneath, with a thousand items and both densities,
 * under [Collection view](?path=/docs/rls-module-components-lenses-collectionview--docs).
 */
function CollectionModuleOverview() {
  return <HostWorld module="collection" />
}

const meta: Meta<typeof CollectionModuleOverview> = {
  id: "rls-space-modules-collection-overview",
  title: "RLS/Modules/List/Overview",
  component: CollectionModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof CollectionModuleOverview>

export const Default: Story = { name: "List inside the host" }
