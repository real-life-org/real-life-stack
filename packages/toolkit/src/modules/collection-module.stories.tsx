import type { Meta, StoryObj } from "@storybook/react-vite"

import { HostWorld } from "../story-support/host-world"

/**
 * Die Liste ist ein Toolkit-Modul und laeuft im Modul-Host (Spec 01) — ohne
 * eine Zeile Verdrahtung in dieser Story. Sie zeigt alles, was als eigene
 * Karte steht (`isAggregateVisibleItemType`), in der Reihenfolge der Ansicht;
 * die Dichte (Liste oder Raster) schaltet der Knopf im Kopf neben der Suche.
 * Detail, Erstellen und Plusknopf stellt der Host.
 *
 * Die Bausteine darunter — `CollectionView`, `ListView`, `GridView` — haben
 * ihre eigenen Stories unter „Gemeinsame Ansichten".
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

export const Default: Story = {}
