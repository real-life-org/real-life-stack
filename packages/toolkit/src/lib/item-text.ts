import type { Item } from "@real-life-stack/data-interface"

/**
 * Wie ein Item heißt, wenn eine Fläche es in einer Zeile nennen muss.
 *
 * Die Reihenfolge stand an vier Stellen im Monorepo, mit zwei verschiedenen
 * Abfolgen und zwei verschiedenen Rückfallwerten („Ohne Titel" hier, die rohe
 * Id dort). Dieselbe Aufgabe an einer Stelle: `title` ist das Feld des
 * Datenvertrags, `displayName` und `name` sind die Namen, die Personenprofile
 * und Spaces mitbringen.
 */
export function itemTitle(item: Item, fallback = "Ohne Titel"): string {
  const d = item.data as Record<string, unknown>
  for (const key of ["title", "displayName", "name"] as const) {
    const value = d[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return fallback
}

/**
 * Der freie Text eines Items: `content` bei Beiträgen, `description` sonst.
 * Welches Feld ein Typ benutzt, sagt die Composer-Abbildung; hier wird beides
 * gelesen, weil eine Anzeige nicht wissen muss, welcher Typ vorliegt.
 */
export function itemText(item: Item): string | undefined {
  const d = item.data as Record<string, unknown>
  for (const key of ["content", "description"] as const) {
    const value = d[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return undefined
}

/**
 * „Bearbeitet von X am Y", oder nichts, wenn das Item nie geändert wurde.
 *
 * Stand wörtlich doppelt in `ItemDetailBody` und `ItemPreview`. Die Auflösung
 * der Kennung bleibt draußen, weil sie ein Hook ist: die Fläche reicht
 * `useUserNameResolver()` herein.
 */
export function editedLabel(item: Item, resolveName: (id: string) => string): string | undefined {
  if (!item.updatedAt) return undefined
  return `Bearbeitet von ${resolveName(item.updatedBy ?? item.createdBy)} am ${new Date(item.updatedAt).toLocaleString("de-DE")}`
}
