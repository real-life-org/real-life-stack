"use client"

// Der Ort eines Items (B4, S4b): das Ort-Item, auf das seine Ort-Kante zeigt.
// Eine Stelle für Karte (abgeleitete Position), Fokus und Kartenvorschau;
// das Ziel bestimmt der Auflöser für Kanten-Ziele (06, Verhältnis zu
// Relations, Regel 6). Verzweigt über die Ort-Kante des Registers, nie über
// den Typ.

import { normalizeItemType, type Item } from "@real-life-stack/data-interface"

import { useConnector } from "../../hooks/connector-context"
import { carrierScope, resolveTarget, useResolvedTarget, type ScopeFor } from "../../lib/item-targets"
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

/** Der Typ der Gegenstelle der Ort-Kante laut Manifest. */
function placeKind(found: { klasse: string; edge: EdgeEntry }): string | undefined {
  return targetFilter(otherKindOf(found.klasse, found.edge)).type as string | undefined
}

/**
 * Das Ort-Item, auf das das Item zeigt, aus den Kandidaten — über den
 * Auflöser, im Kontext `scopes` (Connector oder „alle Spaces").
 */
export function resolvePlaceOf(item: Item, candidates: Iterable<Item> | ReadonlyMap<string, Item>, scopes: ScopeFor): Item | undefined {
  const found = placeEdgeOf(item)
  const target = placeTargetOf(item)
  if (!found || !target) return undefined
  return resolveTarget(target, scopes(item, { otherKind: placeKind(found) }), candidates)
}

/** Das Ort-Item eines Items, lebend (ein Abo auf genau dieses Item). */
export function useItemPlace(item: Item | null | undefined): Item | undefined {
  const connector = useConnector()
  const found = item ? placeEdgeOf(item) : undefined
  const target = item ? placeTargetOf(item) : null
  const scope = item && found ? carrierScope(connector, item, { otherKind: placeKind(found) }) : null
  return useResolvedTarget(target, scope).item
}
