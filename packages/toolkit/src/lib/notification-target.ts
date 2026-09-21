import type { Group, Item, ModuleHints } from "@real-life-stack/data-interface"

import { moduleForItem, resolveSpaceModules } from "./module-register"

/**
 * Das Modul für einen Item-Link ohne Modul. Die Regel liegt im Register
 * (`moduleForItem`); hier bleibt der Aufruf und der Rückfall — den wählt die
 * App (Spec 01, Der Modul-Host): die Referenz-App den Feed, die Netzwerk-App
 * die Liste. Ohne Angabe das erste Modul des Space.
 */
export function resolveDefaultModule(itemOrHints: Item | ModuleHints, available: readonly string[], fallback?: string): string {
  const gewaehlt = moduleForItem(itemOrHints, available)
  if (gewaehlt) return gewaehlt
  return fallback && available.includes(fallback) ? fallback : (available[0] ?? fallback ?? resolveSpaceModules()[0])
}

export interface NotificationTarget {
  groupId: string
  module: string
  itemId: string
}

/**
 * Wohin ein Klick auf eine Benachrichtigung führt: Space, Modul und Item —
 * in einem Schritt, damit sich kein `setCurrentGroup` und `focusItem`
 * überholen. Das Modul kommt aus der feldbasierten Regel des Registers,
 * gespeist aus den Hinweisen, die der Connector mitliefert. Routerfrei;
 * `notificationRoute` (`/router`) macht daraus eine URL.
 */
export function notificationTarget(
  notification: { groupId: string; subjectId: string; moduleHints?: ModuleHints },
  groups: readonly Group[],
  fallbackModule?: string,
): NotificationTarget {
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
  return { groupId: notification.groupId, module, itemId: notification.subjectId }
}
