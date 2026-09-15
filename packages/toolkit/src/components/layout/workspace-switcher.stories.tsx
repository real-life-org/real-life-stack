import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { WorkspaceSwitcher, type Workspace } from "./workspace-switcher"

const WORKSPACES: Workspace[] = [
  { id: "__overview__", name: "Mein Netzwerk", scope: "overview" },
  { id: "group-1", name: "Gemeinschaftsgarten" },
  { id: "group-2", name: "Nachbarschaftshilfe", avatar: "https://api.dicebear.com/9.x/shapes/svg?seed=nachbarschaft" },
  { id: "group-3", name: "Repair-Café" },
]

const meta: Meta<typeof WorkspaceSwitcher> = {
  title: "RLS/App Shell/Navigation/WorkspaceSwitcher",
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

/** Eine Gruppe ist aktiv — Avatar + Name im Trigger. */
export const GroupActive: Story = {
  render: () => <InteractiveSwitcher initial={WORKSPACES[1]} />,
}

/** Das Overview-Pseudo-Workspace ist aktiv — Home-Icon statt Avatar. */
export const OverviewActive: Story = {
  render: () => <InteractiveSwitcher initial={WORKSPACES[0]} />,
}

/**
 * Kein aktiver Workspace (null) — der Zustand hinter dem No-Access-Screen:
 * die URL zeigt auf einen Space, in dem der User kein Mitglied ist. Der
 * Trigger zeigt "Space wählen", das Dropdown bleibt der Ausweg zu den
 * eigenen Spaces.
 */
export const NoActiveWorkspace: Story = {
  render: () => <InteractiveSwitcher initial={null} />,
}

/**
 * Der Mensch ist Mitglied in Netzwerken (Spec 04): Sie stehen oben mit
 * Zahnrad, darunter „Mein Netzwerk", dann die Gruppen des aktiven Netzwerks,
 * gegliedert nach dessen Arten. Spaces ohne Art zuletzt unter „Gruppen".
 */
export const WithNetworks: Story = {
  render: () => {
    const kinds = [
      { id: "stiftung", label: "Stiftung", labelPlural: "Stiftungen", color: "#1B5E40" },
      { id: "projekt", label: "Projekt", labelPlural: "Projekte", color: "#EA580C" },
    ]
    const workspaces: Workspace[] = [
      { id: "td", name: "trustdonation", isNetwork: true, kinds },
      { id: "mn", name: "macher.network", isNetwork: true, kinds: [] },
      { id: "__overview__", name: "Mein Netzwerk", scope: "overview" },
      { id: "s-1", name: "Bürgerstiftung Kassel", network: "td", kind: "stiftung" },
      { id: "s-2", name: "Software AG-Stiftung", network: "td", kind: "stiftung" },
      { id: "p-1", name: "Werkstatt am Bahnhof", network: "td", kind: "projekt" },
      { id: "p-2", name: "Musterschule Gudensberg", network: "td", kind: "projekt" },
      { id: "g-1", name: "Tratsch & Off-Topics", network: "td" },
      { id: "m-1", name: "Holzwerkstatt", network: "mn" },
    ]
    const [active, setActive] = useState<Workspace | null>(workspaces[0])
    const activeNetworkId = active?.isNetwork ? active.id : (active?.network ?? "td")
    return (
      <WorkspaceSwitcher
        workspaces={workspaces}
        activeWorkspace={active}
        onWorkspaceChange={setActive}
        onCreateWorkspace={() => console.log("create workspace")}
        onEditWorkspace={(w) => console.log("edit workspace", w.id)}
        activeNetworkId={activeNetworkId}
      />
    )
  },
}
