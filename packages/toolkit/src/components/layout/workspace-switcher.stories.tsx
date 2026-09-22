import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { WorkspaceSwitcher, type Workspace } from "./workspace-switcher"

const WORKSPACES: Workspace[] = [
  { id: "__overview__", name: "Mein Netzwerk", scope: "overview" },
  { id: "group-1", name: "Gemeinschaftsgarten" },
  { id: "group-2", name: "Nachbarschaftshilfe", avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=nachbarschaft" },
  { id: "group-3", name: "Repair-Café" },
]

/**
 * **WorkspaceSwitcher** is the space in the header's left compartment: the
 * active space with avatar and name, the list of your spaces, the overview
 * "Mein Netzwerk" on top, and — when the frame provides the handlers —
 * "create a space" and "edit" per space. It shows a syncing hint while a
 * device receives its first stock, so a short list is not mistaken for a
 * complete one.
 */
const meta: Meta<typeof WorkspaceSwitcher> = {
  tags: ["autodocs"],
  id: "rls-app-shell-navigation-workspaceswitcher",
  title: "RLS/App shell/Space switcher/WorkspaceSwitcher",
  component: WorkspaceSwitcher,
  parameters: {
    docs: {
      description: {
        component:
          "App-Shell-Fläche zum Wechseln des Current Space. Zeigt das Overview-Pseudo-Workspace (\"Mein Netzwerk\") getrennt von den Gruppen. `activeWorkspace` darf null sein — z.B. wenn die URL auf einen Space ohne Zugriff zeigt; der Trigger rendert dann einen neutralen Zustand, das Dropdown bleibt voll bedienbar.",
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof WorkspaceSwitcher>

function InteractiveSwitcher({ initial }: { initial: Workspace | null }) {
  const [active, setActive] = useState<Workspace | null>(initial)
  return (
    <WorkspaceSwitcher
      workspaces={WORKSPACES}
      activeWorkspace={active}
      onWorkspaceChange={setActive}
      onCreateWorkspace={() => console.log("create workspace")}
      onEditWorkspace={(w) => console.log("edit workspace", w.id)}
    />
  )
}

/** A group is active — avatar and name in the trigger. */
export const GroupActive: Story = {
  name: "A group is active",
  render: () => <InteractiveSwitcher initial={WORKSPACES[1]} />,
}

/** The overview pseudo-workspace is active — home icon instead of avatar. */
export const OverviewActive: Story = {
  name: "The overview is active",
  render: () => <InteractiveSwitcher initial={WORKSPACES[0]} />,
}

/**
 * No active workspace (null) — the state behind the no-access screen: the URL
 * points to a space the user is not a member of. The trigger reads "Space
 * wählen", the dropdown stays the way out to your own spaces.
 */
export const NoActiveWorkspace: Story = {
  name: "No access",
  render: () => <InteractiveSwitcher initial={null} />,
}
