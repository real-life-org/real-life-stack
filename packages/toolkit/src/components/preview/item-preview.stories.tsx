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

const meta: Meta<typeof ItemPreview> = {
  title: "Module Components / ItemPreview",
  component: ItemPreview,
  decorators: [
    // Die Karten-Stories zeigen eine Feed-Spalte; die Dichte-Stories brauchen
    // die ganze Breite, sonst faellt das Raster in Zeilen auseinander.
    (Story, ctx) => (
      <div className={ctx.parameters.breit ? "p-6 bg-background" : "max-w-2xl mx-auto p-6 bg-background"}>
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
 * Dieselbe Karte in allen drei Dichten nebeneinander — derselbe Vorgang,
 * dreimal verschieden viel Platz.
 */
export const DreiDichten: Story = {
  name: "Drei Dichten nebeneinander",
  parameters: { layout: "fullscreen", breit: true },
  render: () => {
    const item: Item = {
      ...taskItem,
      data: {
        ...taskItem.data,
        description: "Erde umgraben und Kompost einarbeiten — bis zum Wochenende.",
      },
      tags: ["garten", "werkstatt", "nachbarschaft"],
    }
    const fuss = (dicht: boolean) => (
      <>
        <ItemAssignees users={[lena, anton]} size={dicht ? "xs" : "sm"} />
        {!dicht && (
          <div className="ml-auto">
            <ItemCommentCount count={3} />
          </div>
        )}
      </>
    )
    return (
      <div className="flex flex-wrap items-start gap-6">
        <div className="w-[420px] space-y-2">
          <p className="text-xs font-medium text-muted-foreground">comfortable — Feed</p>
          <ItemPreview item={item} author={lena} footerAdornment={fuss(false)} />
        </div>
        <div className="w-[276px] space-y-2">
          <p className="text-xs font-medium text-muted-foreground">compact — Kanban</p>
          <ItemPreview item={item} author={null} density="compact" footerAdornment={fuss(false)} />
        </div>
        <div className="w-[130px] space-y-2">
          <p className="text-xs font-medium text-muted-foreground">dense — Matrix</p>
          <ItemPreview item={item} author={null} density="dense" footerAdornment={fuss(true)} />
        </div>
      </div>
    )
  },
}

/**
 * Wofuer die dichte Karte gebaut ist: zwoelf Spalten mal vier Zeilen auf
 * einen Schirm, ohne zu scrollen.
 */
export const RasterZwoelfSpalten: Story = {
  name: "Raster 12 Spalten dense",
  parameters: { layout: "fullscreen", breit: true },
  render: () => {
    const spalten = [
      "Material",
      "Werkzeug",
      "Termine",
      "Orte",
      "Leute",
      "Geld",
      "Technik",
      "Garten",
      "Kueche",
      "Doku",
      "Aussen",
      "Rest",
    ]
    return (
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(12, minmax(0, 130px))" }}>
        {spalten.map((spalte) => (
          <div key={spalte} className="text-[10px] font-medium text-muted-foreground">
            {spalte}
          </div>
        ))}
        {Array.from({ length: 48 }, (_, i) => {
          const item: Item = {
            ...taskItem,
            id: `matrix-${i}`,
            data: {
              ...taskItem.data,
              title: i % 3 === 0 ? `Hochbeet ${i + 1} vorbereiten und bepflanzen` : `Aufgabe ${i + 1}`,
            },
          }
          return (
            <ItemPreview
              key={item.id}
              item={item}
              author={null}
              density="dense"
              footerAdornment={
                <ItemAssignees users={i % 2 === 0 ? [lena, anton] : [lena]} size="xs" />
              }
              onClick={() => console.log("click", item.id)}
            />
          )
        })}
      </div>
    )
  },
}
