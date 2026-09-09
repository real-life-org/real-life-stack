import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item, User } from "@real-life-stack/data-interface"
import { Calendar, MapPin, Users } from "lucide-react"

import { ItemDetailBody } from "./item-detail-body"
import { ItemDetailSkeleton } from "./item-detail-skeleton"
import { Button } from "../primitives/button"

const AUTOR: User = { id: "u1", displayName: "Sebastian" } as User

const EVENT: Item = {
  id: "e1",
  type: "event",
  createdAt: "2026-06-05T10:00:00.000Z",
  createdBy: "u1",
  tags: ["repair", "community"],
  data: {
    title: "Repair-Café im Stadtteilzentrum",
    content: "Bringt eure kaputten Geräte! Werkzeug und Expertise vor Ort.",
  },
  relations: [],
} as Item

const META = (
  <div className="flex flex-col gap-1.5">
    <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />4. Juli, 16:00 – 20:00</span>
    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Stadtteilzentrum Friedrichshain</span>
    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />3 zugesagt · 2 eingeladen</span>
  </div>
)

/**
 * Die Leseansicht im Detail-Panel. Ohne Panel darüber — hier in Storybook —
 * bleiben die Aktionen in der Kopfzeile, statt in dessen Knopfleiste zu wandern.
 */
const meta: Meta<typeof ItemDetailBody> = {
  title: "Detail/ItemDetailBody",
  component: ItemDetailBody,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      // Der Rahmen gehört dem Panel, nicht der Ansicht: hier nachgestellt,
      // damit sichtbar wird, dass die Ansicht selbst keinen mitbringt.
      <div className="w-[360px] overflow-hidden rounded-2xl border bg-background shadow-xl">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ItemDetailBody>

export const Event: Story = {
  args: {
    item: EVENT,
    author: AUTOR,
    headerAdornment: <span className="rounded-full border border-primary/30 px-2 py-0.5 text-xs text-primary">Event</span>,
    actions: <Button variant="ghost" size="sm" className="h-7 w-7 p-0">⋮</Button>,
    meta: META,
    footer: <span className="text-sm text-muted-foreground">👍 3 · 🎉 1</span>,
  },
}

/** Ein Beitrag ohne Titel, ohne Fakten, ohne Tags — nur Text und Urheber. */
export const NurText: Story = {
  args: {
    item: { ...EVENT, type: "post", tags: undefined, data: { content: "Kurz notiert: der Schlüssel liegt wieder im Café." } } as Item,
    author: AUTOR,
  },
}

/** Viele Tags: Sie kappen, der Urheber bleibt in seiner Zeile. */
export const VieleTags: Story = {
  args: {
    ...Event.args,
    item: { ...EVENT, tags: ["repair", "community", "nachbarschaft", "werkstatt", "offen"] } as Item,
  },
}

export const Laedt: Story = {
  render: () => <ItemDetailSkeleton />,
}
