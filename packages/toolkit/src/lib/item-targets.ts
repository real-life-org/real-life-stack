// Der Auflöser für Kanten-Ziele — die EINZIGE Stelle im Toolkit, die ein
// Target zerlegt.
//
// Spec: docs/spec/06-schema-composition.md → „Verhältnis zu Relations",
// Regel 6; docs/spec/04-items-relations-groups-spaces.md → Target-
// Konventionen (Regeln 5, 6). `check:targets` verbietet das Zerlegen
// anderswo; Targets BAUEN (`item:${id}`) darf jeder.

import {
  hasItemType,
  parseLocalItemTarget,
  parseQualifiedItemTarget,
  type Item,
} from "@real-life-stack/data-interface"

/** Space eines Items, wie der Connector ihn kennt (`null`: keiner). Ohne Gruppen-Capability fehlt die Funktion. */
export type SpaceOf = (itemId: string) => string | null

/** Ein zerlegtes Item-Target: die Item-Id und, bei `space:{id}/item:`, der Space. */
export interface ParsedItemTarget {
  itemId: string
  /** Nur bei `space:{id}/item:`. */
  space?: string
}

/** Zerlegt ein Item-Target (`item:` oder `space:{id}/item:`); sonst `null` (auch `global:`). */
export function parseItemTarget(target: unknown): ParsedItemTarget | null {
  if (typeof target !== "string" || target === "") return null
  const local = parseLocalItemTarget(target)
  if (local !== null) return { itemId: local }
  const qualified = parseQualifiedItemTarget(target)
  return qualified ? { itemId: qualified.itemId, space: qualified.homeSpaceId } : null
}

/**
 * Die Item-Id eines Targets, OHNE Prüfung — nur zum Nachschlagen (etwa
 * `useItem(id)`); ob das Item wirklich gemeint ist, sagt {@link resolveTarget}.
 */
export function targetItemId(target: unknown): string | null {
  return parseItemTarget(target)?.itemId ?? null
}

/** Die lokale Form eines Targets (`item:<id>`), sonst `null`. */
export function isLocalItemTarget(target: unknown): boolean {
  const parsed = parseItemTarget(target)
  return !!parsed && parsed.space === undefined
}

export interface TargetContext {
  /**
   * Space des Trägers: Ein `item:`-Target ist space-lokal zu ihm (04). `null`
   * ohne Auskunft oder ohne Spaces.
   */
  carrierSpace: string | null
  /** Space eines Kandidaten; fehlt ohne Gruppen-Capability (dann gibt es nur einen Bereich). */
  spaceOf?: SpaceOf
  /**
   * Typ der Gegenstelle laut Manifest (`otherKind`); geprüft über ALLE
   * Klassen des Kandidaten (06, Regeln 8/9). `item` oder ohne Angabe: jeder Typ.
   */
  otherKind?: string
}

/**
 * Zeigt `target` auf `candidate`? Space nach 04 (`item:` nur im Space des
 * Trägers, `space:{id}/item:` nur genau dort), Typ der Gegenstelle über alle
 * Klassen.
 */
export function targetPointsTo(target: unknown, candidate: Item, ctx: TargetContext): boolean {
  const parsed = parseItemTarget(target)
  if (!parsed || parsed.itemId !== candidate.id) return false
  if (ctx.otherKind && ctx.otherKind !== "item" && !hasItemType(candidate, ctx.otherKind)) return false
  const { spaceOf } = ctx
  if (parsed.space === undefined) return !spaceOf || spaceOf(candidate.id) === ctx.carrierSpace
  // Ohne Space-Auskunft lässt sich ein Space-qualifiziertes Ziel nicht prüfen.
  return !!spaceOf && spaceOf(candidate.id) === parsed.space
}

/**
 * Das Item, das `target` meint, aus den sichtbaren Kandidaten — oder
 * `undefined`: dann gibt es kein Ziel (nicht verbunden, nicht gezeigt, nicht
 * verortet; 08, Regel 8).
 */
export function resolveTarget(
  target: unknown,
  candidates: Iterable<Item> | ReadonlyMap<string, Item>,
  ctx: TargetContext,
): Item | undefined {
  const parsed = parseItemTarget(target)
  if (!parsed) return undefined
  if (candidates instanceof Map) {
    const hit = candidates.get(parsed.itemId)
    return hit && targetPointsTo(target, hit, ctx) ? hit : undefined
  }
  for (const candidate of candidates as Iterable<Item>) {
    if (candidate.id === parsed.itemId && targetPointsTo(target, candidate, ctx)) return candidate
  }
  return undefined
}
