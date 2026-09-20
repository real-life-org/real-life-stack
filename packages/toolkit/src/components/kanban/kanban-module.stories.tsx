import { useMemo, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item, User } from "@real-life-stack/data-interface"
import { KanbanBoard } from "./kanban-board"
import { ModuleFrame } from "../layout/module-frame"
import { ModuleToolbar } from "../layout/module-toolbar"
import { FilterProvider } from "../filter/filter-store"
import { FilterChip, FilterToggle, FilterSection } from "../filter/filter-building-blocks"
import { useModuleFilteredItems } from "../../hooks/use-filterable-items"
import { filterByAssignee } from "../../lib/item-filter"

/**
 * **Das Kanban-Modul als Fläche.**
 *
 * Das Board ist nur der Inhalt. Kopf und Filter gehören der Fläche: Suche und
 * die geteilten Filter kommen aus `ModuleToolbar`, und was nur im Kanban
 * bedeutet (Zuweisung, „Nur meine") reicht das Modul als `drawerExtra` und
 * `chipsExtra` hinein. Genauso macht es `apps/reference/src/views/kanban-view.tsx`.
 *
 * Eine frühere Fassung zeigte hier eine eigene `KanbanToolbar`. Die hatte in
 * keiner App mehr einen Aufrufer und ist entfallen.
 */

const users: User[] = [
  { id: "user-1", displayName: "Anna Schmidt", avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: "user-2", displayName: "Max Mustermann", avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg" },
  { id: "user-3", displayName: "Thomas Müller", avatarUrl: "https://randomuser.me/api/portraits/men/67.jpg" },
]

const initialItems: Item[] = [
  {
    id: "task-1",
    type: "task",
    createdAt: new Date().toISOString(),
    createdBy: "user-1",
    data: {
      title: "Materialliste fertigstellen",
      description: "Holz, Schrauben und Erde für den Hochbeetbau prüfen.",
      status: "open",
      order: 0
    }, tags: ["hochbeet"],
    relations: [{ predicate: "assignedTo", target: "global:user-1" }],
  },
  {
    id: "project-1",
    type: "task",
    createdAt: new Date().toISOString(),
    createdBy: "user-2",
    data: {
      title: "Hochbeet-Projekt koordinieren",
      description: "Status ist Board-Workflow, keine Projektbewertung.",
      status: "in-progress",
      order: 0
    }, tags: ["projekt"],
    relations: [{ predicate: "assignedTo", target: "global:user-2" }],
  },
  {
    id: "task-2",
    type: "task",
    createdAt: new Date().toISOString(),
    createdBy: "user-3",
    data: {
      title: "Dokumentation vorbereiten",
      description: "Fotos und kurze Notizen für den Feed sammeln.",
      status: "in-progress",
      order: 1
    }, tags: ["doku"],
    relations: [{ predicate: "assignedTo", target: "global:user-3" }],
  },
  {
    id: "task-3",
    type: "task",
    createdAt: new Date().toISOString(),
    createdBy: "user-1",
    data: {
      title: "Termin abstimmen",
      description: "Samstag 10 Uhr ist bestätigt.",
      status: "done",
      order: 0
    }, tags: ["orga"],
  },
]

function KanbanInhalt({ items, onMove }: { items: Item[]; onMove: (id: string, status: string, pos: number) => void }) {
  const [nurMeine, setNurMeine] = useState(false)
  const geteilt = useModuleFilteredItems(items)
  const gezeigt = useMemo(() => filterByAssignee(geteilt, { myItemsOnly: nurMeine }, "user-1"), [geteilt, nurMeine])
  return (
    <ModuleFrame fill="container" maxWidth="72rem">
      <ModuleToolbar
        drawerExtra={
          <FilterSection label="Zuweisung">
            <FilterToggle label="Nur meine Aufgaben" value={nurMeine} onChange={setNurMeine} />
          </FilterSection>
        }
        chipsExtra={nurMeine ? <FilterChip label="Nur meine" onRemove={() => setNurMeine(false)} /> : undefined}
      />
      <div className="p-4">
        <KanbanBoard items={gezeigt} users={users} onMoveItem={onMove} />
      </div>
    </ModuleFrame>
  )
}

function KanbanModuleOverview() {  const [items, setItems] = useState(initialItems)
  const handleMoveItem = (itemId: string, newStatus: string, position: number) => {
    setItems((prev) => {
      const item = prev.find((candidate) => candidate.id === itemId)
      if (!item) return prev

      const columnItems = prev
        .filter((candidate) => (candidate.data.status as string) === newStatus && candidate.id !== itemId)
        .sort((a, b) => ((a.data.order as number) ?? 0) - ((b.data.order as number) ?? 0))

      columnItems.splice(position, 0, { ...item, data: { ...item.data, status: newStatus } })

      const updatedColumnItems = columnItems.map((candidate, index) => ({
        ...candidate,
        data: { ...candidate.data, order: index },
      }))

      const otherItems = prev.filter(
        (candidate) => (candidate.data.status as string) !== newStatus && candidate.id !== itemId
      )

      return [...otherItems, ...updatedColumnItems]
    })
  }

  return (
    <FilterProvider>
      <div className="h-[36rem]">
        <KanbanInhalt items={items} onMove={handleMoveItem} />
      </div>
    </FilterProvider>
  )
}

const meta: Meta<typeof KanbanModuleOverview> = {
  id: "rls-space-modules-kanban-overview",
  title: "RLS/Module/Kanban/Übersicht",
  component: KanbanModuleOverview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta
type Story = StoryObj<typeof KanbanModuleOverview>

export const Default: Story = {}
