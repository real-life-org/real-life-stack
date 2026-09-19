import { type Group, type ModuleHints } from "@real-life-stack/data-interface"
import { modulePresentsItem, resolveSpaceModules, type NotificationCandidate } from "@real-life-stack/toolkit"
import { resolveDefaultModule } from "./hooks/use-workspace-routing"

/**
 * The ONE canonical route for a notification click: scope, module and focus in
 * a single URL change (no setCurrentGroup→focusItem sequencing). The module
 * comes from the shared field-based resolver, fed by the connector-resolved
 * moduleHints — exactly the contract tested in B-T4.
 */
export function buildNotificationRoute(
  notification: NotificationCandidate,
  groups: readonly Group[],
): string {
  const group = groups.find(({ id }) => id === notification.groupId)
  // Unknown scope (e.g. the overview aggregate is not a group) must not
  // collapse the choice to feed — resolve against the full module set.
  // Ohne eigene Modul-Liste (Spec 01, "Modul-Register", Regel 1): die frueher
  // hier stehende Aufzaehlung kannte `collection` und `graph` nicht, obwohl
  // beide laengst existierten — Benachrichtigungen zu deren Items landeten
  // im falschen Tab.
  const available = resolveSpaceModules(
    Array.isArray(group?.data?.modules) ? (group.data.modules as string[]) : undefined,
  )
  // Statements route via their schema hint (statement/v1 → hasStatement,
  // spec 06) — carried in moduleHints like every other activation signal.
  const module = resolveDefaultModule(
    notification.moduleHints ?? { hasPosition: false, hasStart: false, hasStatus: false },
    available,
  )
  return `/${notification.groupId}/${module}/${notification.subjectId}`
}

export type ModuleHintsLike = { hasPosition: boolean; hasStart: boolean; hasStatus: boolean; hasStatement?: boolean }

/**
 * Kann dieses Modul ein Item mit diesen Hinweisen zeigen? Die Regel liegt im
 * Modul-Register (`modulePresentsItem`), abgeleitet aus dem, was ein Modul
 * darstellt (`presents`).
 */
export function moduleCanDisplay(module: string, hints: ModuleHintsLike | undefined, itemType?: string): boolean {
  return modulePresentsItem(module, hints as ModuleHints | undefined, itemType)
}
