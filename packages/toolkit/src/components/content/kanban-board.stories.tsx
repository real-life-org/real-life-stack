import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item, User } from "@real-life-stack/data-interface"
import { KanbanBoard, defaultColumns } from "./kanban-board"

const users: User[] = [
  { id: "user-1", displayName: "Max Mustermann", avatarUrl: "https://randomuser.me/api/portraits/men/32.jpg" },
  { id: "user-2", displayName: "Anna Schmidt", avatarUrl: "https://randomuser.me/api/portraits/women/44.jpg" },
  { id: "user-3", displayName: "Thomas Müller", avatarUrl: "https://randomuser.me/api/portraits/men/67.jpg" },
]

const tasks: Item[] = [
  {
    id: "task-1",
    type: "task",
    createdAt: new Date(),
    createdBy: "user-1",
    data: { title: "Beete vorbereiten", description: "Erde umgraben und Kompost einarbeiten", status: "todo", position: 0, tags: ["garten"] },
    relations: [{ predicate: "assignedTo", target: "global:user-2" }],
  },
  {
    id: "task-2",
    type: "task",
    createdAt: new Date(),
    createdBy: "user-2",
    data: { title: "Samen bestellen", description: "Tomaten, Zucchini, Kräuter", status: "doing", position: 0, tags: ["garten", "einkauf"] },
    relations: [{ predicate: "assignedTo", target: "global:user-2" }],
  },
  {
    id: "task-3",
    type: "task",
    createdAt: new Date(),
    createdBy: "user-1",
    data: { title: "Wasserschlauch reparieren", description: "Leck am Verbindungsstück abdichten", status: "done", position: 0, tags: ["infrastruktur"] },
    relations: [{ predicate: "assignedTo", target: "global:user-3" }],
  },
  {
    id: "task-4",
    type: "task",
    createdAt: new Date(),
    createdBy: "user-3",
    data: { title: "Gartenplan zeichnen", description: "Welches Beet bekommt welche Pflanzen?", status: "todo", position: 1, tags: ["planung"] },
  },
  {
    id: "task-5",
    type: "task",
    createdAt: new Date(),
    createdBy: "user-1",
    data: { title: "Kompost umsetzen", description: "Der Kompost muss umgesetzt und belüftet werden", status: "doing", position: 1, tags: ["garten"] },
    relations: [{ predicate: "assignedTo", target: "global:user-1" }],
  },
]

const meta: Meta<typeof KanbanBoard> = {
  title: "Content/KanbanBoard",
  component: KanbanBoard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
}

export default meta
type Story = StoryObj<typeof KanbanBoard>

export const Default: Story = {
  args: {
    items: tasks,
    users,
    onMoveItem: (itemId, newStatus) => console.log("Move:", itemId, "→", newStatus),
    onItemClick: (item) => console.log("Clicked:", item.id),
  },
}

export const CustomColumns: Story = {
  args: {
    items: [
      { id: "1", type: "task", createdAt: new Date(), createdBy: "user-1", data: { title: "Idee: Regenwasser sammeln", status: "backlog", position: 0 } },
      { id: "2", type: "task", createdAt: new Date(), createdBy: "user-1", data: { title: "Website aktualisieren", status: "review", position: 0, tags: ["web"] } },
      { id: "3", type: "task", createdAt: new Date(), createdBy: "user-2", data: { title: "Newsletter versenden", status: "doing", position: 0 } },
    ],
    columns: [
      { id: "backlog", label: "Backlog" },
      { id: "doing", label: "In Arbeit" },
      { id: "review", label: "Review" },
      { id: "done", label: "Fertig" },
    ],
  },
}

export const Empty: Story = {
  args: {
    items: [],
    columns: defaultColumns,
  },
}

export const WithoutUsers: Story = {
  args: {
    items: tasks,
  },
}
