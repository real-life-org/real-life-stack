/**
 * Die normativen Schlüsselformen aus Spec 09 §Ablage und Registry. Sie stehen
 * hier als Funktionen, damit keine Stelle sie von Hand zusammensetzt: die
 * JSON-Array-Form ist kein Schmuck, sondern verhindert, dass `("a", "bc")` und
 * `("ab", "c")` denselben Schlüssel ergeben.
 */

/** Schlüssel der `mirrors`-Map im ZIEL-Space: `JSON.stringify([homeSpaceId, itemId])`. */
export function mirrorMapKey(homeSpaceId: string, itemId: string): string {
  return JSON.stringify([homeSpaceId, itemId])
}

export function parseMirrorMapKey(key: string): { homeSpaceId: string; itemId: string } | null {
  const parsed = parsePair(key)
  return parsed ? { homeSpaceId: parsed[0], itemId: parsed[1] } : null
}

/** Schlüssel der `mirrorRegistry`-Map im HOME-Doc: `JSON.stringify([itemId, targetSpaceId])`. */
export function mirrorRegistryKey(itemId: string, targetSpaceId: string): string {
  return JSON.stringify([itemId, targetSpaceId])
}

export function parseMirrorRegistryKey(key: string): { itemId: string; targetSpaceId: string } | null {
  const parsed = parsePair(key)
  return parsed ? { itemId: parsed[0], targetSpaceId: parsed[1] } : null
}

function parsePair(key: string): [string, string] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(key)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) return null
  const [first, second] = parsed
  if (typeof first !== "string" || typeof second !== "string") return null
  return [first, second]
}
