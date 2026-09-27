// Feld- und Kantenregister — die Feld- und Kantenliste je Typ im
// Darstellungs-Register.
//
// Spec: docs/spec/06-schema-composition.md → „Feld- und Kantenregister"
// (S0, rls#506), docs/spec/modules/shared-components.md → „Item-Detail aus
// dem Register".
//
// Diese Datei ist React-frei: die Einträge, ihre Prüfung beim Registrieren
// und die Ableitungen, die Meta-Box und Composer daraus ziehen. Gerendert
// wird in `register-meta.tsx`, zusammengesetzt in `type-presentation.tsx`.

import {
  relationAffordanceKey,
  type ComposedTypeManifest,
  type RelationRole,
} from "@real-life-stack/data-interface"

/** Ein Widget je Datentyp, nicht je Fachfeld (B1–B15). */
export type WidgetId =
  | "title"
  | "text"
  | "date"
  | "location"
  | "media"
  | "status"
  | "number"
  | "select"
  | "url"
  | "chips"
  | "avatar"
  | "contact"
  | "group"
  | "tags"
  | "item-ref"

export interface FieldOption {
  id: string
  label: string
  tone?: string
}

export interface FieldEntry {
  /** data-Schlüssel, z. B. "start", "hours". */
  key: string
  widget: WidgetId
  pos: "head" | "meta" | "content" | "tags" | "badge" | "system" | "module"
  /** Beschriftung. Die Spec nennt einen Intl-Schlüssel; das Toolkit hat noch
   *  keine Intl-Schicht für eigene Texte, also steht hier der Anzeigetext. */
  label?: string
  required?: boolean
  /** Einheit (number, B7). */
  unit?: string
  /** Werte (status B6, select B8). */
  options?: readonly FieldOption[]
  /** `false`: nie im Formular; `"fixed"`: sichtbar, nicht bearbeitbar. */
  edit?: false | "fixed"
  /** Nur `item-ref` (B15): Zieltyp und Text für ein fehlendes Ziel. */
  ref?: { type: string; missing: string }
}

export type EdgeWidgetId =
  | "people"
  | "item-relation"
  | "membership"
  | "vote"
  | "origin"
  | "confirmations"
  | "activity"

export interface EdgeEntry {
  /** Zusammen mit `itemRole` der Schlüssel einer Manifest-Kante (Regel 1). */
  predicate: string
  itemRole: RelationRole
  storage: "embedded" | "record"
  widget: EdgeWidgetId
  pos: "meta" | "actions" | "list" | "badge"
  label: string
  qualifier?: { key: string; values: readonly FieldOption[] }
  /** Selbstaktion (C2). */
  selfAction?: { label: string; mine: string; qualifiers?: readonly string[] }
  /** Nur für `itemRole: "to"` (Rückwärts-Liste). */
  list?: { filter?: "open" | "upcoming"; sort?: string }
  /** Nur `storage: "record"` (Regel 8). */
  count?: "one-per-subject" | "collect-accepted"
}

export interface ListEntry {
  /** Name einer Abfrage, z. B. "family". */
  query: string
  label: string
  action?: { id: string; label: string }
  /** Feld-Keys, deren Herkunft die Liste zeigt. */
  covers?: readonly string[]
}

export interface MenuActionEntry {
  id: string
  label: string
}

/** Die vier Listen, die ein Darstellungseintrag tragen kann. */
export interface RegisterLists {
  fields?: readonly FieldEntry[]
  edges?: readonly EdgeEntry[]
  lists?: readonly ListEntry[]
  menuActions?: readonly MenuActionEntry[]
}

export const edgeKey = (edge: Pick<EdgeEntry, "predicate" | "itemRole">): string => relationAffordanceKey(edge)

function fail(layer: string, typeId: string, message: string): never {
  throw new Error(`Typ-Register [${layer}]: ${message} an "${typeId}" (Spec 06, Feld- und Kantenregister).`)
}

/**
 * Prüft die Listen EINES Beitrags (Definition oder Fragment) gegen das
 * Manifest. Konflikte zwischen Beiträgen prüft die Zusammensetzung.
 */
export function assertRegisterLists(
  manifest: ComposedTypeManifest,
  typeId: string,
  lists: RegisterLists,
  layer: string,
): void {
  const fieldKeys = new Set<string>()
  for (const field of lists.fields ?? []) {
    if (fieldKeys.has(field.key)) fail(layer, typeId, `Feld "${field.key}" ist doppelt`)
    fieldKeys.add(field.key)
    // Regel 11: item-ref trägt ref, und nur item-ref.
    if (field.widget === "item-ref" && !field.ref) fail(layer, typeId, `Feld "${field.key}" (item-ref) braucht ref`)
    if (field.widget !== "item-ref" && field.ref) fail(layer, typeId, `Feld "${field.key}" trägt ref, ist aber kein item-ref`)
  }

  const declared = new Set((manifest.get(typeId)?.relations ?? []).map(relationAffordanceKey))
  const edgeKeys = new Set<string>()
  for (const edge of lists.edges ?? []) {
    const key = edgeKey(edge)
    // Regel 1: jede Kante adressiert eine Manifest-Kante.
    if (!declared.has(key)) {
      fail(layer, typeId, `Kante (${edge.predicate}, ${edge.itemRole}) hat keine Manifest-Kante`)
    }
    if (edgeKeys.has(key)) fail(layer, typeId, `Kante (${edge.predicate}, ${edge.itemRole}) ist doppelt`)
    edgeKeys.add(key)
    // Regel 8: count nur an Record-Kanten; eine Record-Kante mit Qualifier braucht count.
    if (edge.count && edge.storage !== "record") {
      fail(layer, typeId, `Kante (${edge.predicate}, ${edge.itemRole}) setzt count, ist aber kein Record`)
    }
    if (edge.storage === "record" && edge.qualifier && !edge.count) {
      fail(layer, typeId, `Record-Kante (${edge.predicate}, ${edge.itemRole}) mit Qualifier braucht count`)
    }
    // Regel 10: Rückwärts-Listen sind eingehende Kanten.
    if ((edge.pos === "list" || edge.list) && edge.itemRole !== "to") {
      fail(layer, typeId, `Kante (${edge.predicate}, ${edge.itemRole}) steht als list, ist aber nicht itemRole "to"`)
    }
  }

  const queries = new Set<string>()
  for (const list of lists.lists ?? []) {
    if (queries.has(list.query)) fail(layer, typeId, `Liste "${list.query}" ist doppelt`)
    queries.add(list.query)
  }
  const actions = new Set<string>()
  for (const action of lists.menuActions ?? []) {
    if (actions.has(action.id)) fail(layer, typeId, `Menüaktion "${action.id}" ist doppelt`)
    actions.add(action.id)
  }
}

/**
 * Vereinigt die Listen eines Fragments mit der Basis (Spec 06, Erweiterung
 * und Merge): neue Keys kommen hinten dazu, ein vorhandener Key ist ein
 * Konflikt.
 */
export function uniteRegisterLists(base: RegisterLists, fragment: RegisterLists, typeId: string, layer: string): RegisterLists {
  const unite = <T>(a: readonly T[] | undefined, b: readonly T[] | undefined, key: (x: T) => string, what: string) => {
    if (!b || b.length === 0) return a
    const seen = new Set((a ?? []).map(key))
    for (const x of b) {
      if (seen.has(key(x))) fail(layer, typeId, `Fragment definiert ${what} "${key(x)}" um`)
      seen.add(key(x))
    }
    return [...(a ?? []), ...b]
  }
  return {
    fields: unite(base.fields, fragment.fields, (x) => x.key, "Feld"),
    edges: unite(base.edges, fragment.edges, edgeKey, "Kante"),
    lists: unite(base.lists, fragment.lists, (x) => x.query, "Liste"),
    menuActions: unite(base.menuActions, fragment.menuActions, (x) => x.id, "Menüaktion"),
  }
}

export function hasRegisterLists(entry: RegisterLists): boolean {
  return (entry.fields?.length ?? 0) > 0 || (entry.edges?.length ?? 0) > 0
}

// ---------------------------------------------------------------------------
// Meta-Box

export type MetaRow =
  | { kind: "field"; entry: FieldEntry }
  | { kind: "edge"; entry: EdgeEntry }

/** Gruppe einer Meta-Zeile: Menschen → Zeit → Ort → Item-Kanten → Werte. */
function metaGroup(row: MetaRow): number {
  if (row.kind === "edge") {
    if (row.entry.widget === "people" || row.entry.widget === "membership") return 0
    if (row.entry.widget === "item-relation") return 3
    return 4
  }
  switch (row.entry.widget) {
    case "date":
      return 1
    case "location":
      return 2
    case "item-ref":
      return 3
    default:
      return 4
  }
}

/**
 * Die Zeilen der Meta-Box in ihrer Reihenfolge (shared-components,
 * Detail-Anatomie, Regel 3): Menschen → Zeit → Ort → Item-Kanten → Werte,
 * innerhalb einer Gruppe in Register-Reihenfolge. Nur `pos: "meta"`.
 */
export function metaRowOrder(fields: readonly FieldEntry[] = [], edges: readonly EdgeEntry[] = []): MetaRow[] {
  const rows: MetaRow[] = [
    ...edges.filter((e) => e.pos === "meta").map((entry) => ({ kind: "edge" as const, entry })),
    ...fields.filter((x) => x.pos === "meta").map((entry) => ({ kind: "field" as const, entry })),
  ]
  // Stabil sortiert: gleiche Gruppe behält die Register-Reihenfolge.
  return rows
    .map((row, index) => ({ row, index, group: metaGroup(row) }))
    .sort((a, b) => a.group - b.group || a.index - b.index)
    .map(({ row }) => row)
}

/**
 * Leseformen für Widgets, die der Composer JEDEM Typ zum Zuschalten anbietet
 * (Datum, Ort). Ein Item kann diese Werte tragen, ohne dass sein Typ sie
 * deklariert; die Paar-Regel (shared-components, Widget-Paare) verlangt dann
 * trotzdem eine Leseform. Nur für die Meta-Box — die Composer-Defaults
 * bleiben, wie der Typ sie deklariert.
 */
const SWITCHABLE_READERS: readonly FieldEntry[] = [
  { key: "start", widget: "date", pos: "meta" },
  { key: "address", widget: "location", pos: "meta" },
]

/** Die Felder, die die Meta-Box liest: die deklarierten plus die zuschaltbaren, die der Typ nicht selbst führt. */
export function readableFields(fields: readonly FieldEntry[] = []): FieldEntry[] {
  return [...fields, ...SWITCHABLE_READERS.filter((r) => !fields.some((f) => f.widget === r.widget))]
}

// ---------------------------------------------------------------------------
// Composer (Spec 06, Regel 16)

/**
 * Slots, deren Felder im Formular stehen, in der Reihenfolge des FORMULARS
 * (shared-components, Edit-Regeln 2; Anton 27.09.2026): Titel → Beschreibung
 * → Meta-Felder → Tags. Das Badge (Space) steht im Kopf des Formulars. Lesen
 * bleibt Titel → Meta-Box → Beschreibung: Titel und Text schreibt man in
 * einem Zug, beim Lesen stehen die Fakten zuerst.
 */
const FORM_POSITIONS = ["head", "content", "meta", "tags", "badge"] as const

/**
 * Kanten-Widgets mit Schreibform im Formular (shared-components, Widget-Paare):
 * `people` (C1) und `item-relation` (C3). `vote` schreibt als Selbstaktion,
 * `membership` und `origin` stehen nie im Formular.
 */
const FORM_EDGE_WIDGETS: ReadonlySet<EdgeWidgetId> = new Set(["people", "item-relation"])

/**
 * `defaultWidgets` aus Feldern und Kanten: `pos` head, content, meta, tags,
 * badge, ohne `edit: false`; `meta` in der Reihenfolge der Meta-Box, die
 * anderen Slots in Register-Reihenfolge. Ein Widget steht einmal, auch wenn
 * mehrere Einträge es nutzen (mehrere Personen-Kanten → ein `people`).
 */
export function composerWidgetsFromRegister(fields: readonly FieldEntry[] = [], edges: readonly EdgeEntry[] = []): string[] {
  const formFields = fields.filter((x) => x.edit !== false)
  const formEdges = edges.filter((e) => FORM_EDGE_WIDGETS.has(e.widget))
  const order: string[] = []
  const add = (widget: string) => {
    if (!order.includes(widget)) order.push(widget)
  }
  for (const pos of FORM_POSITIONS) {
    if (pos === "meta") {
      for (const row of metaRowOrder(formFields, formEdges)) add(row.entry.widget)
      continue
    }
    for (const field of formFields) if (field.pos === pos) add(field.widget)
    for (const edge of formEdges) if (edge.pos === pos) add(edge.widget)
  }
  return order
}
