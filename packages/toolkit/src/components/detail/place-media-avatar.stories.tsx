import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"

import { ItemDetailRead } from "../host/detail-host"
import { ItemDetailBody } from "./item-detail-body"
import { useItem } from "../../hooks/use-items"
import { MemoryFocusProvider, useItemFocus } from "../../hooks/use-item-focus"
import { StoryWorld } from "../../story-support/story-world"
import { FieldNavigationProvider } from "../navigation/field-navigation"
import { ContentComposer } from "../composer/content-composer"
import { contentTypeFromRegister } from "../composer/content-types"
import { AvatarField } from "../composer/widgets/avatar-widget"
import { asString, scalarField } from "../composer/form-fields"
import { useFormState } from "../../lib/form-state"
import { RegisterHeadAvatar } from "../preview/register-content"
import type { Geocoder } from "../../lib/geocode"

/**
 * **Place, media and avatar** (S4b; spec shared-components → „Item-Detail
 * aus dem Register", widget pairs B4, B5, B11).
 *
 * - **B4 location:** ONE field. Autocomplete mixes place items (top, as
 *   chip) and geocoder addresses (below); the map pick takes a marker as a
 *   place item and a free point as coordinates. Reading: a place item is a
 *   chip in its type colour (opens the place), an address is text with a
 *   „Karte" jump. The event stores the place item as the embedded edge
 *   `locatedAt`; the place lists „Findet hier statt" (upcoming events,
 *   sorted by start).
 * - **B5 media:** image row in the content, lightbox with arrow keys and
 *   Escape. Files other than images are links.
 * - **B11 avatar:** head avatar; the form picks an image and shrinks it to
 *   512 px.
 */
const meta: Meta = {
  id: "rls-items-detail-place-media",
  title: "RLS/Items/Detail view/Place, media and avatar",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
}
export default meta

type Story = StoryObj

const DAY = 86_400_000
const inDays = (n: number) => {
  const d = new Date(Date.now() + n * DAY)
  d.setHours(18, 0, 0, 0)
  return d.toISOString()
}
const POINT = { type: "Point", coordinates: [13.4049, 52.52] }

const MARKTHALLE: Item = {
  id: "ort-markthalle",
  type: "place",
  createdAt: inDays(-30),
  createdBy: "mira",
  data: { title: "Markthalle Neun", description: "Die alte Halle am Kanal.", address: "Eisenbahnstraße 42, 10997 Berlin", position: POINT },
}
const GARTEN: Item = {
  id: "ort-garten",
  type: "place",
  createdAt: inDays(-30),
  createdBy: "jonas",
  data: { title: "Gemeinschaftsgarten", address: "Gartenweg 3, 10999 Berlin", position: POINT },
}
const at = (id: string, title: string, days: number, place = MARKTHALLE.id): Item => ({
  id,
  type: "event",
  createdAt: inDays(-10),
  createdBy: "mira",
  data: { title, start: inDays(days) },
  relations: [{ predicate: "locatedAt", target: `item:${place}` }],
})
const REPAIR = at("ev-repair", "Repair-Café", 5)
const MARKT = at("ev-markt", "Wochenmarkt", 2)
const PAST = at("ev-vorbei", "Kochabend (vorbei)", -3)
const ADDRESS_EVENT: Item = {
  id: "ev-adresse",
  type: "event",
  createdAt: inDays(-5),
  createdBy: "lea",
  data: { title: "Treffen im Hof", start: inDays(3), address: "Hinterhof, Wrangelstraße 12, 10997 Berlin", position: POINT },
}

/** Ein Bild als SVG-Datenadresse — keine Netzabfrage in der Story. */
const picture = (label: string, from: string, to: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><text x="40" y="560" font-family="sans-serif" font-size="48" fill="white">${label}</text></svg>`,
  )}`
const POST: Item = {
  id: "post-fest",
  type: "post",
  createdAt: inDays(-1),
  createdBy: "jonas",
  data: {
    content: "Fotos vom Hoffest — danke an alle, die mitgebaut haben!",
    media: [
      { id: "m1", name: "Aufbau.jpg", type: "image/svg+xml", url: picture("Aufbau", "#2f855a", "#9ae6b4") },
      { id: "m2", name: "Bühne.jpg", type: "image/svg+xml", url: picture("Bühne", "#2b6cb0", "#90cdf4") },
      { id: "m3", name: "Abend.jpg", type: "image/svg+xml", url: picture("Abend", "#9c4221", "#fbd38d") },
      { id: "m4", name: "Ablaufplan.pdf", type: "application/pdf", url: "https://example.org/ablaufplan.pdf" },
    ],
  },
}

const SEED = [MARKTHALLE, GARTEN, REPAIR, MARKT, PAST, ADDRESS_EVENT, POST]

function Frame({ start }: { start: string }) {
  return (
    <StoryWorld seed={{ items: SEED }}>
      {/* Der Sprung „Karte" braucht ein Ziel; in der Story führt er nirgendwohin. */}
      <FieldNavigationProvider value={{ openField: () => () => undefined }}>
        <MemoryFocusProvider module="calendar" scope="garden">
          <div className="w-[380px] overflow-hidden rounded-2xl border bg-background shadow-xl">
            <Focused start={start} />
          </div>
        </MemoryFocusProvider>
      </FieldNavigationProvider>
    </StoryWorld>
  )
}

/** Wie der Detail-Host: das fokussierte Item lebendig — ein Klick auf den Ort-Chip öffnet den Ort. */
function Focused({ start }: { start: string }) {
  const { itemId } = useItemFocus()
  const { data: item } = useItem(itemId ?? start)
  return item ? <ItemDetailRead item={item} actions={null} groupId="garden" /> : null
}

/** Event at a place item: the place is a chip in its type colour; a click opens the place. */
export const EventAtPlace: Story = {
  render: () => <Frame start={REPAIR.id} />,
}

/** Event at an address: text with the „Karte" jump (only with coordinates). */
export const EventAtAddress: Story = {
  render: () => <Frame start={ADDRESS_EVENT.id} />,
}

/** Place with „Findet hier statt": upcoming events, sorted by start; the past one is not listed. */
export const PlaceWithEvents: Story = {
  render: () => <Frame start={MARKTHALLE.id} />,
}

/** Post with an image row; click an image, then use ← → and Escape. The PDF is a link. */
export const PostWithImages: Story = {
  render: () => <Frame start={POST.id} />,
}

const AVATAR = picture("L", "#6b46c1", "#d6bcfa")

/** Head avatar (B11) next to the title — here from a field `avatarUrl` @head. */
export const HeadAvatar: Story = {
  render: () => {
    const item: Item = { id: "profil-lena", type: "card", createdAt: inDays(-1), createdBy: "lena", data: { title: "Lena Berger", avatarUrl: AVATAR } }
    return (
      <StoryWorld>
        <div className="w-[380px] overflow-hidden rounded-2xl border bg-background shadow-xl">
          <ItemDetailBody item={item} headMedia={<RegisterHeadAvatar item={item} fields={[{ key: "avatarUrl", widget: "avatar", pos: "head" }]} />} />
        </div>
      </StoryWorld>
    )
  },
}

/** Avatar field in the form: pick an image, it is shrunk to 512 px; „Entfernen" clears it. */
export const AvatarForm: Story = {
  render: function AvatarFormStory() {
    // Wie im Composer: Der Formularzustand besitzt den Wert, das Feld bekommt seinen Zugang.
    const form = useFormState(() => ({ data: { avatarUrl: AVATAR }, type: "card", spaceOf: () => undefined }))
    return (
      <div className="w-[380px] rounded-2xl border bg-background p-4 shadow-xl">
        <AvatarField label="Bild" field={form.field("avatarUrl", scalarField("avatarUrl", "Bild", asString))} />
      </div>
    )
  },
}

/** A small fake geocoder, so the story needs no network. */
const fakeGeocode: Geocoder = async (query) =>
  [
    { label: "Marktstraße 1, 10317 Berlin", lat: 52.5, lng: 13.48 },
    { label: "Am Markt 3, 10178 Berlin", lat: 52.52, lng: 13.41 },
  ].filter((r) => r.label.toLowerCase().includes(query.trim().toLowerCase().slice(0, 3)))

/** Event form: type „Mark" — place items on top, addresses below. Choosing a place shows it as a chip. */
export const EventForm: Story = {
  render: () => (
    <StoryWorld seed={{ items: SEED }}>
      <MemoryFocusProvider module="calendar" scope="garden">
        <div className="w-[420px] rounded-2xl border bg-background p-4 shadow-xl">
          <ContentComposer
            contentTypes={[{ ...contentTypeFromRegister("event"), groupOptions: [{ id: "garden", name: "Garten" }], defaultGroup: "garden" }]}
            initialData={{ title: "Tauschbörse", group: "garden" }}
            showPreview={false}
            geocode={fakeGeocode}
            onSubmit={() => undefined}
          />
        </div>
      </MemoryFocusProvider>
    </StoryWorld>
  ),
}
