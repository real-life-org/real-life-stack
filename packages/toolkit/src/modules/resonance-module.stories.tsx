import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"

import { HostWorld } from "../story-support/host-world"
import { STORY_SEED } from "../story-support/story-world"

/**
 * **Resonance** collects statements a group positions itself on: each card
 * carries a vote bar, and the module sorts by resonance. It is a toolkit
 * module and runs inside the module host (spec 01): the host loads the class
 * `statement` (a hint by affordance, not by field — spec 06), applies search
 * and filter, and provides detail, create ("Aussage" suggested) and the plus
 * button.
 *
 * The vote bar is a rule of the **type**, not of the module: it appears
 * wherever a statement is shown — in the feed, in the list, in the detail.
 *
 * Without relation records there are no votes; the statements still show.
 * Without a write capability the bar is read-only.
 *
 * Where next: how a class activates a module under
 * [The loading contract](?path=/docs/rls-app-04-loading-contract--docs); the vote
 * bar as a type rule under [Adornments](?path=/docs/rls-items-adornments--docs).
 */
const aussagen: Item[] = [
  {
    id: "aussage-mulch", type: "statement", createdAt: "2026-09-04T09:00:00+02:00", createdBy: "lea",
    tags: ["garten"],
    data: { title: "Wir mulchen alle Beete bis Ende September.", description: "Spart Wasser und Unkraut jäten." },
  },
  {
    id: "aussage-kompost", type: "statement", createdAt: "2026-09-05T09:00:00+02:00", createdBy: "jonas",
    data: { title: "Der Kompost bekommt einen zweiten Behälter." },
  },
]

function ResonanceModuleOverview() {
  return <HostWorld module="resonance" seed={{ items: [...STORY_SEED.items, ...aussagen] }} />
}

const meta: Meta<typeof ResonanceModuleOverview> = {
  id: "rls-modules-resonance",
  title: "RLS/Modules/Resonance/Overview",
  component: ResonanceModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof ResonanceModuleOverview>

export const Default: Story = { name: "Resonance inside the host" }
