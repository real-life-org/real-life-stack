import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../story-support/host-world"

/**
 * Der Graph ist ein Toolkit-Modul und laeuft im Modul-Host (Spec 01): die
 * Items des Space und ihre Beziehungen, die Menschen, auf die Kanten zeigen,
 * Suche und Filter schwebend ueber der Flaeche. Ein Klick auf ein Item
 * oeffnet das geteilte Detail; ein Klick auf eine Person das Profil.
 *
 * Die Ansicht darunter — der Canvas mit Kraftlayout, dichten Bestaenden und
 * leerem Zustand — hat ihre eigenen Stories unter „Ansicht".
 */
function GraphModuleOverview() {
  return <HostWorld module="graph" />
}

const meta: Meta<typeof GraphModuleOverview> = {
  id: "rls-space-modules-graph-module",
  title: "RLS/Module/Graph/Übersicht",
  component: GraphModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof GraphModuleOverview>

export const Default: Story = {}
