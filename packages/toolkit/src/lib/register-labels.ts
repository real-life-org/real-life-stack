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
 *   Optionen), nicht
 *   über ihre Position: `type.event.label`, `type.task.fields.status.options.todo.label`,
 *   `type.event.edges.invited.from.add`, `type.task.composer.submitLabel`.
 *
 * Eine App übersetzt ihre eigenen Einträge über `extendMessages` unter denselben Schlüsseln.
 */
import { hasMessage, type I18n } from "@/i18n"

/** Der Text unter `key`, wenn das Wörterbuch ihn kennt, sonst `fallback`. */
export function registerText(i18n: I18n, key: string, fallback: string): string {
  return hasMessage(key) ? i18n.tDynamic(key) : fallback
}

/** Die Beschriftung eines Moduls in der Sprache der Oberfläche. */
export function moduleLabel(i18n: I18n, entry: { id: string; label: string }): string {
  return registerText(i18n, `module.${entry.id}.label`, entry.label)
}

/** Die Kennung, unter der ein Listeneintrag im Schlüssel steht. */
const IDENTITY = ["key", "predicate", "value", "id"] as const

function segmentOf(item: unknown, index: number): string {
  if (item && typeof item === "object") {
    // Eine Kante ist erst mit ihrer Rolle eindeutig: dasselbe Prädikat steht eingehend und ausgehend
    // („Braucht" und „Ermöglicht" an `blocks`).
    const { predicate, itemRole } = item as Record<string, unknown>
    if (typeof predicate === "string" && typeof itemRole === "string") return `${predicate}.${itemRole}`
    for (const prop of IDENTITY) {
      const value = (item as Record<string, unknown>)[prop]
      if (typeof value === "string" && value !== "") return value
    }
  }
  return String(index)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Ersetzt in einem Register-Eintrag jeden Text, für den `<prefix>.<Pfad>` im Wörterbuch steht.
 * Alles andere (Komponenten, Funktionen, Kennungen, Texte ohne Schlüssel) bleibt, wie es ist; ein
 * Eintrag ohne einen einzigen Schlüssel kommt unverändert (dasselbe Objekt) zurück.
 */
export function localizeRegisterEntry<T>(i18n: I18n, prefix: string, entry: T): T {
  const walk = (value: unknown, path: string): unknown => {
    if (typeof value === "string") return hasMessage(path) ? i18n.tDynamic(path) : value
    if (Array.isArray(value)) {
      let changed = false
      const next = value.map((item, index) => {
        const out = walk(item, `${path}.${segmentOf(item, index)}`)
        if (out !== item) changed = true
        return out
      })
      return changed ? next : value
    }
    if (isPlainObject(value)) {
      let changed = false
      const next: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value)) {
        const out = walk(item, `${path}.${key}`)
        if (out !== item) changed = true
        next[key] = out
      }
      return changed ? next : value
    }
    return value
  }
  return walk(entry, prefix) as T
}
