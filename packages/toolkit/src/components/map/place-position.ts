"use client"

// Die Position eines Items vom verknüpften Ort-Item (B4, S4b): Ein Event an
// einem Ort trägt keine eigene Position (Ort-Item ODER Adresse,
// shared-components → Widget-Paare, Regel 5). Die Karte liest sie beim
// Zeichnen vom Ort — abgeleitet, nie gespeichert. Bewegt sich der Ort, folgt
// das Event.
//
// Verzweigt über die Ort-Kante des Registers (`locationEdge`), nie über den Typ.

import { useMemo } from "react"
import { getTypeManifest, hasItemGroups, hasItemType, normalizeItemType, type Item } from "@real-life-stack/data-interface"

import { useItem, useItems } from "../../hooks/use-items"
import { useConnector } from "../../hooks/connector-context"
import { resolveTypePresentation } from "../preview/type-presentation"
import { locationEdge, otherKindOf, targetItemId, targetPointsTo, type SpaceOf } from "../preview/use-item-edges"
import { latLngFromPoint } from "../../lib/geo"

/**
 * Die Ort-Kante eines Items über ALLE seine Klassen, nicht nur die Vorlage
 * (Spec 06, Klassen-Regeln 8/9; Codex R9/1): Die erste Klasse, deren Register
 * ein Ort-Feld mit Ort-Kante führt.
 */
function placeEdgeOf(item: Item) {
  for (const klasse of normalizeItemType(item.type)) {
    const presentation = resolveTypePresentation(klasse)
    if (presentation.generic) continue
    const edge = locationEdge(klasse, presentation.fields, presentation.edges)
    if (edge) return edge
  }
  return undefined
}

/** Das Target der Ort-Kante eines Items, oder `null`. */
function placeTargetOf(item: Item): string | null {
  const edge = placeEdgeOf(item)
  if (!edge) return null
  return item.relations?.find((r) => r.predicate === edge.predicate)?.target ?? null
}

/** Die Id des Ort-Items, auf das das Item zeigt, oder `null` (ohne Prüfung). */
export function placeIdOf(item: Item): string | null {
  const target = placeTargetOf(item)
  return target ? targetItemId(target) : null
}

/**
 * Das Ort-Item aus `places`, auf das das Item wirklich zeigt: Typ der
 * Gegenstelle laut Manifest und Space nach den Target-Konventionen aus 04
 * (`item:` space-lokal, `space:{id}/item:` genau dort) — dieselbe Prüfung wie
 * bei den Item-Kanten (`edgeTargets`, Codex R8/1).
 */
function resolvePlace(item: Item, places: ReadonlyMap<string, Item>, spaceOf?: SpaceOf): Item | undefined {
  const edge = placeEdgeOf(item)
  const target = placeTargetOf(item)
  const id = target ? targetItemId(target) : null
  const place = id ? places.get(id) : undefined
  if (!edge || !target || !place) return undefined
  const kind = otherKindOf(item.type as string, edge)
  if (kind && kind !== "item" && !hasItemType(place, kind)) return undefined
  return targetPointsTo(target, place, spaceOf ? spaceOf(item.id) : null, spaceOf) ? place : undefined
}

/**
 * Eine Anzeige-Kopie mit der Position des Ortes, wenn das Item keine eigene
 * hat und sein Ort in `places` liegt; sonst das Item selbst. Das gespeicherte
 * Item bleibt unberührt.
 */
export function withPlacePosition(item: Item, places: ReadonlyMap<string, Item>, spaceOf?: SpaceOf): Item {
  if (latLngFromPoint(item.data?.position)) return item
  const position = resolvePlace(item, places, spaceOf)?.data?.position
  if (!latLngFromPoint(position)) return item
  return { ...item, data: { ...item.data, position } }
}

/** Aus `candidates` die Items, deren Ort in `places` liegt, mit abgeleiteter Position. */
export function locatedPositions(candidates: readonly Item[], places: readonly Item[], spaceOf?: SpaceOf): Item[] {
  const byId = new Map(places.map((p) => [p.id, p]))
  return candidates
    .filter((c) => !latLngFromPoint(c.data?.position))
    .map((c) => withPlacePosition(c, byId, spaceOf))
    .filter((c) => !!latLngFromPoint(c.data?.position))
}

/** Space eines Items, wie der Connector ihn kennt; ohne Gruppen-Capability `undefined`. */
function useSpaceOf(): SpaceOf | undefined {
  const connector = useConnector()
  return useMemo(() => (hasItemGroups(connector) ? (id: string) => connector.getItemGroupId(id) : undefined), [connector])
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
 * Ortes — nur die abgeleiteten, nicht die geladenen. Liest die Kandidaten
 * über ihre Typen (die mit Ort-Kante) im geöffneten Space; reaktiv über Orte
 * und Kandidaten. Die Karte führt sie neben ihrem Inventar (`derivedItems`).
 */
export function useLocatedItems(loaded: readonly Item[]): { items: Item[]; unpositioned: ReadonlySet<string> } {
  const types = typesWithPlaceEdge()
  const filter = types.length > 0 ? { type: types } : { hasField: ["__rls_no_place_edge__"] }
  const { data: candidates } = useItems(filter)
  const spaceOf = useSpaceOf()
  return useMemo(() => {
    const ids = new Set(loaded.map((i) => i.id))
    return {
      items: locatedPositions(candidates, loaded, spaceOf).filter((i) => !ids.has(i.id)),
      // Items mit Ort-Feld ohne eigene Position: ein älterer Eintrag mit
      // Position im Inventar der Karte gilt nicht mehr.
      unpositioned: new Set(candidates.filter((c) => !latLngFromPoint(c.data?.position)).map((c) => c.id)),
    }
  }, [loaded, candidates, spaceOf])
}

/**
 * Ein einzelnes Item mit abgeleiteter Position (für den Fokus der Karte):
 * liest den Ort nur, wenn das Item keine eigene Position hat.
 */
export function useItemWithPlacePosition(item: Item | null | undefined): Item | null | undefined {
  const placeId = item && !latLngFromPoint(item.data?.position) ? placeIdOf(item) : null
  const { data: place } = useItem(placeId ?? "")
  const spaceOf = useSpaceOf()
  return useMemo(() => {
    if (!item || !placeId || !place) return item
    return withPlacePosition(item, new Map([[place.id, place]]), spaceOf)
  }, [item, placeId, place, spaceOf])
}
