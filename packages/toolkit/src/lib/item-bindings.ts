import { normalizeItemType, type Item } from "@real-life-stack/data-interface"

import { resolveTypePresentation } from "../components/preview/type-presentation"
import { targetItemId } from "./item-targets"

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

function refersTo(value: unknown, itemId?: string): boolean {
  if (typeof value !== "string") return false
  const target = targetItemId(value)
  return itemId === undefined ? target !== null : target === itemId
}

/**
 * Hat `item` Beziehungen im Sinn von Regel 5 (shared-components → Space des
 * Formulars)? Dann bleibt es in seinem Space.
 *
 * - ausgehend: eine eingebettete Item-Kante (`item:` oder
 *   `space:{id}/item:`) oder ein Feld mit Item-Verweis (etwa `variantOf`);
 * - eingehend, aus den Items seines Space (`spaceItems`): eine Kante oder ein
 *   Item-Verweis eines anderen Items auf dieses. Darunter fallen Records
 *   (Stimmen, Zusagen: `to` → das Item), Kommentare (`commentOn`) und
 *   Reaktionen (`reactsTo`), auch eigene.
 *
 * Personen-Kanten (`global:`) und Tags zählen nicht; sie ziehen mit um.
 */
export function itemHasBindings(item: Item, spaceItems: readonly Item[]): boolean {
  if ((item.relations ?? []).some((r) => refersTo(r.target))) return true
  if (itemRefKeys(item.type).some((key) => refersTo(item.data[key]))) return true
  return spaceItems.some(
    (other) =>
      other.id !== item.id &&
      ((other.relations ?? []).some((r) => refersTo(r.target, item.id)) ||
        itemRefKeys(other.type).some((key) => refersTo(other.data[key], item.id))),
  )
}
