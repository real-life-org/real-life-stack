/**
 * Übersetzte Beschriftungen für die Register (Spec 01, Modul-Register; Spec 06, Typ-Register).
 *
 * Die Register sind Daten: Ein Eintrag bringt seine Beschriftung als `label` (und weitere Texte wie
 * `add`, `mine`, Optionen) mit, und Apps erweitern die Register um eigene Einträge. Die Anzeige holt
 * jeden dieser Texte über einen Schlüssel aus dem Wörterbuch, wenn es ihn gibt; sonst gilt der Text im
 * Register. So spricht ein Toolkit-Modul die Sprache der Oberfläche, und ein App-Eintrag ohne
 * Übersetzung bleibt lesbar.
 *
 * Schlüssel:
 * - Modul: `module.<id>.label`
 * - Typ: `type.<id>.<Pfad>`, der Pfad folgt der Struktur des Eintrags. Listen sind über die Kennung
 *   ihrer Einträge adressiert (`key` bei Feldern, `<predicate>.<itemRole>` bei Kanten, `value` bei
 *   Optionen, `query` bei Listen; ein Eintrag ohne Kennung wird nicht übersetzt), nicht
 *   über ihre Position: `type.event.label`, `type.task.fields.status.options.todo.label`,
 *   `type.event.edges.invited.from.add`, `type.task.composer.submitLabel`.
 *
 * Eine App übersetzt ihre eigenen Einträge über `extendMessages` unter denselben Schlüsseln.
 */
import type { I18n } from "@/i18n"

/** Der Text unter `key`, wenn das Wörterbuch ihn kennt, sonst `fallback`. */
export function registerText(i18n: I18n, key: string, fallback: string): string {
  return i18n.has(key) ? i18n.tDynamic(key) : fallback
}

/** Die Beschriftung eines Moduls in der Sprache der Oberfläche. */
export function moduleLabel(i18n: I18n, entry: { id: string; label: string }): string {
  return registerText(i18n, `module.${entry.id}.label`, entry.label)
}

/** Die Eigenschaften, die Text tragen. Alles andere (`key`, `widget`, `predicate` …) ist technisch und bleibt. */
const TEXT_PROPS = new Set(["label", "add", "mine", "release", "action", "submitLabel", "missing", "placeholder"])

/** Die Kennung, unter der ein Listeneintrag im Schlüssel steht. */
const IDENTITY = ["key", "value", "query", "id"] as const

/**
 * Die Kennung eines Listeneintrags — oder `null`: Ein Eintrag ohne Kennung wird nicht übersetzt. Die
 * Position taugt nicht als Adresse, weil eine weitere Schicht ihre eigenen Einträge an dieselbe Stelle
 * ihrer Liste legt und sonst die Texte des Toolkits bekäme.
 */
function segmentOf(item: unknown): string | null {
  if (!item || typeof item !== "object") return null
  // Eine Kante ist erst mit ihrer Rolle eindeutig: dasselbe Prädikat steht eingehend und ausgehend
  // („Braucht" und „Ermöglicht" an `blocks`).
  const { predicate, itemRole } = item as Record<string, unknown>
  if (typeof predicate === "string" && typeof itemRole === "string") return `${predicate}.${itemRole}`
  for (const prop of IDENTITY) {
    const value = (item as Record<string, unknown>)[prop]
    if (typeof value === "string" && value !== "") return value
  }
  return null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Ersetzt in einem Register-Eintrag jeden Text (eine der {@link TEXT_PROPS}), für den
 * `<prefix>.<Pfad>` im Wörterbuch steht. Alles andere (Komponenten, Funktionen, Kennungen, Texte ohne
 * Schlüssel, Listeneinträge ohne Kennung) bleibt, wie es ist; ein Eintrag ohne einen einzigen Schlüssel
 * kommt unverändert (dasselbe Objekt) zurück.
 */
export function localizeRegisterEntry<T>(i18n: I18n, prefix: string, entry: T): T {
  const walk = (value: unknown, path: string, prop: string | null): unknown => {
    if (typeof value === "string") return prop !== null && TEXT_PROPS.has(prop) && i18n.has(path) ? i18n.tDynamic(path) : value
    if (Array.isArray(value)) {
      let changed = false
      const next = value.map((item) => {
        const segment = segmentOf(item)
        if (segment === null) return item
        const out = walk(item, `${path}.${segment}`, null)
        if (out !== item) changed = true
        return out
      })
      return changed ? next : value
    }
    if (isPlainObject(value)) {
      let changed = false
      const next: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value)) {
        const out = walk(item, `${path}.${key}`, key)
        if (out !== item) changed = true
        next[key] = out
      }
      return changed ? next : value
    }
    return value
  }
  return walk(entry, prefix, null) as T
}
