import type { Group } from "@real-life-stack/data-interface"

import { notificationTarget } from "../../lib/notification-target"
import type { NotificationCandidate } from "../activity/notification-center"

/**
 * DIE Route für den Klick auf eine Benachrichtigung — `notificationTarget`
 * als URL. Bis zum 21.09.2026 in beiden Apps je einmal, verschieden.
 */
export function notificationRoute(
  notification: Pick<NotificationCandidate, "groupId" | "subjectId" | "moduleHints">,
  groups: readonly Group[],
  fallbackModule?: string,
): string {
  const { groupId, module, itemId } = notificationTarget(notification, groups, fallbackModule)
  return `/${groupId}/${module}/${itemId}`
}
