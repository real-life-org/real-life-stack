import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ContactInfo, Group } from "@real-life-stack/data-interface"
import { GroupDialog, type GroupDialogMode } from "./group-dialog"
import { SpaceThemePanel } from "./space-theme-panel"
import { Button } from "../primitives/button"
import { STORY_SEED, StoryWorld } from "../../story-support/story-world"

/**
 * **Einen Space anlegen und einrichten.**
 *
 * Ein Space gehört den Menschen darin, nicht der Instanz. Deshalb liegt beides
 * in der App und nicht in einer Verwaltungsoberfläche: Wer einen Space anlegt,
 * lädt ein und stellt sein Aussehen ein, ohne den Ort zu wechseln.
 *
 * Das Aussehen hat drei Achsen (Akzentfarbe, Rundung, Flächen) und liegt in
 * `group.data`. Es wandert mit dem Space mit, über Geräte und Connectoren
 * hinweg; die Instanz gibt nur die Vorgabe, von der aus ein Space abweicht.
 */

const GARTEN: Group = { ...STORY_SEED.groups[0], data: { primaryColor: "#3f7a4e" } }

const meta: Meta = {
  id: "rls-app-shell-space-verwaltung",
  title: "RLS/Spaces/Anlegen und Einrichten",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
}

export default meta
type Story = StoryObj

/**
 * Kontakte, die noch nicht im Garten sind: Nur sie bietet der Bereich
 * „Einladen" an. Ohne Einlade-Handler gibt es den Bereich gar nicht — so
 * fehlte er hier bis zum 21.09.2026 (Anton).
 */
const KONTAKTE: ContactInfo[] = [
  { id: "kim", name: "Kim Adeyemi", status: "active" },
  { id: "noor", name: "Noor Haddad", status: "active" },
  { id: "jonas", name: "Jonas Klein", status: "active" },
]

function DialogStory({ mode }: { mode: GroupDialogMode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="min-h-screen bg-background p-8">
      <Button onClick={() => setOpen(true)}>Dialog öffnen</Button>
      <GroupDialog
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        currentUserId="mira"
        contacts={KONTAKTE}
        onCreateGroup={async () => setOpen(false)}
        onUpdateGroup={async () => {}}
        onDeleteGroup={async () => setOpen(false)}
        onInviteMember={async () => {}}
      />
    </div>
  )
}

/** Anlegen: nur der Name. Alles andere kommt danach. */
export const Anlegen: Story = {
  render: () => <DialogStory mode={{ type: "create" }} />,
}

/** Bearbeiten: Name, Mitglieder, Einladen, Aussehen, Module, Löschen — alles am selben Ort. */
export const Bearbeiten: Story = {
  render: () => <DialogStory mode={{ type: "edit", group: GARTEN }} />,
}

/**
 * Die Feineinstellung des Aussehens. In der App liegt sie im geteilten Panel,
 * hier ohne Hülle, damit die drei Achsen sichtbar sind.
 */
export const Aussehen: Story = {
  render: function Render() {
    const [group, setGroup] = useState<Group>(GARTEN)
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-sm rounded-xl border bg-card p-4">
          <SpaceThemePanel
            group={group}
            onUpdateGroup={(_id, updates) => setGroup((g) => ({ ...g, data: { ...g.data, ...updates.data } }))}
          />
        </div>
      </div>
    )
  },
}
