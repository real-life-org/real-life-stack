// Typ-Manifest — the UI-free half of the canonical type register.
//
// Spec: docs/spec/06-schema-composition.md → "Typ-Register".
//
// One entry per `type`, single source of type IDENTITY. The toolkit's
// presentation register attaches display concerns (label, icon, slots) to
// these ids and MUST NOT introduce types of its own. `KnownItemType` in
// item-types.ts derives its core members from this manifest instead of
// maintaining a parallel list.
//
// Composition follows the spec's "Erweiterung und Merge" rules: layers are
// composed Core → App → Space; a layer contributes either *definitions*
// (new ids) or *extension fragments* (additive changes to existing ids).
// Conflicts throw — there is no override in v0.1, silent or otherwise.

import {
  VOCAB_BASE,
  VOCAB_STATEMENT,
  VOCAB_EVENT,
  VOCAB_PERSON,
  VOCAB_PLACE,
  VOCAB_PROJECT,
  VOCAB_RESOURCE,
  VOCAB_TASK,
} from "./vocab"

/** Which role THIS item plays on an edge. `either` is for symmetric
 *  predicates only (08 canonicalizes their endpoints — there is no direction). */
export type RelationRole = "from" | "to" | "either"

/**
 * A relation affordance: an edge this type can enter, keyed by
 * (`predicate`, `itemRole`). Both roles of the same predicate may coexist on
 * one type (a task blocks and is blocked); `either` excludes `from`/`to` for
 * the same predicate. This is a Composer/UI affordance, NOT a validity
 * whitelist — predicates stay open (spec 04).
 */
export interface RelationAffordance {
  predicate: string
  itemRole: RelationRole
  /** What sits at the other endpoint (`person`, `place`, `item`, …). Binds the
   *  persisted target form: `person` → `global:`, item-like → `item:`/`space:`. */
  otherKind: string
}

/** One type in the manifest. UI-free by contract — display lives in toolkit. */
export interface TypeManifestEntry {
  /** Stable type identity; doubles as the localization key. */
  id: string
  /**
   * Die IRI der Klasse (Spec 06, „Klassen haben IRIs"). `type` ist per
   * base/v1 ein Alias für `@type`; diese IRI ist die Identität, der Kurzname
   * `id` die kanonische Schreibweise im Stack. Ohne Angabe abgeleitet:
   * `<erstes Vokabular oder base/v1>#<Id mit großem Anfangsbuchstaben>`.
   */
  classIri?: string
  /** Vocabularies the composer sets when creating an item of this type.
   *  `base/v1` is always implied and need not be listed. */
  vocabularies: readonly string[]
  /** Edges this type can enter, keyed by (predicate, itemRole). */
  relations?: readonly RelationAffordance[]
}

/** Additive change to an EXISTING type (spec: Erweiterungsfragment). */
export interface TypeManifestFragment {
  /** Must address an id introduced by an earlier layer — unknown id = conflict. */
  id: string
  /** United as a set; re-adding an existing vocabulary is a no-op. */
  vocabularies?: readonly string[]
  /** United keyed by (predicate, itemRole); an existing key = conflict. */
  relations?: readonly RelationAffordance[]
}

/** One composition layer (Core, App, or Space). */
export interface TypeManifestLayer {
  /** For conflict messages ("app", "space:garden", …). */
  name: string
  definitions?: readonly TypeManifestEntry[]
  extensions?: readonly TypeManifestFragment[]
}

/**
 * Canonical key of a relation affordance — THE key format, used by the
 * manifest, the presentation register's `relationWidgets`, and every
 * consumer deriving from them. Exported so the format exists exactly once.
 */
export const relationAffordanceKey = (
  r: Pick<RelationAffordance, "predicate" | "itemRole">,
): string => `${r.predicate} ${r.itemRole}`

const relationKey = relationAffordanceKey

/**
 * Add affordances onto a keyed map, enforcing the spec's key and symmetry
 * rules. Order-independent by construction: outcome depends only on the set
 * of (key → value) pairs, and any duplicate or contradictory pair throws.
 */
function addRelations(
  target: Map<string, RelationAffordance>,
  incoming: readonly RelationAffordance[],
  typeId: string,
  layer: string,
): void {
  for (const rel of incoming) {
    const key = relationKey(rel)
    if (target.has(key)) {
      throw new Error(
        `Typ-Manifest [${layer}]: Kante (${rel.predicate}, ${rel.itemRole}) ist an "${typeId}" bereits vergeben — Umdefinieren ist ein Konflikt (Spec 06, Erweiterung und Merge).`,
      )
    }
    // `either` and directed roles are mutually exclusive per predicate: the
    // manifest must match the predicate's symmetry declaration (08, rule 3).
    const clash =
      rel.itemRole === "either"
        ? ["from", "to"].some((role) => target.has(relationKey({ predicate: rel.predicate, itemRole: role as RelationRole })))
        : target.has(relationKey({ predicate: rel.predicate, itemRole: "either" }))
    if (clash) {
      throw new Error(
        `Typ-Manifest [${layer}]: "${rel.predicate}" an "${typeId}" mischt "either" mit gerichteten Rollen — die Symmetrie eines Prädikats ist eindeutig (Spec 06/08).`,
      )
    }
    target.set(key, rel)
  }
}

/** A composed, immutable view of the manifest. */
export interface ComposedTypeManifest {
  /** All type ids, in layer/definition order (deterministic). */
  ids: readonly string[]
  get(id: string): TypeManifestEntry | undefined
  has(id: string): boolean
}

/**
 * Compose manifest layers (Core → App → Space) into one deterministic view.
 *
 * Spec rules enforced here:
 * - a definition with an already-taken id is a conflict,
 * - a fragment addressing an unknown id is a conflict,
 * - relation keys (predicate, itemRole) are add-only; vocabularies unite as a set,
 * - no override in v0.1: conflicts throw, they are never resolved silently.
 */
export function composeTypeManifest(
  layers: readonly TypeManifestLayer[],
): ComposedTypeManifest {
  const entries = new Map<string, { vocabularies: Set<string>; relations: Map<string, RelationAffordance>; classIri?: string }>()
  const order: string[] = []

  for (const layer of layers) {
    for (const def of layer.definitions ?? []) {
      if (entries.has(def.id)) {
        throw new Error(
          `Typ-Manifest [${layer.name}]: Typ-Id "${def.id}" ist bereits vergeben — eine Typdefinition führt eine NEUE Id ein; Erweiterungen sind Fragmente (Spec 06, Erweiterung und Merge).`,
        )
      }
      const relations = new Map<string, RelationAffordance>()
      addRelations(relations, def.relations ?? [], def.id, layer.name)
      entries.set(def.id, { vocabularies: new Set(def.vocabularies), relations, classIri: def.classIri })
      order.push(def.id)
    }
    for (const frag of layer.extensions ?? []) {
      const base = entries.get(frag.id)
      if (!base) {
        throw new Error(
          `Typ-Manifest [${layer.name}]: Fragment adressiert unbekannte Typ-Id "${frag.id}" — Fragmente erweitern vorhandene Typen (Spec 06, Erweiterung und Merge).`,
        )
      }
      for (const vocab of frag.vocabularies ?? []) base.vocabularies.add(vocab)
      addRelations(base.relations, frag.relations ?? [], frag.id, layer.name)
    }
  }

  const frozen = new Map<string, TypeManifestEntry>()
  for (const id of order) {
    const e = entries.get(id)!
    frozen.set(id, {
      id,
      classIri: e.classIri ?? defaultClassIri(id, [...e.vocabularies]),
      vocabularies: [...e.vocabularies],
      relations: [...e.relations.values()],
    })
  }
  return {
    ids: order,
    get: (id) => frozen.get(id),
    has: (id) => frozen.has(id),
  }
}

/**
 * `statement` ships its DATA types (StatementItem, votes) from this package.
 * Since 21.09.2026 it is a Toolkit-Typ like the other seven (Spec 06): the
 * toolkit delivers the Resonance module complete, so its type comes with it.
 * Exported on its own because KnownItemType derives the literal from it.
 *
 * Its class carries the affordance that activates the Resonance module:
 * a statement takes stances (`votesOn`, incoming). That — not a marker
 * vocabulary in `@context` — is what makes it a statement.
 */
export const STATEMENT_TYPE_DEFINITION = {
  id: "statement",
  vocabularies: [VOCAB_STATEMENT],
  relations: [{ predicate: "votesOn", itemRole: "to", otherKind: "person" }],
} as const satisfies TypeManifestEntry

/**
 * The toolkit's manifest: the eight types the toolkit ships (spec 06,
 * "Toolkit-Typ"; until 21.09.2026 "Core-Typ" — RLS has no core). System
 * types (`relation`, `reaction`, `comment`) have no entry by design — they
 * never render as standalone cards.
 *
 * `base/v1` is implied for every type and not listed.
 */
export const TOOLKIT_TYPE_MANIFEST = [
  { id: "post", vocabularies: [] },
  {
    id: "event",
    vocabularies: [VOCAB_EVENT],
    // Declared ahead of the composer widget (see content-types.ts history):
    // attendees link via `invited`, never `assignedTo`.
    relations: [{ predicate: "invited", itemRole: "from", otherKind: "person" }],
  },
  { id: "place", vocabularies: [VOCAB_PLACE] },
  {
    id: "task",
    vocabularies: [VOCAB_TASK],
    relations: [{ predicate: "assignedTo", itemRole: "from", otherKind: "person" }],
  },
  { id: "person", vocabularies: [VOCAB_PERSON] },
  { id: "project", vocabularies: [VOCAB_PROJECT] },
  { id: "resource", vocabularies: [VOCAB_RESOURCE] },
  STATEMENT_TYPE_DEFINITION,
] as const satisfies readonly TypeManifestEntry[]

/** Toolkit type ids, derived from the manifest — never maintained as a list. */
export type ToolkitItemTypeId = (typeof TOOLKIT_TYPE_MANIFEST)[number]["id"]

/** The toolkit's definition, ready for {@link composeTypeManifest}. */
export const TOOLKIT_TYPE_LAYER: TypeManifestLayer = {
  name: "toolkit",
  definitions: TOOLKIT_TYPE_MANIFEST,
}

/** Default class IRI: first vocabulary (or base/v1) plus the capitalised id. */
function defaultClassIri(id: string, vocabularies: readonly string[]): string {
  const vocab = vocabularies[0] ?? VOCAB_BASE
  return `${vocab}#${id.charAt(0).toUpperCase()}${id.slice(1)}`
}

// ============================================================
// Das gebundene Manifest
// ============================================================
//
// Hinweise (module-hints.ts) und Filter (base-connector.ts) brauchen das
// Manifest zur Laufzeit: Welche Klassen deklarieren eine Affordanz, welche
// IRI gehört zu welchem Kurznamen. Das Toolkit bindet dasselbe Manifest für
// seine Darstellung; eine App komponiert einmal und bindet über das Toolkit.

let gebunden: ComposedTypeManifest = composeTypeManifest([TOOLKIT_TYPE_LAYER])

/** Bind the composed manifest (call once at startup, before first render). */
export function setTypeManifest(next: ComposedTypeManifest): void {
  gebunden = next
}

/** The manifest currently bound — the toolkit's own until an app binds a composition. */
export function getTypeManifest(): ComposedTypeManifest {
  return gebunden
}

/** Type ids whose manifest entry declares this affordance (Spec 06, „Die Rolle von type"). */
export function typesWithAffordance(predicate: string, itemRole?: RelationRole): readonly string[] {
  const m = getTypeManifest()
  return m.ids.filter((id) =>
    (m.get(id)?.relations ?? []).some((r) => r.predicate === predicate && (itemRole === undefined || r.itemRole === itemRole)),
  )
}

// ============================================================
// Klassen: Identität ist die IRI, kanonisch ist der Kurzname (Spec 06, Regeln 6–10)
// ============================================================

/**
 * Normalise a `type` value — string or unordered set, short names or full
 * IRIs — to the canonical short names. A full IRI that resolves a class of
 * the bound manifest becomes its short name; a foreign IRI stays as it is,
 * neither dropped nor reinterpreted (Regel 7). Duplicates collapse; first
 * occurrence keeps its place, but callers MUST treat the result as a set.
 */
export function normalizeItemType(type: string | readonly string[] | undefined): string[] {
  if (!type) return []
  const roh = Array.isArray(type) ? type : [type as string]
  const m = getTypeManifest()
  const ergebnis: string[] = []
  for (const wert of roh) {
    const kurz = m.ids.find((id) => m.get(id)?.classIri === wert) ?? wert
    if (!ergebnis.includes(kurz)) ergebnis.push(kurz)
  }
  return ergebnis
}

/** The classes an item carries, normalised (see {@link normalizeItemType}). */
export function itemTypes(item: { type?: string | readonly string[] }): string[] {
  return normalizeItemType(item.type)
}

/** Does the item carry this class (by identity, not by spelling)? */
export function hasItemType(item: { type?: string | readonly string[] }, type: string): boolean {
  const gesucht = normalizeItemType(type)
  const hat = itemTypes(item)
  return gesucht.some((t) => hat.includes(t))
}

// Referenced so the "always implied" contract above stays type-checked against
// the canonical constant instead of a comment.
void VOCAB_BASE

/**
 * The canonical spelling of ONE stored `type` value (Spec 06, Regel 7): a
 * known IRI becomes its short name, everything else stays as it is. For the
 * `Item.type` string, which today carries one class.
 */
export function canonicalItemType(type: string): string {
  return normalizeItemType(type)[0] ?? type
}

/**
 * Every spelling a store may hold for these classes — short name AND class
 * IRI for known classes, the value itself for a foreign one. For connectors
 * that filter server-side (Supabase, rls#416): the database holds whatever
 * was written, the query must match either spelling, and an empty list is an
 * OR of nothing — it matches nothing, like `matchesFilter`.
 */
export function typeSpellings(type: string | readonly string[]): string[] {
  const m = getTypeManifest()
  const ergebnis: string[] = []
  for (const kurz of normalizeItemType(type)) {
    const iri = m.get(kurz)?.classIri
    for (const s of iri ? [kurz, iri] : [kurz]) if (!ergebnis.includes(s)) ergebnis.push(s)
  }
  return ergebnis
}

/**
 * The ingress rule (Spec 06, Regel 7) as one function every connector calls
 * where an item enters from storage, import or sync: a known IRI in `type`
 * becomes its short name; a foreign IRI is kept. Returns the SAME object when
 * nothing changes, so memoised consumers keep their identity.
 */
export function canonicalItem<T extends { type: string }>(item: T): T {
  const kurz = canonicalItemType(item.type)
  return kurz === item.type ? item : { ...item, type: kurz }
}
