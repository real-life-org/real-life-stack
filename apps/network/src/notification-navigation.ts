import type { DataInterface, ModuleHints } from "@real-life-stack/data-interface"
import { hasGroups } from "@real-life-stack/data-interface"
import { moduleForItem, modulePresentsItem } from "@real-life-stack/toolkit"

export type NetworkLensId = "graph" | "list" | "kanban" | "map" | "calendar" | "marketplace"

/**
 * Bis zum 21.09.2026 stand hier eine eigene Kopie der Hinweise; jetzt ist es
 * der Vertrag aus data-interface (offene Tabelle, Spec 01 Ladevertrag).
 */
export type ModuleHintsLike = ModuleHints

/**
 * Welche Linse zeigt was: Die Regel liegt im Modul-Register des Toolkits
 * (`moduleForItem`, `modulePresentsItem`), abgeleitet aus dem, was ein Modul
 * darstellt. Vorher stand sie hier ein viertes Mal im Monorepo, und diese
 * Fassung kannte `resonance` nicht.
 *
 * Die Netzwerk-App nennt ihre Flächen anders als das Register: `list` statt
 * `collection`, dazu ein `marketplace`, den es als Modul nicht gibt. Diese
 * Übersetzung bleibt hier, die Regel nicht.
 */
const LENS_TO_MODULE: Partial<Record<NetworkLensId, string>> = {
  map: "map", calendar: "calendar", kanban: "kanban", graph: "graph", list: "collection",
}
const MODULE_TO_LENS: Record<string, NetworkLensId> = { map: "map", calendar: "calendar", kanban: "kanban", graph: "graph", collection: "list" }

/** Lens choice from connector-resolved hints — the one shared truth for clicks. */
export function lensForHints(hints: ModuleHintsLike | undefined): NetworkLensId {
  if (!hints) return "list"
  const modul = moduleForItem(hints, ["map", "calendar", "kanban"])
  return (modul ? MODULE_TO_LENS[modul] : undefined) ?? "list"
}

/** Can the given lens actually SHOW an item with these hints? */
export function lensCanDisplay(lens: NetworkLensId, hints: ModuleHintsLike | undefined, itemType?: string): boolean {
  // Der Marktplatz ist app-eigen: Er zeigt ausschließlich Ressourcen.
  if (lens === "marketplace") return itemType === "resource"
  const modul = LENS_TO_MODULE[lens]
  if (!modul) return true
  return modulePresentsItem(modul, hints, itemType)
}

/**
 * The ONE handler contract for opening a notification target in the network
 * shell (B-T4): switch group first, select the target WITHOUT consulting the
 * old space's item map (it cannot know cross-group ids), pick the lens from
 * the hints — the detail resolves reactively after the space switch.
 */
export function applyNotificationNavigation(
  target: { groupId: string; subjectId: string; subjectType?: string; moduleHints?: ModuleHintsLike },
  shell: {
    connector: DataInterface
    selectNodeId: (id: string) => void
    setActiveLens: (lens: NetworkLensId) => void
    close: () => void
    /** A cross-space jump is a workspace change: reset query/type filters. */
    resetFilters?: () => void
  },
): void {
  if (hasGroups(shell.connector)) shell.connector.setCurrentGroup(target.groupId)
  shell.resetFilters?.()
  shell.selectNodeId(target.subjectId)
  shell.setActiveLens(lensForHints(target.moduleHints))
  shell.close()
}
