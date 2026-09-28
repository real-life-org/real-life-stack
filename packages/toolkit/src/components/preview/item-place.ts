"use client"

// Der Ort eines Items (B4, S4b): das Ort-Item, auf das seine Ort-Kante zeigt.
// Eine Stelle für Karte (abgeleitete Position), Fokus und Kartenvorschau;
// das Ziel bestimmt der Auflöser für Kanten-Ziele (06, Verhältnis zu
// Relations, Regel 6). Verzweigt über die Ort-Kante des Registers, nie über
// den Typ.

import { useMemo } from "react"
import { hasItemGroups, normalizeItemType, type DataInterface, type Item } from "@real-life-stack/data-interface"

import { useItem } from "../../hooks/use-items"
import { useConnector } from "../../hooks/connector-context"
import { resolveTarget, targetItemId, type SpaceOf } from "../../lib/item-targets"
import { resolveTypePresentation } from "./type-presentation"
import { locationEdge, otherKindOf, targetFilter } from "./use-item-edges"
import type { EdgeEntry } from "./field-register"

/**
 * Die Ort-Kante eines Items über ALLE seine Klassen, nicht nur die Vorlage
 * (06, Klassen-Regeln 8/9): die erste Klasse, deren Register ein Ort-Feld mit
 * Ort-Kante führt.
 */
export function placeEdgeOf(item: Item): { klasse: string; edge: EdgeEntry } | undefined {
  for (const klasse of normalizeItemType(item.type)) {
    const presentation = resolveTypePresentation(klasse)
    if (presentation.generic) continue
    const edge = locationEdge(klasse, presentation.fields, presentation.edges)
    if (edge) return { klasse, edge }
  }
  return undefined
}

/** Das Target der Ort-Kante, oder `null`. */
export function placeTargetOf(item: Item): string | null {
  const found = placeEdgeOf(item)
  if (!found) return null
  return item.relations?.find((r) => r.predicate === found.edge.predicate)?.target ?? null
}

/** Die Id, unter der das Ort-Item nachzuschlagen ist — ob es gemeint ist, sagt {@link resolvePlaceOf}. */
export function placeLookupId(item: Item): string | null {
  return targetItemId(placeTargetOf(item))
}

/** Space eines Items, wie der Connector ihn kennt; ohne Gruppen-Capability `undefined`. */
export function spaceOfConnector(connector: DataInterface | null): SpaceOf | undefined {
  return connector && hasItemGroups(connector) ? (id) => connector.getItemGroupId(id) : undefined
}

/** Das Ort-Item, auf das das Item zeigt, aus den Kandidaten — über den Auflöser. */
export function resolvePlaceOf(item: Item, candidates: Iterable<Item> | ReadonlyMap<string, Item>, spaceOf?: SpaceOf): Item | undefined {
  const found = placeEdgeOf(item)
  if (!found) return undefined
  const target = item.relations?.find((r) => r.predicate === found.edge.predicate)?.target
  if (!target) return undefined
  const otherKind = targetFilter(otherKindOf(found.klasse, found.edge)).type as string | undefined
  return resolveTarget(target, candidates, { carrierSpace: spaceOf ? spaceOf(item.id) : null, spaceOf, otherKind })
}

/** Das Ort-Item eines Items, lebend (ein Abo auf genau dieses Item). */
export function useItemPlace(item: Item | null | undefined): Item | undefined {
  const connector = useConnector()
  const id = item ? placeLookupId(item) : null
  const { data: place } = useItem(id ?? "")
  return useMemo(
    () => (item && place ? resolvePlaceOf(item, [place], spaceOfConnector(connector)) : undefined),
    [connector, item, place],
  )
}
