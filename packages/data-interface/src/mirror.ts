// Mirror-Konventionen — die UI-freie Hälfte von Spec 09 (Mirror und Bridge).
//
// Spec: docs/spec/09-mirror-bridge.md (§Lesemodell beim Empfänger,
// Invariante 1 und 10) und docs/spec/04-items-relations-groups-spaces.md
// (§Target-Konventionen, Prefix `space:{id}/item:`).
//
// Der Capability-Vertrag `MirrorCapable` und sein Type Guard `hasMirrors`
// liegen bei den übrigen Capabilities in `index.ts`; hier stehen nur die
// Konventionen, die JEDER Leser eines gespiegelten Items braucht — auch
// dort, wo kein Connector im Spiel ist (Listen, Schlüsselbildung, Auflösung
// home-relativer Endpunkte).

import type { Item } from "./index.js"

/**
 * Das Prädikat, mit dem ein Connector eine Mirror-Instanz im Lesemodell
 * annotiert: `{ predicate: "mirrorOf", target: "space:{homeSpaceId}/item:{itemId}", meta: { ts } }`.
 *
 * Spec 09 §Lesemodell — die Annotation erfüllt Invariante 7 (als Schnappschuss
 * erkennbar, Herkunft als Behauptung) OHNE ein neues Item-Feld.
 */
export const MIRROR_OF_PREDICATE = "mirrorOf"

const SPACE_PREFIX = "space:"
const ITEM_SEPARATOR = "/item:"

/**
 * Die qualifizierte Einzeladressierung eines Items in seinem Home-Space:
 * `space:{homeSpaceId}/item:{itemId}` (Target-Konvention aus Spec 04).
 *
 * Spec 09 §Lesemodell: `getItem`/`observeItem` akzeptieren neben der nackten
 * `id` diese Form und liefern dann genau diese Mirror-Instanz — nötig, weil ein
 * Ziel-Space ein lokales Item `x` und Mirrors `(homeA, x)`, `(homeB, x)`
 * zugleich enthalten kann (Invariante 1).
 */
export function qualifiedItemTarget(homeSpaceId: string, itemId: string): string {
  // Eingabegrenze, damit die Form eindeutig bleibt: ohne sie ergäben
  // ("home/item:a", "b") und ("home", "a/item:b") dasselbe Target, und zwei
  // verschiedene logische Schlüssel (Invariante 1) kollidierten in einem
  // Listen-Schlüssel. Spec 04 §Target-Konventionen: Space-IDs dürfen `/item:`
  // nicht enthalten — hier durchgesetzt, statt es nur zu hoffen.
  if (!homeSpaceId) throw new Error("qualifiedItemTarget: homeSpaceId darf nicht leer sein")
  if (homeSpaceId.includes(ITEM_SEPARATOR)) {
    throw new Error(
      `qualifiedItemTarget: Space-Id darf "${ITEM_SEPARATOR}" nicht enthalten (Spec 04 §Target-Konventionen) — erhalten: "${homeSpaceId}"`,
    )
  }
  if (!itemId) throw new Error("qualifiedItemTarget: itemId darf nicht leer sein")
  return `${SPACE_PREFIX}${homeSpaceId}${ITEM_SEPARATOR}${itemId}`
}

/**
 * Zerlegt die qualifizierte Form wieder in `(homeSpaceId, itemId)`; `null`,
 * wenn `target` nicht exakt dieser Konvention folgt (`item:`-, `global:`- und
 * kaputte Targets).
 *
 * Getrennt wird am ERSTEN `/item:`. Space-IDs dürfen `/item:` nicht enthalten
 * (Spec 04 §Target-Konventionen, von {@link qualifiedItemTarget} durchgesetzt),
 * eine Item-Id dagegen schon — damit ist jedes gebaute Target eindeutig
 * umkehrbar.
 */
export function parseQualifiedItemTarget(
  target: string,
): { homeSpaceId: string; itemId: string } | null {
  if (!target.startsWith(SPACE_PREFIX)) return null
  const rest = target.slice(SPACE_PREFIX.length)
  const separator = rest.indexOf(ITEM_SEPARATOR)
  if (separator <= 0) return null
  const homeSpaceId = rest.slice(0, separator)
  const itemId = rest.slice(separator + ITEM_SEPARATOR.length)
  if (!homeSpaceId || !itemId) return null
  return { homeSpaceId, itemId }
}

function mirrorRelationTarget(item: Item): string | null {
  const relation = item.relations?.find((r) => r.predicate === MIRROR_OF_PREDICATE)
  return relation ? relation.target : null
}

/**
 * Ist dieses Item eine Mirror-Instanz — also ein read-only Schnappschuss aus
 * einem fremden Home (Spec 09 Invariante 2, §Lesemodell)? Bearbeiten öffnet
 * immer das Home.
 */
export function isMirrorItem(item: Item): boolean {
  return mirrorRelationTarget(item) !== null
}

/**
 * Die behauptete Herkunft einer Mirror-Instanz: `(homeSpaceId, itemId)`, der
 * logische Schlüssel aus Spec 09 Invariante 1. `null` für lokale Items und für
 * eine `mirrorOf`-Annotation mit unzulässigem Target.
 *
 * Herkunft ist eine BEHAUPTUNG (Invariante 5, Home-Origin-TOFU) — UI-Flächen
 * MÜSSEN sie als solche ausweisen („laut Schnappschuss aus …").
 */
export function getMirrorOrigin(item: Item): { homeSpaceId: string; itemId: string } | null {
  const target = mirrorRelationTarget(item)
  return target ? parseQualifiedItemTarget(target) : null
}

/**
 * Der Schlüssel, unter dem eine Fläche eine Item-Instanz führt:
 * `mirrorOf.target ?? id`.
 *
 * Spec 09 §Lesemodell: „Flächen MÜSSEN als Schlüssel `mirrorOf.target ?? id`
 * verwenden, nie `id` allein" — sonst kollabieren das lokale Item `x` und die
 * Mirrors `(homeA, x)`, `(homeB, x)` in einen Eintrag (Invariante 1).
 */
export function itemInstanceKey(item: Item): string {
  return mirrorRelationTarget(item) ?? item.id
}
