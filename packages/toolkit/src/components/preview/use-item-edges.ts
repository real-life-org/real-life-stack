"use client"

// Daten der Item-Kanten (C3 `item-relation`) und der Rückwärts-Listen über
// Kanten.
//
// Spec: docs/spec/06-schema-composition.md → „Feld- und Kantenregister"
// (Regeln 1, 6, 7, 10), „Verhältnis zu Relations" (Regel 2: `otherKind`
// bindet die Target-Form); docs/spec/04 (Target-Konventionen);
// shared-components → „Item-Detail aus dem Register".

import { useMemo } from "react"
import {
  getTypeManifest,
  hasItemGroups,
  hasItemType,
  itemTypes,
  parseLocalItemTarget,
  parseQualifiedItemTarget,
  type Item,
  type ItemFilter,
} from "@real-life-stack/data-interface"

import { useItemsUnion } from "../../hooks/use-items"
import { useConnector } from "../../hooks/connector-context"
import type { EdgeEntry } from "./field-register"

/** Was am anderen Ende einer Kante steht, aus dem Manifest (06, Regel 1). */
export function otherKindOf(itemType: string | readonly string[], edge: Pick<EdgeEntry, "predicate" | "itemRole">): string | undefined {
  const manifest = getTypeManifest()
  for (const type of itemTypes({ type: itemType as string })) {
    const rel = manifest.get(type)?.relations?.find((r) => r.predicate === edge.predicate && r.itemRole === edge.itemRole)
    if (rel) return rel.otherKind
  }
  return undefined
}

/**
 * Der Filter für die Gegenstelle: ein Typ des Manifests filtert nach Typ,
 * `item` (oder Unbekanntes) nimmt alle Items.
 */
export function targetFilter(otherKind: string | undefined): ItemFilter {
  return otherKind && otherKind !== "item" && getTypeManifest().has(otherKind) ? { type: otherKind } : {}
}

/** Space eines Items, wie der Connector ihn kennt (`null`: keiner). Ohne Gruppen-Capability fehlt die Funktion. */
export type SpaceOf = (itemId: string) => string | null

/**
 * Zeigt `target` — gesetzt von einem Träger im Space `carrierSpace` — auf
 * `candidate`? Target-Konventionen aus 04: `item:<id>` ist space-lokal, also
 * nur ein Item im Space des Trägers; `space:{id}/item:<id>` nur das Item in
 * genau diesem Space. Ohne Gruppen-Capability gibt es nur einen Bereich.
 */
export function targetPointsTo(target: string, candidate: Item, carrierSpace: string | null, spaceOf?: SpaceOf): boolean {
  const local = parseLocalItemTarget(target)
  if (local !== null) return local === candidate.id && (!spaceOf || spaceOf(candidate.id) === carrierSpace)
  const qualified = parseQualifiedItemTarget(target)
  if (!qualified || qualified.itemId !== candidate.id) return false
  // Ohne Space-Auskunft lässt sich ein Space-qualifiziertes Ziel nicht prüfen.
  return !!spaceOf && spaceOf(candidate.id) === qualified.homeSpaceId
}

/** Die Item-Id eines Targets (`item:` oder `space:{id}/item:`), sonst null. */
export function targetItemId(target: string): string | null {
  return parseLocalItemTarget(target) ?? parseQualifiedItemTarget(target)?.itemId ?? null
}

export interface EdgeTarget {
  item: Item
  /** Qualifier-Wert an der Kante (`meta[qualifier.key]`), falls deklariert. */
  qualifier?: string
}

/** Kanten, deren Ziele diese Datei auflöst: eingebettete Item-Kanten. */
export function isItemEdge(edge: EdgeEntry): boolean {
  return edge.widget === "item-relation" && edge.storage === "embedded" && (edge.itemRole === "from" || edge.itemRole === "to")
}

/**
 * Die Ziele der eingebetteten Item-Kanten (C3) eines Items, je Kante,
 * aufgelöst gegen die Items der Gegenstelle im sichtbaren Bereich des
 * Connectors — eine Abfrage je Gegenstellen-Typ, nicht je Kante:
 *
 * - `itemRole: "from"`: die Targets in `item.relations` mit dem Prädikat.
 * - `itemRole: "to"`: die Items, die selbst eine Kante mit dem Prädikat auf
 *   dieses Item tragen („Braucht" = eingehendes `blocks`).
 *
 * Nicht auflösbare Ziele erscheinen nicht (keine Phantom-Knoten, 08 Regel 8).
 * Jedes Ziel einmal, in der Reihenfolge der Kanten.
 */
export function useItemEdges(item: Item, edges: readonly EdgeEntry[] | undefined): ReadonlyMap<EdgeEntry, EdgeTarget[]> {
  const itemEdges = useMemo(() => (edges ?? []).filter(isItemEdge), [edges])
  const kinds = itemEdges.map((edge) => otherKindOf(item.type, edge))
  const filters = useMemo(() => {
    const seen = new Set<string>()
    const out: ItemFilter[] = []
    for (const kind of kinds) {
      const filter = targetFilter(kind)
      const key = JSON.stringify(filter)
      if (!seen.has(key)) {
        seen.add(key)
        out.push(filter)
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kinds.join(" ")])
  const { data: candidates } = useItemsUnion(filters)
  const connector = useConnector()
  return useMemo(() => {
    const spaceOf: SpaceOf | undefined = hasItemGroups(connector) ? (id) => connector.getItemGroupId(id) : undefined
    const out = new Map<EdgeEntry, EdgeTarget[]>()
    itemEdges.forEach((edge, i) => out.set(edge, edgeTargets(item, edge, candidates, kinds[i], spaceOf)))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connector, item, itemEdges, candidates, kinds.join(" ")])
}

/** Rein: die Ziele einer Kante über eine gegebene Kandidatenmenge (siehe {@link useItemEdges}). */
export function edgeTargets(item: Item, edge: EdgeEntry, candidates: readonly Item[], otherKind?: string, spaceOf?: SpaceOf): EdgeTarget[] {
  if (edge.storage !== "embedded") return []
  // Die Gegenstelle ist, was das Manifest sagt (06, Regel 1): ein Item
  // anderen Typs ist kein Ziel dieser Kante.
  const filter = targetFilter(otherKind)
  const fits = (candidate: Item) => !filter.type || hasItemType(candidate, filter.type as string)
  const key = edge.qualifier?.key
  const qualifierOf = (meta: Record<string, unknown> | undefined) => {
    const value = key ? meta?.[key] : undefined
    return typeof value === "string" && (edge.qualifier?.values ?? []).some((v) => v.id === value)
      ? edge.qualifier!.values.find((v) => v.id === value)!.label
      : undefined
  }
  const seen = new Set<string>()
  const out: EdgeTarget[] = []
  if (edge.itemRole === "from") {
    const carrierSpace = spaceOf ? spaceOf(item.id) : null
    for (const relation of item.relations ?? []) {
      if (relation.predicate !== edge.predicate) continue
      const target = candidates.find((c) => targetPointsTo(relation.target, c, carrierSpace, spaceOf))
      if (!target || !fits(target) || target.id === item.id || seen.has(target.id)) continue
      seen.add(target.id)
      const qualifier = qualifierOf(relation.meta as Record<string, unknown> | undefined)
      out.push({ item: target, ...(qualifier ? { qualifier } : {}) })
    }
    return out
  }
  if (edge.itemRole === "to") {
    for (const candidate of candidates) {
      if (!fits(candidate) || candidate.id === item.id || seen.has(candidate.id)) continue
      const relation = (candidate.relations ?? []).find(
        (r) => r.predicate === edge.predicate && targetPointsTo(r.target, item, spaceOf ? spaceOf(candidate.id) : null, spaceOf),
      )
      if (!relation) continue
      seen.add(candidate.id)
      const qualifier = qualifierOf(relation.meta as Record<string, unknown> | undefined)
      out.push({ item: candidate, ...(qualifier ? { qualifier } : {}) })
    }
  }
  return out
}
