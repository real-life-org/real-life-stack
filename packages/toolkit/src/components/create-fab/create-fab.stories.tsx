import type { Meta, StoryObj } from "@storybook/react-vite"
import { CreateFab } from "./create-fab"

const meta: Meta<typeof CreateFab> = {
  id: "module-components-createfab",
  title: "RLS/Modules/Shared tools/Create trigger",
  component: CreateFab,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="relative h-[480px] w-full overflow-hidden rounded-xl border bg-muted/20">
        <div className="p-6 text-sm text-muted-foreground">
          Modul-Surface (Feed, Kanban, Calendar, Map). Der FAB sitzt
          fixed unten-rechts.
        </div>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof CreateFab>

export const Default: Story = {
  render: () => (
    <CreateFab
      onClick={() => console.log("create clicked")}
      label="Erstellen"
    />
  ),
}

export const KanbanLabel: Story = {
  name: "With module-specific label",
  render: () => (
    <CreateFab
      onClick={() => console.log("create task")}
      label="Aufgabe erstellen"
    />
  ),
}
