import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../story-support/host-world"

/**
 * **The graph** shows the items of a space and their relations as a force
 * layout: embedded relations (a task assigned to a person) and relation
 * records (a vote on a statement) become edges; people appear as nodes only
 * when an edge reaches them. It is a toolkit module and runs inside the module
 * host (spec 01): the host loads everything that stands as a card, applies
 * search and filter — here floating over the canvas (`panelFit: "overlay"`) —
 * and provides detail, create and the plus button.
 *
 * A click on an item node opens the shared detail; a click on a person node
 * opens the profile. The camera follows a settling layout and stops the moment
 * you touch the canvas.
 *
 * Without relation records only embedded relations draw edges. Without members
 * person nodes cannot be resolved and stay out.
 *
 * Where next: the canvas alone, with a dense set and the empty state, under
 * [View](?path=/docs/rls-space-modules-graph-overview--docs); how nodes get
 * their type and colour in `project-space-graph.ts`.
 */
function GraphModuleOverview() {
  return <HostWorld module="graph" />
}

const meta: Meta<typeof GraphModuleOverview> = {
  id: "rls-space-modules-graph-module",
  title: "RLS/Modules/Graph/Overview",
  component: GraphModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof GraphModuleOverview>

export const Default: Story = { name: "Graph inside the host" }
