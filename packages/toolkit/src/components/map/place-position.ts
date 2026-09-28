"use client"

// Die Position eines Items vom verknüpften Ort-Item (B4, S4b): Ein Event an
// einem Ort trägt keine eigene Position (Ort-Item ODER Adresse,
// shared-components → Widget-Paare, Regel 5). Die Karte liest sie beim
// Zeichnen vom Ort — abgeleitet, nie gespeichert. Bewegt sich der Ort, folgt
// das Event.
//
// Verzweigt über die Ort-Kante des Registers (`locationEdge`), nie über den Typ.

import { useMemo } from "react"
import { getTypeManifest, type Item } from "@real-life-stack/data-interface"

import { useItem, useItems } from "../../hooks/use-items"
import { resolveTypePresentation } from "../preview/type-presentation"
import { locationEdge, targetItemId } from "../preview/use-item-edges"
import { latLngFromPoint } from "../../lib/geo"

/** Die Ort-Kante des Typs eines Items, oder `undefined`. */
function placeEdgeOf(item: Item) {
  const presentation = resolveTypePresentation(item.type)
  return locationEdge(item.type, presentation.fields, presentation.edges)
}

/** Die Id des Ort-Items, auf das das Item zeigt, oder `null`. */
export function placeIdOf(item: Item): string | null {
  const edge = placeEdgeOf(item)
  if (!edge) return null
  const target = item.relations?.find((r) => r.predicate === edge.predicate)?.target
  return target ? targetItemId(target) : null
}

/**
 * Eine Anzeige-Kopie mit der Position des Ortes, wenn das Item keine eigene
 * hat und sein Ort in `places` liegt; sonst das Item selbst. Das gespeicherte
 * Item bleibt unberührt.
 */
export function withPlacePosition(item: Item, places: ReadonlyMap<string, Item>): Item {
  if (latLngFromPoint(item.data?.position)) return item
  const placeId = placeIdOf(item)
  const place = placeId ? places.get(placeId) : undefined
  const position = place?.data?.position
  if (!place || !latLngFromPoint(position)) return item
  return { ...item, data: { ...item.data, position } }
}

/** Aus `candidates` die Items, deren Ort in `places` liegt, mit abgeleiteter Position. */
export function locatedPositions(candidates: readonly Item[], places: readonly Item[]): Item[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  return candidates
    .filter((c) => !latLngFromPoint(c.data?.position) && (placeIdOf(c) ?? "") !== "" && byId.has(placeIdOf(c)!))
    .map((c) => withPlacePosition(c, byId))
}

/** Die Typen, die ein Ort-Feld mit Ort-Kante führen (aus Manifest und Register). */
export function typesWithPlaceEdge(): string[] {
  return getTypeManifest().ids.filter((id) => {
    const p = resolveTypePresentation(id)
    return !p.generic && !!locationEdge(id, p.fields, p.edges)
  })
}

/**
 * Die geladenen Items plus die Items, die an einem der geladenen Orte liegen,
 * mit der Position ihres Ortes. Liest die Kandidaten über ihre Typen (die mit
 * Ort-Kante) im geöffneten Space; reaktiv über die Orte und die Kandidaten.
 */
export function useItemsWithPlacePositions(loaded: readonly Item[]): Item[] {
  const types = typesWithPlaceEdge()
  const filter = types.length > 0 ? { type: types } : { hasField: ["__rls_no_place_edge__"] }
  const { data: candidates } = useItems(filter)
  return useMemo(() => {
    const ids = new Set(loaded.map((i) => i.id))
    const derived = locatedPositions(candidates, loaded).filter((i) => !ids.has(i.id))
    return derived.length > 0 ? [...loaded, ...derived] : [...loaded]
  }, [loaded, candidates])
}

/**
 * Ein einzelnes Item mit abgeleiteter Position (für den Fokus der Karte):
 * liest den Ort nur, wenn das Item keine eigene Position hat.
 */
export function useItemWithPlacePosition(item: Item | null | undefined): Item | null | undefined {
  const placeId = item && !latLngFromPoint(item.data?.position) ? placeIdOf(item) : null
  const { data: place } = useItem(placeId ?? "")
  return useMemo(() => {
    if (!item || !placeId || !place) return item
    return withPlacePosition(item, new Map([[place.id, place]]))
  }, [item, placeId, place])
}
