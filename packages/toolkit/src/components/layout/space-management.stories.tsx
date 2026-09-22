import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ContactInfo, Group } from "@real-life-stack/data-interface"
import { GroupDialog, type GroupDialogMode } from "./group-dialog"
import { SpaceThemePanel } from "./space-theme-panel"
import { Button } from "../primitives/button"
import { STORY_SEED, StoryWorld } from "../../story-support/story-world"

/**
 * **Create and configure a space.**
 *
 * A space belongs to the people in it, not to the instance. So both live in
 * the app and not in an admin surface: whoever creates a space invites people
 * and sets its look without changing place. The frame provides all of it from
 * the space switcher; a connector without groups shows none of it.
 *
 * The look has three axes (accent colour, radius, surfaces) and lives in
 * `group.data`. It travels with the space, across devices and connectors; the
 * instance only gives the default a space departs from. Which modules a space
 * carries is set here too (`data.modules`).
 */

const GARTEN: Group = { ...STORY_SEED.groups[0], data: { primaryColor: "#3f7a4e" } }

const meta: Meta = {
  id: "rls-spaces-management",
  title: "RLS/Spaces/Create and configure",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <StoryWorld>{Story()}</StoryWorld>],
}

export default meta
type Story = StoryObj

/**
 * Contacts who are not in the garden yet: only those the "invite" section
 * offers. Without an invite handler the section does not exist at all — that
 * is how it was missing here until 21 Sept 2026.
 */
const SEIT = "2026-09-01T10:00:00.000Z"
const KONTAKTE: ContactInfo[] = [
  { id: "kim", name: "Kim Adeyemi", status: "active", createdAt: SEIT, updatedAt: SEIT },
  { id: "noor", name: "Noor Haddad", status: "active", createdAt: SEIT, updatedAt: SEIT },
  { id: "jonas", name: "Jonas Klein", status: "active", createdAt: SEIT, updatedAt: SEIT },
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

/** Create: only the name. Everything else comes after. */
export const Create: Story = {
  name: "Create",
  render: () => <DialogStory mode={{ type: "create" }} />,
}

/** Edit: name, members, invite, look, modules, delete — all in the same place. */
export const Edit: Story = {
  name: "Edit",
  render: () => <DialogStory mode={{ type: "edit", group: GARTEN }} />,
}

/**
 * The fine-tuning of the look. In the app it sits in the shared panel; here
 * without a shell so the three axes are visible.
 */
export const Look: Story = {
  name: "Look",
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
