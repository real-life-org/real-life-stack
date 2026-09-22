import type { Meta, StoryObj } from "@storybook/react-vite"
import type { CreateItemInput, Item, ItemFilter, RelatedItemsOptions, User } from "@real-life-stack/data-interface"
import { BaseConnector, createObservable, findRelatedItems, matchesFilter, type ReactiveObservable } from "@real-life-stack/data-interface"
import { ConnectorProvider } from "@/hooks/connector-context"
import { ItemDetailPanel } from "./item-detail-panel"
import { ItemPreview, ItemTypeBadge, ItemMetaRow } from "../preview"

// ---- In-memory connector ----
// ItemDetailPanel renders CommentSection, which talks to the connector via
// useComments (observeRelatedItems + createItem). BaseConnector provides
// defaults for everything except the five item methods; we add reactive
// related-items observables so newly written comments show up live.

class StoryConnector extends BaseConnector {
  private items: Item[]
  private nextId = 100
  private relatedObservables = new Map<string, ReactiveObservable<Item[]>>()
  private relatedParams = new Map<string, { itemId: string; predicate?: string; options?: RelatedItemsOptions }>()
  private user: User = { id: "user-1", displayName: "Anna Schmidt", avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg" }

  constructor(seed: Item[]) {
    super()
    this.items = [...seed]
  }

  async getItems(filter?: ItemFilter): Promise<Item[]> {
    if (!filter) return this.items
    return this.items.filter((item) => matchesFilter(item, filter))
  }

  async getItem(id: string): Promise<Item | null> {
    return this.items.find((i) => i.id === id) ?? null
  }

  async createItem(item: CreateItemInput): Promise<Item> {
    if (item.id !== undefined) {
      const existing = this.items.find((candidate) => candidate.id === item.id)
      if (existing) return existing
    }
    let id = item.id
    if (id === undefined) {
      do {
        id = `item-${this.nextId++}`
      } while (this.items.some((candidate) => candidate.id === id))
    }
    const created: Item = { ...item, id, createdAt: new Date().toISOString() }
    this.items.push(created)
    this.refreshRelated()
    return created
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<Item> {
    const idx = this.items.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error(`Item not found: ${id}`)
    this.items[idx] = { ...this.items[idx], ...updates, id }
    this.refreshRelated()
    return this.items[idx]
  }

  async deleteItem(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id)
    this.refreshRelated()
  }

  override observeRelatedItems(itemId: string, predicate?: string, options?: RelatedItemsOptions) {
    const key = JSON.stringify([itemId, predicate, options])
    let obs = this.relatedObservables.get(key)
    if (!obs) {
      obs = createObservable<Item[]>(findRelatedItems(itemId, this.items, predicate, options))
      this.relatedObservables.set(key, obs)
      this.relatedParams.set(key, { itemId, predicate, options })
    }
    return obs
  }

  override async getCurrentUser(): Promise<User | null> {
    return this.user
  }

  override async getUser(id: string): Promise<User | null> {
    if (id === this.user.id) return this.user
    return { id, displayName: id === "user-2" ? "Thomas Müller" : "Lena Weber" }
  }

  private refreshRelated(): void {
    for (const [key, obs] of this.relatedObservables) {
      const params = this.relatedParams.get(key)
      if (params) obs.set(findRelatedItems(params.itemId, this.items, params.predicate, params.options))
    }
  }
}

// ---- Seed data ----

const POST: Item = {
  id: "post-1",
  type: "post",
  createdAt: "2026-06-08T10:00:00Z",
  createdBy: "user-1",
  data: {
    title: "Gemeinschaftsgarten: Samstagstreffen",
    content: "Wir treffen uns am Samstag zum Beete vorbereiten und planen die nächsten Schritte."
  }, tags: ["garten", "planung"],
}

function comment(id: string, createdBy: string, content: string, replyTo?: string): Item {
  return {
    id,
    type: "comment",
    createdAt: `2026-06-08T1${id.slice(-1)}:00:00Z`,
    createdBy,
    data: replyTo ? { content, replyTo } : { content },
    relations: [{ predicate: "commentOn", target: `item:${POST.id}` }],
  }
}

const SEED: Item[] = [
  POST,
  comment("c1", "user-2", "Tolle Idee! Bin dabei."),
  comment("c2", "user-3", "Ich bringe Kuchen mit! 🎂"),
  comment("c3", "user-1", "Super, dann bis Samstag.", "c1"),
]

/**
 * **ItemDetailPanel** is the detail as a whole: a top slot for the reading
 * view and, underneath, the discussion — comments with replies and the input.
 * The panel owns the comment wiring (`useComments`); what goes into the top
 * slot is decided by the surface, in the app always `ItemDetailBody`.
 *
 * Without relations there is no discussion; the top slot still shows. Without
 * a write capability the input is gone; the comments still read.
 */
const meta: Meta<typeof ItemDetailPanel> = {
  tags: ["autodocs"],
  id: "rls-module-components-detail-itemdetailpanel",
  title: "RLS/Items/Detail view/Content and discussion",
  component: ItemDetailPanel,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Der innere Baustein der Detailansicht: Top-Slot (children) plus Kommentarliste plus unten gepinnte Eingabe. Die Apps benutzen ihn nicht direkt, sondern über `ItemDetailView`, das Lesen und Bearbeiten umschaltet und das ⋮-Menü einsetzt — zu sehen unter „App Shell → Die Modulfläche\". Was im Top-Slot steht, folgt dem ITEM, nicht dem Modul: ein Task ist ein Task, ob aus dem Kanban oder aus der Sammlung geöffnet (die frühere Regel je Modul hat #183 und #196 ausgelöst). Kommentieren und Antworten funktionieren hier live.",
      },
    },
  },
  decorators: [
    (Story) => (
      <ConnectorProvider connector={new StoryConnector(SEED)}>
        <div className="mx-auto h-[600px] max-w-md border rounded-lg overflow-hidden">
          <Story />
        </div>
      </ConnectorProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof ItemDetailPanel>

/** Feed variant: a read-only ItemPreview as top slot, comments underneath. */
export const FeedDetail: Story = {
  name: "Feed detail with discussion",
  render: () => (
    <ItemDetailPanel itemId={POST.id}>
      <div className="p-4">
        <ItemPreview
          item={POST}
          author={{ id: "user-1", displayName: "Anna Schmidt", avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg" }}
          headerAdornment={<ItemTypeBadge type={POST.type} />}
          metaAdornment={<ItemMetaRow item={POST} />}
        />
      </div>
    </ItemDetailPanel>
  ),
}

/**
 * The top slot is technically free — the panel only owns the comment wiring.
 * In an app it always holds `ItemDetailBody`, filled by the item's type. This
 * story shows the limit of the building block, not an invitation to render
 * something different per module.
 */
export const CustomTopSlot: Story = {
  name: "The top slot is free (limit, not invitation)",
  render: () => (
    <ItemDetailPanel itemId={POST.id}>
      <div className="p-6 space-y-2">
        <h2 className="text-lg font-semibold">Eigener Inhalt</h2>
        <p className="text-sm text-muted-foreground">
          Der Top-Slot ist frei — Module entscheiden selbst, was hier steht
          (View-Card, Edit-Form, Vorschau …).
        </p>
      </div>
    </ItemDetailPanel>
  ),
}
