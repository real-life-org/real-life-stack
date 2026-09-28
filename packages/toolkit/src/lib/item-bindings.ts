import { normalizeItemType, type Item } from "@real-life-stack/data-interface"

import { resolveTypePresentation } from "../components/preview/type-presentation"
import { isItemTarget, resolveTarget, spaceScope } from "./item-targets"
import type { DataInterface } from "@real-life-stack/data-interface"

/**
 * Grund im Tooltip der festen Space-Anzeige (shared-components → Space des
 * Formulars, Regel 5).
 */
export const ITEM_BINDINGS_REASON = "Hat Verknüpfungen, Stimmen oder Zusagen – bleibt in diesem Space"

/** Die Schlüssel der Felder mit Item-Verweis (B15 `item-ref`) aller Klassen eines Items, aus dem Register. */
function itemRefKeys(type: string): string[] {
  return normalizeItemType(type).flatMap((klasse) =>
    (resolveTypePresentation(klasse).fields ?? []).filter((f) => f.widget === "item-ref").map((f) => f.key),
  )
}

/** Ein ausgehender Item-Verweis (irgendein Item-Target, lokal oder qualifiziert). */
function refersOut(value: unknown): boolean {
  return isItemTarget(value)
}

/**
 * Hat `item` Beziehungen im Sinn von Regel 5 (shared-components → Space des
 * Formulars)? Dann bleibt es in seinem Space.
 *
 * - ausgehend: eine eingebettete Item-Kante (`item:` oder
 *   `space:{id}/item:`) oder ein Feld mit Item-Verweis (etwa `variantOf`);
 * - eingehend, aus den Items seines Space (`spaceItems`): eine Kante oder ein
 *   Item-Verweis eines anderen Items, der laut Auflöser auf DIESES Item zeigt
 *   (06, Verhältnis zu Relations, Regel 6). Darunter fallen Records
 *   (Stimmen, Zusagen: `to` → das Item), Kommentare (`commentOn`) und
 *   Reaktionen (`reactsTo`), auch eigene. `itemSpace` ist der Space des Items
 *   und der Items in `spaceItems`; ohne ihn zählt ein qualifiziertes Target
 *   nicht (nicht prüfbar).
 *
 * Personen-Kanten (`global:`) und Tags zählen nicht; sie ziehen mit um.
 */
export function itemHasBindings(
  item: Item,
  spaceItems: readonly Item[],
  itemSpace: string | null = null,
  connector: DataInterface | null = null,
): boolean {
  if ((item.relations ?? []).some((r) => refersOut(r.target))) return true
  if (itemRefKeys(item.type).some((key) => refersOut(item.data[key]))) return true
  // Der Auflöser (06, Verhältnis zu Relations, Regel 6): Die Items liegen im
  // Space des Items; ohne bekannten Space gilt der eine Bereich der Menge.
  const scope = spaceScope(connector, itemSpace, { knownInSpace: new Set([item.id, ...spaceItems.map((i) => i.id)]) })
  const refersHere = (value: unknown) => resolveTarget(value, scope, [item]) === item
  return spaceItems.some(
    (other) =>
      other.id !== item.id &&
      ((other.relations ?? []).some((r) => refersHere(r.target)) ||
        itemRefKeys(other.type).some((key) => refersHere(other.data[key]))),
  )
}
