"use client"

// Die Position eines Items vom verknüpften Ort-Item (B4, S4b): Ein Event an
// einem Ort trägt keine eigene Position (Ort-Item ODER Adresse,
// shared-components → Widget-Paare, Regel 5). Die Karte liest sie beim
// Zeichnen vom Ort — abgeleitet, nie gespeichert (map.md → Datenmodell).
// Welcher Ort gemeint ist, sagt der Auflöser (`resolvePlaceOf`).

import { useMemo } from "react"
import { getTypeManifest, type Item } from "@real-life-stack/data-interface"

import { useItems } from "../../hooks/use-items"
import { useConnector } from "../../hooks/connector-context"
import { resolveTypePresentation } from "../preview/type-presentation"
import { locationEdge } from "../preview/use-item-edges"
import { placeEdgeOf, resolvePlaceOf, useItemPlace } from "../preview/item-place"
import { scopesFromConnector, type ScopeFor } from "../../lib/item-targets"
import { latLngFromPoint } from "../../lib/geo"

/**
 * Eine Anzeige-Kopie mit der Position des Ortes, wenn das Item keine eigene
 * hat und sein Ort unter `places` liegt; sonst das Item selbst. Das
 * gespeicherte Item bleibt unberührt.
 */
export function withPlacePosition(item: Item, places: Iterable<Item> | ReadonlyMap<string, Item>, scopes: ScopeFor): Item {
  if (latLngFromPoint(item.data?.position)) return item
  const position = resolvePlaceOf(item, places, scopes)?.data?.position
  if (!latLngFromPoint(position)) return item
  return { ...item, data: { ...item.data, position } }
}

/** Aus `candidates` die Items ohne eigene Position, deren Ort unter `places` liegt — mit dessen Position. */
export function locatedPositions(candidates: readonly Item[], places: readonly Item[], scopes: ScopeFor): Item[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  return candidates
    .filter((c) => !latLngFromPoint(c.data?.position) && !!placeEdgeOf(c))
    .map((c) => withPlacePosition(c, byId, scopes))
    .filter((c) => !!latLngFromPoint(c.data?.position))
}

/** Die Typen, die ein Ort-Feld mit Ort-Kante führen (aus Manifest und Register). */
export function typesWithPlaceEdge(): string[] {
  return getTypeManifest().ids.filter((id) => {
    const p = resolveTypePresentation(id)
    return !p.generic && !!locationEdge(id, p.fields, p.edges)
  })
}

/**
 * Die Items, die an einem der geladenen Orte liegen, mit der Position ihres
 * Ortes (nur die abgeleiteten). Eine Projektion: bei jedem Render aus den
 * lebenden Kandidaten und den geladenen Orten, ohne Puffer (map.md → Karten-
 * Inventar als Projektion).
 */
export function useLocatedItems(loaded: readonly Item[]): Item[] {
  const types = typesWithPlaceEdge()
  const filter = types.length > 0 ? { type: types } : { hasField: ["__rls_no_place_edge__"] }
  const { data: candidates } = useItems(filter)
  const connector = useConnector()
  return useMemo(() => {
    const ids = new Set(loaded.map((i) => i.id))
    return locatedPositions(candidates, loaded, scopesFromConnector(connector)).filter((i) => !ids.has(i.id))
  }, [connector, loaded, candidates])
}

/** Ein einzelnes Item mit abgeleiteter Position (für den Fokus der Karte), lebend. */
export function useItemWithPlacePosition(item: Item | null | undefined): Item | null | undefined {
  // `useItemPlace` hat den Ort schon über den Auflöser bestimmt (mit Space
  // des Connectors); hier nur noch seine Position übernehmen.
  const place = useItemPlace(item && !latLngFromPoint(item.data?.position) ? item : null)
  return useMemo(() => {
    const position = place?.data?.position
    if (!item || !place || !latLngFromPoint(position)) return item
    return { ...item, data: { ...item.data, position } }
  }, [item, place])
}
