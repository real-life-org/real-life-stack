import type { Meta, StoryObj } from "@storybook/react-vite"
import { MapLibreMapAdapter } from "./adapters/maplibre"
import { MapView } from "./map-view"

const items = [
  { id: "story-place", type: "place", createdAt: "2026-07-17T00:00:00.000Z", createdBy: "story", data: { title: "Treffpunkt", position: { type: "Point", coordinates: [13.4, 52.5] } } },
  { id: "story-event", type: "event", createdAt: "2026-07-17T00:00:00.000Z", createdBy: "story", data: { title: "Workshop", position: { type: "Point", coordinates: [13.42, 52.51] } } },
]
/**
 * **MapView** is the map surface underneath the map module: markers and
 * clusters for items with a position, the focused item centred, and two
 * viewport modes — `bbox-module` reports the visible bounds so the module can
 * load by viewport, `lens-auto-fit` fits whatever it is given (for read-only
 * embeddings). The engine comes in via `createAdapter` (MapLibre here, Leaflet
 * possible); the map itself never imports one.
 *
 * Where next: the module around it under [Overview](?path=/docs/rls-space-modules-map-overview--docs).
 */
const meta: Meta<typeof MapView> = { id: "rls-space-modules-mapview", tags: ["autodocs"],
  title: "RLS/Modules/Map/MapView", component: MapView, decorators: [(Story) => <div style={{ height: 560 }}><Story /></div>] }
export default meta
type Story = StoryObj<typeof MapView>
const base = { items, itemsLoading: false, inventoryKey: "story", createAdapter: () => new MapLibreMapAdapter(), initialView: { center: [13.4, 52.5] as [number, number], zoom: 10 }, activeItemId: "story-place", clustering: {} }
export const BboxModule: Story = { name: "bbox-module: loads by viewport", args: { ...base, viewportMode: "bbox-module" } }
export const LensAutoFit: Story = { name: "lens-auto-fit: fits what it is given", args: { ...base, viewportMode: "lens-auto-fit" } }
