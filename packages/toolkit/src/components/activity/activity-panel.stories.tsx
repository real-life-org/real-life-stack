import type { Meta, StoryObj } from "@storybook/react"
import { ActivityPanel } from "./activity-panel"

/**
 * **ActivityPanel** is the raw history of a space: who did what, when — every
 * create, update and delete as one line, from the connector's activity log
 * (spec 10). A line whose target still exists can be opened; a deletion or a
 * cardless target (comment, reaction) stays a line. The frame shows it inside
 * the shared panel behind the bell, as the fallback when a connector has no
 * notifications; `ActivityPanelController` does the wiring.
 */
const meta: Meta<typeof ActivityPanel> = { id: "rls-shell-activity-panel", tags: ["autodocs"],
  title: "RLS/App shell/Activity and notifications/ActivityPanel", component: ActivityPanel }
export default meta
type Story = StoryObj<typeof ActivityPanel>

export const Full: Story = { name: "One entry", args: { entries: [{ id: "1", ts: "2026-07-18T09:00:00.000Z", actor: "user-1", action: "update", targetId: "task-1", targetType: "task", summary: "Aufgabe verschoben" }] } }
export const Empty: Story = { name: "Nothing happened yet", args: { entries: [] } }
export const DeleteWithoutCreate: Story = { name: "A deletion: visible, not clickable", args: { entries: [{ id: "2", ts: "2026-07-18T09:00:00.000Z", actor: "user-1", action: "delete", targetId: "gone", targetType: "task", summary: "Gelöschte Aufgabe" }] } }
