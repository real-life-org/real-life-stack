import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"

import { CollectionView } from "./collection-view"

const items: Item[] = [
  { id: "person-ada", type: "person", createdAt: "2026-07-08T10:00:00.000Z", createdBy: "seed", data: { displayName: "Ada Lovelace" } },
  { id: "project-rls", type: "project", createdAt: "2026-07-08T10:01:00.000Z", createdBy: "seed", data: { title: "Real Life Stack" } },
  { id: "resource-loetstation", type: "resource", createdAt: "2026-07-08T10:02:00.000Z", createdBy: "seed", data: { title: "Lötstation", kind: "tool" } },
]

/**
 * **CollectionView** is the view underneath the list module: one collection
 * with a session-local density toggle — a compact list or a masonry grid — and
 * a virtualised scroller that stays smooth at a thousand items. Both densities
 * render `ItemPreview` cards with the shared type adornments; nothing in here
 * knows a type by name.
 *
 * Items arrive already filtered from the surface (`useSurfaceItems`); the view
 * applies no filter of its own. Standalone, as here, it shows what it is given.
 *
 * Where next: the module around it under [Overview](?path=/docs/rls-modules-list--docs);
 * the card under [ItemPreview](?path=/story/rls-items-item-preview--bare).
 */
const meta: Meta<typeof CollectionView> = {
  id: "rls-modules-collection-view",
  title: "RLS/Modules/Shared views/Collection view",
  component: CollectionView,
  tags: ["autodocs"],
  // Die Modulflaeche ist eine Spalte mit fester Hoehe; ohne sie faellt der
  // Rahmen zusammen und die schwebende Filter-Pille landet auf der ersten Karte.
  decorators: [(Story) => <div className="h-[36rem]"><Story /></div>],
  parameters: {
    docs: {
      description: {
        component: "One collection lens with a session-local density toggle; it composes the existing ListView and GridView ItemPreview projections.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof CollectionView>

export const List: Story = { name: "Compact list", args: { items, defaultLayout: "list" } }
export const Grid: Story = { name: "Masonry grid", args: { items, defaultLayout: "grid" } }

const thousandItems: Item[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `virtual-item-${index}`,
  type: index % 3 === 0 ? "resource" : "task",
  createdAt: `2026-07-08T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
  createdBy: "seed",
  data: {
    title: `Virtueller Eintrag ${index + 1}`,
    content: index % 4 === 0 ? "Kurzer Beschreibungstext." : index % 4 === 1 ? "Eine etwas längere Beschreibung fuer sichtbar unterschiedliche Kartenhoehen im Raster, damit die festen Lanes direkt pruefbar bleiben." : undefined,
    ...(index % 3 === 0 ? { kind: "tool" } : { status: "open" }),
  },
}))

/** Deterministic large fixture with uneven cards for the order-stable masonry grid. */
export const ThousandItems: Story = { name: "A thousand items", args: { items: thousandItems } }
