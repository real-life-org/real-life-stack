import type { Meta, StoryObj } from "@storybook/react-vite"
import { ProfilePanelContent } from "./profile-panel-content"

/**
 * **ProfilePanelContent** is the profile overlay: a person with picture, name
 * and bio, read-only for others, editable for yourself. It is opened from any
 * avatar and from the person nodes of the graph (`useOpenProfile`).
 *
 * This is the last surface that is not an item. The profile is becoming an
 * item of the class `person` (spec 09); then this overlay gives way to the
 * shared detail view, and a person is shown like everything else.
 */
const meta: Meta<typeof ProfilePanelContent> = {
  tags: ["autodocs"],
  id: "module-components-profilepanelcontent",
  title: "RLS/Items/Type examples/Person profile",
  component: ProfilePanelContent,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div className="w-[380px] rounded-xl border bg-card shadow-sm">
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof ProfilePanelContent>

const baseProfile = {
  did: "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
  name: "Timo",
  bio: "Permakultur, Code und gute Gespräche.",
  avatar: "https://i.pravatar.cc/150?img=12",
}

export const ViewForeign: Story = {
  name: "Read-only: someone else",
  render: () => (
    <ProfilePanelContent
      mode="view"
      profile={baseProfile}
      onClose={() => console.log("close")}
    />
  ),
}

export const ViewNoBio: Story = {
  name: "Read-only without bio",
  render: () => (
    <ProfilePanelContent
      mode="view"
      profile={{ ...baseProfile, bio: undefined }}
      onClose={() => console.log("close")}
    />
  ),
}

export const EditOwn: Story = {
  name: "Edit: your own",
  render: () => (
    <ProfilePanelContent
      mode="edit"
      profile={baseProfile}
      contactCount={7}
      onSave={async (u) => console.log("save", u)}
      onClose={() => console.log("close")}
    />
  ),
}
