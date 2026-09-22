import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"
import { HostWorld } from "../../story-support/host-world"
import { STORY_SEED } from "../../story-support/story-world"

const events: Item[] = [
  {
    id: "event-1",
    type: "event",
    createdAt: "2026-09-01T09:00:00.000Z",
    createdBy: "mira",
    data: {
      title: "Yoga im Park",
      start: "2026-09-23T09:00:00.000+02:00",
      end: "2026-09-23T10:30:00.000+02:00",
      location: "Stadtpark Mitte",
      description: "Gemeinsam in den Tag starten. Matten bitte selbst mitbringen.",
    },
    tags: ["bewegung", "community"],
  },
  {
    id: "event-2",
    type: "event",
    createdAt: "2026-09-02T09:00:00.000Z",
    createdBy: "jonas",
    data: {
      title: "Buchclub Treffen",
      start: "2026-09-23T20:00:00.000+02:00",
      end: "2026-09-23T22:00:00.000+02:00",
      location: "Kiezbibliothek"
    }, tags: ["kultur"],
  },
  {
    id: "event-3",
    type: "event",
    createdAt: "2026-09-03T09:00:00.000Z",
    createdBy: "lea",
    data: {
      title: "Lauftreff am Morgen",
      start: "2026-09-24T07:00:00.000+02:00",
      end: "2026-09-24T08:00:00.000+02:00",
      location: "Parkrunde"
    }, tags: ["bewegung"],
  },
  {
    id: "event-4",
    type: "event",
    createdAt: "2026-09-04T09:00:00.000Z",
    createdBy: "mira",
    data: {
      title: "Community Meeting",
      start: "2026-09-25T19:00:00.000+02:00",
      end: "2026-09-25T21:00:00.000+02:00",
      location: "Gemeinschaftsraum"
    }, tags: ["planung", "space"],
  },
  {
    id: "event-5",
    type: "event",
    createdAt: "2026-09-05T09:00:00.000Z",
    createdBy: "jonas",
    data: {
      title: "Open-Air Kino",
      start: "2026-09-26T21:00:00.000+02:00",
      end: "2026-09-26T23:30:00.000+02:00",
      location: "Hinterhof"
    }, tags: ["projekt", "kultur"],
  },
  {
    id: "event-6",
    type: "event",
    createdAt: "2026-09-06T09:00:00.000Z",
    createdBy: "lea",
    data: {
      title: "Spielnachmittag für Kinder",
      start: "2026-09-27T14:00:00.000+02:00",
      end: "2026-09-27T16:30:00.000+02:00",
      location: "Familienzentrum"
    }, tags: ["kinder"],
  },
  {
    id: "event-7",
    type: "event",
    createdAt: "2026-09-07T09:00:00.000Z",
    createdBy: "mira",
    data: {
      title: "Internationales Sprachcafé",
      start: "2026-09-27T18:00:00.000+02:00",
      end: "2026-09-27T20:00:00.000+02:00",
      location: "Café Kollektiv"
    }, tags: ["sprache", "begegnung"],
  },
  {
    id: "event-8",
    type: "event",
    createdAt: "2026-09-08T09:00:00.000Z",
    createdBy: "mira",
    data: {
      title: "Nachbarschaftsfest",
      start: "2026-09-28T14:00:00.000+02:00",
      end: "2026-09-28T22:00:00.000+02:00",
      location: "Müllerstraße"
    }, tags: ["fest"],
  },
  {
    id: "event-9",
    type: "event",
    createdAt: "2026-09-09T09:00:00.000Z",
    createdBy: "jonas",
    data: {
      title: "Nachbarschaftsflohmarkt",
      start: "2026-09-29T10:00:00.000+02:00",
      end: "2026-09-29T14:00:00.000+02:00",
      location: "Marktplatz"
    }, tags: ["markt"],
  },
  {
    id: "event-10",
    type: "task",
    createdAt: "2026-09-10T09:00:00.000Z",
    createdBy: "mira",
    data: {
      title: "Fahrradtour ans Wasser",
      start: "2026-09-29T09:00:00.000+02:00",
      end: "2026-09-29T15:00:00.000+02:00",
      location: "Treffpunkt Bahnhof"
    }, tags: ["ausflug"],
  },
  {
    id: "event-11",
    type: "event",
    createdAt: "2026-09-11T09:00:00.000Z",
    createdBy: "jonas",
    data: {
      title: "Coding Workshop für Anfänger",
      start: "2026-09-31T18:30:00.000+02:00",
      end: "2026-09-31T21:00:00.000+02:00",
      location: "CoWorking Space"
    }, tags: ["lernen", "technik"],
  },
]

/**
 * **The calendar** shows the events of a space by month, week, day or as a
 * list. It is a toolkit module and runs inside the module host (spec 01): the
 * host loads what carries a start (`presents: ["start"]` — a task with a date
 * appears too), applies search and filter, and provides detail, create
 * ("Termin" suggested) and the plus button.
 *
 * What is the calendar's own: the views and the time range, "today", and the
 * suggestion on an empty day — a click opens create with the date prefilled,
 * a click on a time slot with the time. An app can set where the calendar
 * opens (`options.initialVisibleDate`); without that, today.
 *
 * Without a write capability the empty day does nothing and the plus button is
 * gone; the calendar still reads.
 *
 * Where next: the event card and its date row under
 * [Adornments](?path=/docs/rls-items-beigaben--docs); the
 * loading rule under [The loading contract](?path=/docs/rls-app-ladevertrag--docs).
 */
function CalendarModuleOverview() {
  return <HostWorld module="calendar" seed={{ items: [...STORY_SEED.items, ...events] }} />
}

const meta: Meta<typeof CalendarModuleOverview> = {
  id: "rls-space-modules-calendar-overview",
  title: "RLS/Modules/Calendar/Overview",
  component: CalendarModuleOverview,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof CalendarModuleOverview>

export const Default: Story = { name: "Calendar inside the host" }
