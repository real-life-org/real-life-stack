import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"

import { HostWorld } from "../story-support/host-world"
import { STORY_SEED } from "../story-support/story-world"

/**
 * Die Resonanz ist ein Toolkit-Modul und laeuft im Modul-Host (Spec 01):
 * Aussagen, zu denen sich die Gruppe stellt — die Stimmleiste ist eine Regel
 * des Typs `statement` und erscheint, wo immer eine Aussage gezeigt wird.
 * Sortierung im Kopf neben der Suche; Detail, Erstellen (Vorschlag
 * „Aussage") und Plusknopf stellt der Host.
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
  id: "rls-space-modules-resonance-overview",
  title: "RLS/Modules/Resonance/Overview",
  component: ResonanceModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof ResonanceModuleOverview>

export const Default: Story = {}
