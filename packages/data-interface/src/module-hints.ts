// Modul-Hinweise — die offene Tabelle Hinweis ↔ Item ↔ Filter.
//
// Spec 01 „Der Ladevertrag" (rls#411) und Spec 06 „Die Rolle von type":
// Ein Hinweis ist ein Feld ODER eine Klasse mit deklarierter Affordanz, und
// beide Richtungen — Item → Hinweis (Routing, Benachrichtigungen) und
// Hinweis → Connector-Filter (der Host lädt) — kommen aus DERSELBEN Tabelle.
// Getrennt gepflegt driften sie: `hasStatus` prüfte zuerst den Typ, die
// Fläche filterte das Feld, und ein Task ohne Status wurde in ein Kanban
// geleitet, das ihn nicht zeigte.
//
// Die Tabelle ist OFFEN (Spec 01, Ladevertrag Punkt 1): Ein Modul, das ein
// Feld darstellt, das das Toolkit nicht kennt — aus einem Marktplatz oder
// eine App-eigene Fläche — trägt seinen Hinweis mit beiden Richtungen ein.

import type { Item, ItemFilter } from "./index.js"
import { itemTypes, typesWithAffordance } from "./type-manifest.js"

/** Konfiguration, die in den Ladevertrag eingeht (Spec 01, Eintrag `options`). */
export interface ModuleHintOptions {
  /** Welches Feld die Kanban-Spalte trägt. Standard `status`. */
  statusField?: string
}

export interface ModuleHintDefinition {
  /**
   * Schlüssel im Hinweis-Objekt. Die vier Toolkit-Hinweise heißen aus
   * Kompatibilität `hasPosition` … `hasStatement` — sie stehen persistiert in
   * Aktivitätseinträgen. Ein eigener Hinweis heißt ohne Angabe wie er selbst.
   */
  key?: string
  /** Item → Hinweis: Würde ein Modul mit diesem Hinweis das Item zeigen? */
  test(item: Item, options: ModuleHintOptions): boolean
  /** Hinweis → Filter: Wie lädt der Host die Items für diesen Hinweis? */
  filter(options: ModuleHintOptions): ItemFilter
}

/** Die persistierte Form. Offen für eigene Hinweise (Spec 01, Ladevertrag). */
export interface ModuleHints {
  hasPosition: boolean
  hasStart: boolean
  hasStatus: boolean
  hasStatement?: boolean
  [hint: string]: boolean | undefined
}

const KANBAN_STATUSES = new Set(["open", "in-progress", "done", "archived"])

const tabelle = new Map<string, Required<ModuleHintDefinition>>()

/**
 * Einen Hinweis eintragen — beide Richtungen zugleich, damit sie nicht
 * getrennt gepflegt werden können. Ein bereits vergebener Name ist ein
 * Konflikt (wie eine Modul-Id im Register), kein stilles Überschreiben.
 */
export function registerModuleHint(name: string, def: ModuleHintDefinition): void {
  if (tabelle.has(name)) {
    throw new Error(`Modul-Hinweis "${name}" ist bereits eingetragen — ein Hinweis hat genau eine Definition (Spec 01, Ladevertrag).`)
  }
  tabelle.set(name, { key: def.key ?? name, test: def.test, filter: def.filter })
}

/** Nur für Tests: die Toolkit-Zeilen bleiben, eigene fallen weg. */
export function resetModuleHints(): void {
  for (const name of [...tabelle.keys()]) if (!TOOLKIT_HINTS.has(name)) tabelle.delete(name)
}

/** Hinweis → Connector-Filter. Wirft bei einem unbekannten Namen, statt still nichts zu laden. */
export function filterForHint(name: string, options: ModuleHintOptions = {}): ItemFilter {
  const def = tabelle.get(name)
  if (!def) {
    throw new Error(`Modul-Hinweis "${name}" ist unbekannt — ein Registereintrag mit \`presents: ["${name}"]\` braucht eine Zeile in der Hinweis-Tabelle (registerModuleHint).`)
  }
  return def.filter(options)
}

/**
 * Item → Hinweise. Persistierte Hinweise (aus einem Aktivitätseintrag) gehen
 * unverändert durch; ein Item wird gegen jede Zeile der Tabelle geprüft.
 */
export function moduleHintsFor(itemOrHints: Item | ModuleHints, options: ModuleHintOptions = {}): ModuleHints {
  if ("hasPosition" in itemOrHints) return itemOrHints as ModuleHints
  const item = itemOrHints as Item
  const hints: Record<string, boolean> = {}
  for (const def of tabelle.values()) hints[def.key] = def.test(item, options)
  return hints as unknown as ModuleHints
}

// ---------- die Toolkit-Zeilen ----------

registerModuleHint("position", {
  key: "hasPosition",
  test: (item) => Array.isArray((item.data?.position as { coordinates?: unknown } | undefined)?.coordinates),
  filter: () => ({ hasField: ["position"] }),
})

registerModuleHint("start", {
  key: "hasStart",
  test: (item) => typeof item.data?.start === "string" && item.data.start.length > 0,
  filter: () => ({ hasField: ["start"] }),
})

registerModuleHint("status", {
  key: "hasStatus",
  // Das Feld entscheidet, nie der Typ (Spec 06). Grob lädt der Connector die
  // Präsenz; ob der Wert einer Spalte entspricht, ist die feine Prüfung des
  // Moduls — der Hinweis nimmt sie mit, weil er „würde es das zeigen?" fragt.
  test: (item, o) => {
    const wert = item.data?.[o.statusField ?? "status"]
    return typeof wert === "string" && KANBAN_STATUSES.has(wert)
  },
  filter: (o) => ({ hasField: [o.statusField ?? "status"] }),
})

registerModuleHint("statement", {
  key: "hasStatement",
  // Eine Klasse aktiviert das Modul, dessen Affordanz sie deklariert: Eine
  // Aussage nimmt Stellungnahmen entgegen (votesOn, eingehend). Über ALLE
  // Klassen des Items, ungeordnet (Spec 06, Regel 8) — und über die
  // Identität, nicht die Schreibweise (Regel 6).
  test: (item) => {
    const klassen = typesWithAffordance("votesOn", "to")
    return itemTypes(item).some((t) => klassen.includes(t))
  },
  filter: () => ({ type: [...typesWithAffordance("votesOn", "to")] }),
})

const TOOLKIT_HINTS = new Set(tabelle.keys())
