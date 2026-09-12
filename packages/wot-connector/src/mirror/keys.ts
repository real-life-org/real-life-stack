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
  const parsed = parseParts(key, 2)
  return parsed ? { homeSpaceId: parsed[0], itemId: parsed[1] } : null
}

/**
 * Der PHYSISCHE Schlüssel der `mirrorRegistry`-Map im HOME-Doc:
 * `JSON.stringify([itemId, targetSpaceId, deviceId])`.
 *
 * Das Gerät steht im Schlüssel, nicht in einer geschachtelten `byDevice`-Map:
 * eine Map, die zwei Geräte nebenläufig ANLEGEN müssten, ist im CRDT-Merge ein
 * Register — eine gewinnt, die andere geht samt Beitrag verloren, und ein so
 * verlorener Widerruf kippt den Freigabestatus zurück auf `accepted`. Mit dem
 * Gerät im Schlüssel legt jedes Gerät ausschließlich seinen eigenen Schlüssel
 * an, und der Merge ist konfliktfrei (Spec 09 §Ablage und Registry).
 */
export function mirrorRegistryKey(itemId: string, targetSpaceId: string, deviceId: string): string {
  return JSON.stringify([itemId, targetSpaceId, deviceId])
}

export function parseMirrorRegistryKey(
  key: string,
): { itemId: string; targetSpaceId: string; deviceId: string } | null {
  const parsed = parseParts(key, 3)
  return parsed ? { itemId: parsed[0], targetSpaceId: parsed[1], deviceId: parsed[2] } : null
}

/**
 * Der LOGISCHE Schlüssel eines Registry-Eintrags `(itemId, targetSpaceId)` —
 * die Ebene, auf der gefaltet wird (`deriveRegistryView`). Er steht nirgends
 * im Doc, er entsteht beim Lesen aus den physischen Schlüsseln
 * ({@link groupRegistryByEntry}).
 */
export function mirrorRegistryEntryKey(itemId: string, targetSpaceId: string): string {
  return JSON.stringify([itemId, targetSpaceId])
}

export function parseMirrorRegistryEntryKey(
  key: string,
): { itemId: string; targetSpaceId: string } | null {
  const parsed = parseParts(key, 2)
  return parsed ? { itemId: parsed[0], targetSpaceId: parsed[1] } : null
}

function parseParts(key: string, length: number): string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(key)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length !== length) return null
  if (!parsed.every((part): part is string => typeof part === "string")) return null
  return parsed
}
