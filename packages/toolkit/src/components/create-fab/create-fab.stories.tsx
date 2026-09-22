import type { Meta, StoryObj } from "@storybook/react-vite"
import { CreateFab } from "./create-fab"

/**
 * **CreateFab** is the plus button of a module surface. The host renders it
 * once per module (spec 01, the module host): it offers **all** content types
 * of the space, the module only suggests one (`options.suggestType`). It is
 * called "Erstellen" everywhere — a module-specific label would be a second
 * type list in disguise. It steps aside while a location is being picked on
 * the map, is missing without a write capability, and yields to a module's
 * own entry point while that is in view (the feed's pill, `setCreateAnchor`).
 *
 * Here the button alone; in every module overview you see it in place.
 */
const meta: Meta<typeof CreateFab> = {
  id: "rls-modules-create-trigger",
  title: "RLS/Modules/Shared tools/Create trigger",
  component: CreateFab,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="relative h-[480px] w-full overflow-hidden rounded-xl border bg-muted/20">
        <div className="p-6 text-sm text-muted-foreground">
          A module surface. The plus button sits fixed bottom right; the host places it.
        </div>
        <Story />
      </div>
    ),
  ],
}
export default meta

type Story = StoryObj<typeof CreateFab>

export const Default: Story = {
  name: "The one plus button",
  render: () => <CreateFab onClick={() => console.log("create clicked")} label="Erstellen" />,
}
