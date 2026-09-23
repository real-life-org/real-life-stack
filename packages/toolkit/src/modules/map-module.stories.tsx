import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"

import { HostWorld } from "../story-support/host-world"
import { STORY_SEED } from "../story-support/story-world"
import "maplibre-gl/dist/maplibre-gl.css"

/**
 * **The map** shows the items of a space that have a position, clustered,
 * with the shared search floating over it. It is a toolkit module and runs
 * inside the module host (spec 01) — with one difference: it **loads itself**
 * (`loads: "module"`), by viewport, so a large space never loads its whole
 * stock. The host issues no query but still provides detail (without backdrop,
 * `panelFit: "overlay"`, so the map stays movable), create ("Ort" suggested)
 * and the plus button. Picking a location for a new place happens on this
 * map: the panel steps aside while you pick.
 *
 * The map engine is not part of the toolkit core: an app provides it with
 * one line, `MapLibreAdapterProvider` from `@real-life-stack/toolkit/maplibre`
 * (or the Leaflet variant). This story does the same; the
 * [module host](?path=/docs/rls-app-03-module-host--docs) page shows what happens
 * without it.
 *
 * Without a write capability there is no plus button and no location pick.
 *
 * Where next: the map surface alone, with both viewport modes, under
 * [MapView](?path=/docs/rls-modules-map-view--docs); the loading rule
 * under [The loading contract](?path=/docs/rls-app-04-loading-contract--docs).
 */
const places: Item[] = [
  { id: "place-schuppen", type: "place", createdAt: "2026-09-03T10:00:00+02:00", createdBy: "jonas", data: { title: "Geräteschuppen", description: "Schlüssel hängt am Brett.", position: { type: "Point", coordinates: [13.4085, 52.5215] } } },
  { id: "place-kompost", type: "place", createdAt: "2026-09-05T10:00:00+02:00", createdBy: "lea", data: { title: "Kompost", position: { type: "Point", coordinates: [13.4035, 52.5185] } } },
]

function MapModuleOverview() {
  return (
    <HostWorld module="map" seed={{ items: [...STORY_SEED.items, ...places] }} />
  )
}

const meta: Meta<typeof MapModuleOverview> = {
  id: "rls-modules-map",
  title: "RLS/Modules/Map/Overview",
  component: MapModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof MapModuleOverview>

export const Default: Story = { name: "Map inside the host" }
