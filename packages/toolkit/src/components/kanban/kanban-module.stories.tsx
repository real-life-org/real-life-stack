import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../../story-support/host-world"

/**
 * **The kanban** shows the tasks of a space in columns by status and lets you
 * drag them. It is a toolkit module and runs inside the module host (spec 01):
 * the host loads what carries a status (`presents: ["status"]` — the field
 * decides, never the type), applies search and filter, and provides detail,
 * create ("Aufgabe" suggested) and the plus button.
 *
 * What is the kanban's own: the columns, moving (a drag writes `status` and
 * `order` through the connector), and the filters that only mean something
 * here — assignment and "only mine" — which the module hands into the filter
 * card and the chip row. In the overview ("Mein Netzwerk") it can group by
 * space.
 *
 * Without a write capability the board is read-only: cards can be opened, not
 * moved. Without members the assignment filter is missing.
 *
 * Where next: the board alone, with custom columns and drag handling, under
 * [Board](?path=/docs/rls-space-modules-kanban-board--docs).
 */
function KanbanModuleOverview() {
  return <HostWorld module="kanban" />
}

const meta: Meta<typeof KanbanModuleOverview> = {
  id: "rls-space-modules-kanban-overview",
  title: "RLS/Modules/Kanban/Overview",
  component: KanbanModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof KanbanModuleOverview>

export const Default: Story = { name: "Kanban inside the host" }
