import type { Group } from "@real-life-stack/data-interface"

import { resolveSpaceModules } from "../../lib/module-register"
import type { NotificationCandidate } from "../activity/notification-center"
import { resolveDefaultModule } from "./workspace-routing"

/**
 * DIE Route für den Klick auf eine Benachrichtigung: Space, Modul und Fokus in
 * einer URL-Änderung — keine Folge aus `setCurrentGroup` und `focusItem`, die
 * sich überholen könnte. Das Modul kommt aus der feldbasierten Regel des
 * Registers, gespeist aus den Hinweisen, die der Connector mitliefert.
 * Bis zum 21.09.2026 in beiden Apps je einmal (`buildNotificationRoute`,
 * `applyNotificationNavigation`), verschieden.
 */
export function notificationRoute(
  notification: Pick<NotificationCandidate, "groupId" | "subjectId" | "moduleHints">,
  groups: readonly Group[],
  fallbackModule?: string,
): string {
  const group = groups.find(({ id }) => id === notification.groupId)
  // Ein unbekannter Scope (die Übersicht ist keine Gruppe) darf die Wahl nicht
  // auf den Rückfall verengen — dann gilt der volle Satz des Registers.
  const available = resolveSpaceModules(
    Array.isArray(group?.data?.modules) ? (group.data.modules as string[]) : undefined,
  )
  const module = resolveDefaultModule(
    notification.moduleHints ?? { hasPosition: false, hasStart: false, hasStatus: false },
    available,
    fallbackModule,
  )
  return `/${notification.groupId}/${module}/${notification.subjectId}`
}
