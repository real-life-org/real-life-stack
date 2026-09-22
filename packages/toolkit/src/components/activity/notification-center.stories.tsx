import type { Meta, StoryObj } from "@storybook/react-vite"
import { NotificationCenter } from "./notification-center"

const notification = {
  groupId: "garten", groupName: "Gemeinschaftsgarten", subjectId: "post-1", subjectType: "post", subjectTitle: "Gießplan",
  semanticAction: "commented" as const, priority: "high" as const, muted: false, entryId: "entry-1", readKey: '["garten","entry-1"]', actorId: "maria", actor: { id: "maria", displayName: "Maria" },
  ts: "2026-07-18T11:00:00.000Z", targetExists: true, readKeys: { '["garten","entry-1"]': "2026-07-18T11:00:00.000Z" }, actorCount: 1, isRead: false,
}

/**
 * **NotificationCenter** is what the bell opens: the history projected onto
 * what concerns *you* — someone commented, reacted, invited — grouped by
 * space, with read state, "mark all read" and mute per space. It is derived
 * from the same activity log as the panel (`projectNotifications`); a click
 * on a subject leads to the item in its module, in one route
 * (`notificationRoute`). Without notification state the centre is read-only:
 * the actions are simply not there.
 */
const meta = { id: "rls-app-shell-notification-center", tags: ["autodocs"],
  title: "RLS/App shell/Activity and notifications/NotificationCenter", component: NotificationCenter, args: { onOpenSubject: () => {}, onOpenGroup: () => {}, onMarkRead: () => {}, onMarkAllRead: () => {}, onMuteGroup: () => {}, onOpenActivity: () => {} } } satisfies Meta<typeof NotificationCenter>
export default meta
type Story = StoryObj<typeof meta>

export const Full: Story = { name: "One unread notification", args: { notifications: [notification] } }
export const Empty: Story = { name: "Nothing new", args: { notifications: [] } }
export const DegradedReadOnly: Story = { name: "Without notification state: read-only", args: { notifications: [{ ...notification, isRead: true }], onMarkRead: undefined, onMarkAllRead: undefined, onMuteGroup: undefined } }
