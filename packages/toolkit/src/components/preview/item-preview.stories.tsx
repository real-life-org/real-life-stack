import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item, User } from "@real-life-stack/data-interface"
import { ItemPreview } from "./item-preview"
import { ItemTypeBadge } from "./item-type-badge"
import { ItemMetaRow } from "./item-meta-row"
import { ItemCommentCount } from "./item-comment-count"
import { ItemAssignees } from "./item-assignees"

const now = new Date()

const lena: User = {
  id: "user-lena",
  displayName: "Lena Berg",
  avatarUrl: "https://randomuser.me/api/portraits/women/68.jpg",
}

const anton: User = {
  id: "user-anton",
  displayName: "Anton T.",
  avatarUrl: "https://randomuser.me/api/portraits/men/22.jpg",
}

function isoMinutesAgo(min: number): string {
  return new Date(now.getTime() - min * 60_000).toISOString()
}

const postItem: Item = {
  id: "post-1",
  type: "post",
  createdAt: isoMinutesAgo(25),
  createdBy: lena.id,
  data: {
    content:
      "Heute morgen war ich mit Anton im Markthallen-Garten. Wir haben die ersten Tomatenpflanzen gesetzt, der Boden hat nach dem Regen super getragen.",
  },
  tags: ["garten", "permakultur"],
}

const eventItem: Item = {
  id: "event-workshop",
  type: "event",
  createdAt: isoMinutesAgo(120),
  createdBy: anton.id,
  data: {
    title: "Permakultur-Workshop in der Markthalle",
    description: "Wir bauen Hochbeete für die kommende Saison zusammen.",
    start: "2026-07-15T18:00:00Z",
    address: "Marheinekeplatz 15, 10961 Berlin",
  },
  tags: ["workshop", "permakultur"],
}

const taskItem: Item = {
  id: "task-beete",
  type: "task",
  createdAt: isoMinutesAgo(60 * 24 * 3),
  createdBy: lena.id,
  data: {
    title: "Beete vorbereiten",
    description: "Erde umgraben und Kompost einarbeiten — bis zum Wochenende.",
    status: "in-progress",
    order: 1,
  },
  tags: ["garten"],
}

/**
 * **ItemPreview** is the one card of the stack: feed, list, grid, kanban and
 * the map's popups all render it. It knows nothing about types, spaces or
 * conversations — it has a title, a text, tags and an author row, and three
 * slots (header, meta, footer) that the surface fills through the type
 * register. That is why the same card looks different per module without
 * there being three cards.
 *
 * Density is `comfortable`, `compact` (kanban, lists), `row` (one line in
 * reverse lists) or `dense` (the tile of a matrix with twelve or more
 * columns); `author={null}` suppresses the author row for cards that stand
 * where the author is obvious.
 *
 * Where next: what goes into the slots under [Adornments](?path=/docs/rls-items-adornments--docs);
 * the card opened under [Detail view](?path=/docs/rls-items-detail-body--docs).
 */
const meta: Meta<typeof ItemPreview> = {
  tags: ["autodocs"],
  id: "rls-items-item-preview",
  title: "RLS/Items/Item preview/ItemPreview",
  component: ItemPreview,
  decorators: [
    // Die Karten-Stories zeigen eine Feed-Spalte; die Dichte-Stories brauchen
    // die ganze Breite, sonst faellt das Raster in Zeilen auseinander.
    (Story, ctx) => (
      <div className={ctx.parameters.wide ? "p-6 bg-background" : "max-w-2xl mx-auto p-6 bg-background"}>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ItemPreview>

export const Bare: Story = {
  name: "Bare — text post, no adornments",
  args: {
    item: postItem,
    author: lena,
    onClick: () => console.log("click"),
  },
}

export const WithHeaderBadge: Story = {
  name: "With header badge — event card",
  args: {
    item: eventItem,
    author: anton,
    headerAdornment: <ItemTypeBadge type="event" />,
    metaAdornment: <ItemMetaRow item={eventItem} />,
    onClick: () => console.log("click"),
  },
}

export const TaskCard: Story = {
  name: "Task — with status badge and comment count",
  args: {
    item: taskItem,
    author: lena,
    headerAdornment: <ItemTypeBadge type="task" />,
    footerAdornment: (
      <>
        <span className="text-xs rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">in Arbeit</span>
        <div className="ml-auto">
          <ItemCommentCount count={3} />
        </div>
      </>
    ),
    onClick: () => console.log("click"),
  },
}

export const AnonymousAuthor: Story = {
  name: "Falls back to createdBy when author is missing",
  args: {
    item: postItem,
    author: undefined,
    onClick: () => console.log("click"),
  },
}

export const NoAuthorRow: Story = {
  name: "author={null} suppresses the entire author block",
  args: {
    item: { ...postItem, data: { ...postItem.data } },
    author: null,
  },
}

export const KanbanCardShape: Story = {
  name: "Kanban shape — compact density, no author, assignees footer",
  args: {
    item: taskItem,
    author: null,
    density: "compact",
    footerAdornment: (
      <>
        <ItemAssignees users={[lena, anton]} />
        <div className="ml-auto">
          <ItemCommentCount count={2} />
        </div>
      </>
    ),
    onClick: () => console.log("click"),
  },
}

/** Rückwärts-Listen im Detail (Detail-Anatomie Regel 8): eine Zeile aus ItemPreview. */
export const RowDensity: Story = {
  name: "Row density — one line for reverse lists",
  render: () => (
    <div className="flex max-w-md flex-col gap-1.5">
      <ItemPreview item={taskItem} density="row" author={null} headerAdornment={<ItemTypeBadge type="task" />} onClick={() => console.log("click")} />
      <ItemPreview item={taskItem} density="row" author={null} active headerAdornment={<ItemTypeBadge type="task" />} footerAdornment={<span className="text-xs text-muted-foreground">diese</span>} />
      <ItemPreview item={{ ...taskItem, id: "done", data: { ...taskItem.data, title: "Kompost umsetzen" } }} density="row" author={null} completed headerAdornment={<ItemTypeBadge type="task" />} />
    </div>
  ),
}

export const CompactWithDescription: Story = {
  name: "Compact density drops the description block",
  args: {
    item: {
      ...taskItem,
      data: {
        ...taskItem.data,
        description: "Diese lange Beschreibung sollte in der Kanban-Variante nicht erscheinen.",
      },
    },
    author: null,
    density: "compact",
  },
}

export const HeaderAdornmentWithoutAuthor: Story = {
  name: "Slots are orthogonal — header renders even without author row",
  args: {
    item: { ...postItem, data: { title: "Workshop morgen", content: "Treffpunkt: Eingang Markthalle" } },
    author: null,
    headerAdornment: <ItemTypeBadge type="event" />,
    metaAdornment: <ItemMetaRow item={eventItem} />,
  },
}

export const NoTitleNoDescription: Story = {
  name: "Edge — only tags",
  args: {
    item: {
      id: "post-2",
      type: "post",
      createdAt: isoMinutesAgo(5),
      createdBy: lena.id,
      data: {},
      tags: ["garten", "test"],
    },
    author: lena,
  },
}

export const LongDescriptionClamped: Story = {
  name: "Long description is clamped to 4 lines",
  args: {
    item: {
      ...postItem,
      data: {
        content: Array.from({ length: 10 }, () =>
          "Wir haben heute den Garten besucht, die ersten Tomatenpflanzen gesetzt, den Boden gelockert, die Beete neu sortiert.",
        ).join(" "),
      },
    },
    author: lena,
  },
}

/**
 * Dieselbe Karte in allen vier Dichten nebeneinander — derselbe Vorgang,
 * viermal verschieden viel Platz.
 */
export const DensitiesSideBySide: Story = {
  name: "Densities side by side",
  parameters: { layout: "fullscreen", wide: true },
  render: () => {
    const item: Item = { ...taskItem, tags: ["garten", "werkstatt", "nachbarschaft"] }
    const footer = (tile: boolean) => (
      <>
        <ItemAssignees users={[lena, { ...anton, variant: "outline" as const }]} size={tile ? "xs" : "sm"} />
        {!tile && (
          <div className="ml-auto">
            <ItemCommentCount count={3} />
          </div>
        )}
      </>
    )
    return (
      <div className="flex flex-wrap items-start gap-6">
        <div className="w-[420px] space-y-2">
          <p className="text-xs font-medium text-muted-foreground">comfortable — feed</p>
          <ItemPreview item={item} author={lena} footerAdornment={footer(false)} />
        </div>
        <div className="w-[276px] space-y-2">
          <p className="text-xs font-medium text-muted-foreground">compact — kanban</p>
          <ItemPreview item={item} author={null} density="compact" footerAdornment={footer(false)} />
        </div>
        <div className="w-[276px] space-y-2">
          <p className="text-xs font-medium text-muted-foreground">row — reverse list</p>
          <ItemPreview item={item} author={null} density="row" headerAdornment={<ItemTypeBadge type="task" />} />
        </div>
        <div className="w-[112px] space-y-2">
          <p className="text-xs font-medium text-muted-foreground">dense — matrix</p>
          <ItemPreview item={item} author={null} density="dense" footerAdornment={footer(true)} />
        </div>
      </div>
    )
  },
}

/**
 * Wofuer die dichte Karte gebaut ist: zwoelf Spalten mal vier Zeilen auf
 * einen Schirm, ohne zu scrollen.
 */
export const DenseTwelveColumnGrid: Story = {
  name: "Dense — twelve-column grid",
  parameters: { layout: "fullscreen", wide: true },
  render: () => {
    const columns = ["Material", "Werkzeug", "Termine", "Orte", "Leute", "Geld", "Technik", "Garten", "Küche", "Doku", "Außen", "Rest"]
    return (
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(12, 112px)" }}>
        {columns.map((column) => (
          <div key={column} className="text-[10px] font-medium text-muted-foreground">
            {column}
          </div>
        ))}
        {Array.from({ length: 48 }, (_, i) => {
          const item: Item = {
            ...taskItem,
            id: `matrix-${i}`,
            data: {
              ...taskItem.data,
              title: i % 3 === 0 ? `Gemeinschaftsgarten ${i + 1} vorbereiten und bepflanzen` : `Aufgabe ${i + 1}`,
            },
          }
          return (
            <ItemPreview
              key={item.id}
              item={item}
              author={null}
              density="dense"
              // Jede vierte gilt als erledigt: Haekchen plus gedimmte Kachel.
              completed={i % 4 === 3}
              footerAdornment={
                <ItemAssignees
                  users={i % 2 === 0 ? [lena, { ...anton, variant: "outline" as const }] : [lena]}
                  size="xs"
                />
              }
              onClick={() => console.log("click", item.id)}
            />
          )
        })}
      </div>
    )
  },
}

/**
 * Zwei Avatar-Formen, keine Bedeutung: Das Karabirrdt liest gefuellt als
 * „kann ich" und umrandet als „will lernen"; eine andere App liest sie als
 * Zusage und Vielleicht. Beide Formen muessen auch mit Profilfoto und bei
 * 14 px unterscheidbar bleiben — umrandet traegt dann Ring, Innenabstand und
 * ein zurueckgenommenes Foto.
 */
export const AssigneeStyles: Story = {
  name: "Assignees — solid and outline, with and without photo",
  parameters: { layout: "fullscreen", wide: true },
  render: () => {
    const emil: User = { id: "user-emil", displayName: "Emil Kranz" }
    const mira: User = { id: "user-mira", displayName: "Mira Okafor" }
    const withPhoto = [lena, anton]
    const withoutPhoto = [emil, mira]
    const outline = (users: User[]) => users.map((u) => ({ ...u, variant: "outline" as const }))
    const rows: { label: string; users: User[] }[] = [
      { label: "with photo", users: withPhoto },
      { label: "without photo", users: withoutPhoto },
    ]
    return (
      <div className="space-y-6">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-wrap items-start gap-8">
            <p className="w-28 text-xs font-medium text-muted-foreground">{row.label}</p>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">solid (default)</p>
              <ItemAssignees users={row.users} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">outline</p>
              <ItemAssignees users={outline(row.users)} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">mixed, size xs</p>
              <ItemAssignees users={[row.users[0]!, ...outline([row.users[1]!])]} size="xs" />
            </div>
            <div className="w-[112px] space-y-2">
              <p className="text-xs text-muted-foreground">in the tile</p>
              <ItemPreview
                item={{ ...taskItem, id: `tile-${row.label}`, data: { ...taskItem.data, title: "Gemeinschaftsgarten gießen" } }}
                author={null}
                density="dense"
                footerAdornment={<ItemAssignees users={[row.users[0]!, ...outline([row.users[1]!])]} size="xs" />}
              />
            </div>
          </div>
        ))}
      </div>
    )
  },
}
