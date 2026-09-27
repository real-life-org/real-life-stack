"use client"

// Darstellungs-Register — the toolkit half of the canonical type register.
//
// Spec: docs/spec/06-schema-composition.md → "Typ-Register".
//
// Entries attach DISPLAY concerns (label, icon, badge, the field and edge
// lists of "Feld- und Kantenregister", composer extras, and the preview slot
// for the shared ItemPreview shell) to type ids owned by the type manifest in
// `data-interface`. Meta box and composer defaults derive from `fields` and
// `edges` (field-register.ts); `detail`/`footer` are read only in transition
// (Spec 06, Regel 17) until S6 removes them.
//
// The register is BOUND to the manifest: registering presentation for an id
// the manifest does not know throws — this layer cannot introduce types
// (spec rules 1 and 6). A manifest entry without presentation resolves to the
// generic fallback: visible and neutral, never broken (rule 5).
//
// Layers contribute like the manifest (spec "Erweiterung und Merge"):
// *definitions* present a type for the first time, *extensions* additively
// fill fields the base left unset — scalar fields only where the base has
// none, `relationWidgets`, `fields`, `edges`, `lists` and `menuActions`
// united by key. Conflicts throw; no override in
// v0.1. Re-registering the SAME layer replaces it wholesale (Vite HMR
// re-executes registering modules on edit; throwing would break dev).
//
// SCOPE: this registry implements the Core → App composition. The SPACE
// layer of the spec is deliberately NOT offered yet — the registry is a
// module-global, so a space layer would leak across spaces instead of being
// scoped to one. Space layers need a scope-bound registry (context/instance)
// and a dynamic composer path; tracked in rls#212. The layer/extension
// machinery below is written so that cut can build on it.

import type { ComponentType, ReactNode } from "react"
import { createElement } from "react"
import {
  Calendar,
  CheckSquare,
  MapPin,
  Shapes,
  User as UserIcon,
} from "lucide-react"
import {
  composeTypeManifest,
  TOOLKIT_TYPE_LAYER,
  setTypeManifest as bindDataInterfaceManifest,
  relationAffordanceKey,
  type ComposedTypeManifest,
  type Item,
  normalizeItemType,
} from "@real-life-stack/data-interface"

import { ItemMetaRow } from "./item-meta-row"
import {
  assertFollowUps,
  assertJoins,
  assertRegisterLists,
  assertSelfActionValues,
  edgeKey,
  hasRegisterLists,
  readableFields,
  uniteRegisterLists,
  type EdgeEntry,
  type FieldEntry,
  type ListEntry,
  type MenuActionEntry,
  type RegisterLists,
  type SelfActionEntry,
  type FieldOption,
} from "./field-register"
import type { RelationRole } from "@real-life-stack/data-interface"
import { RegisterMeta, RegisterPeopleStack } from "./register-meta"
import { RegisterActions, actionEdges } from "./register-actions"
import { ItemProfileMeta, ItemProjectMeta, ItemResourceMeta } from "./item-type-meta"
import { StatementVariantLine, familyListQuery } from "../resonance/statement-variants"
import { registerListQuery } from "./list-queries"
import { RegisterReverse, hasReverseLists } from "./register-reverse"
import { RegisterCardRefs } from "./register-card-refs"
import { VoteBar } from "../resonance/vote-bar"
import { MessageSquareQuote } from "lucide-react"

/** Every slot receives the item — nothing else. Data resolution (members,
 *  votes, …) happens inside the slot component via hooks, so a slot works on
 *  every surface without surface-specific plumbing. */
export interface ItemSlotProps {
  item: Item
}

export interface TypeBadgeStyle {
  icon: ComponentType<{ className?: string }>
  className: string
}

/** Presents a type for the first time (spec: Typdefinition, Darstellungsseite). */
export interface TypePresentationEntry extends RegisterLists {
  /** Must match a manifest id — this layer never introduces types. */
  id: string
  /** Display name; the manifest deliberately carries none (SRP). */
  label: string
  /** Badge styling. Absent = deliberately no badge (e.g. plain posts). */
  badge?: TypeBadgeStyle
  /** Feldliste (Spec 06, Feld- und Kantenregister). */
  fields?: readonly FieldEntry[]
  /** Kantenliste, keyed by (`predicate`, `itemRole`); jede Kante adressiert eine Manifest-Kante. */
  edges?: readonly EdgeEntry[]
  /** Rückwärts-Listen über eine benannte Abfrage, keyed by `query`. */
  lists?: readonly ListEntry[]
  /** Zusätzliche Aktionen im ⋮-Menü, keyed by `id`. */
  menuActions?: readonly MenuActionEntry[]
  /**
   * Widget set the composer opens with. Only for types WITHOUT a field list —
   * with `fields`/`edges` it is derived (Spec 06, Regel 16).
   */
  composerWidgets?: readonly string[]
  /**
   * Composer widget per declared edge, keyed by `relationAffordanceKey`.
   * Geht in `edges` auf (Spec 06, Regel 2): nur noch für Typen ohne
   * Feld- und Kantenliste.
   */
  relationWidgets?: Readonly<Record<string, string>>
  /** Compact slot for cards and rows (metaAdornment). */
  preview?: ComponentType<ItemSlotProps>
  /**
   * Panel slot (metaAdornment). Übergang (Spec 06, Regel 17): gewinnt über die
   * Meta-Box aus `fields`/`edges`; entfällt mit S6.
   */
  detail?: ComponentType<ItemSlotProps>
  /**
   * Wo der Übergangs-Slot `detail` im Detail steht (Regel 17): Standard
   * `meta`. Die Aussage legt ihn nach `reverse` (Fassungen, „+ Variante") und
   * hat dann keine Meta-Box aus diesem Slot.
   */
  detailSlot?: "meta" | "reverse"
  /** Type-own footer, rendered IN ADDITION to surface footers. Übergang bis S6 (Regel 17). */
  footer?: ComponentType<ItemSlotProps>
  /**
   * Was der Composer fuer diesen Typ zusaetzlich wissen muss: Beschriftung
   * des Speichern-Knopfs, eigene Widget-Beschriftungen, Statuswerte, ob ein
   * Space Pflicht ist. Bis zum 21.09.2026 stand das als `APP_EXTRAS` in der
   * Referenz-App — als „genuinely app-specific". Es ist Darstellung eines
   * Typs und gehoert hierher, damit ein Toolkit-Typ ohne eine Zeile in der
   * App erstellbar ist (Spec 01, Der Modul-Host, Regel 1).
   */
  composer?: TypeComposerPresentation
}

export interface TypeComposerPresentation {
  submitLabel?: string
  /** Nur ohne Feldliste — sonst kommt die Beschriftung aus `FieldEntry.label`. */
  widgetLabels?: Readonly<Record<string, string>>
  /** Nur ohne Feldliste — sonst aus `options` des `status`-Feldes. */
  statusOptions?: readonly { id: string; label: string }[]
  defaultStatus?: string
  groupRequired?: boolean
}

/**
 * Ersetzt die Selbstaktion einer Kante des Toolkit-Registers (Spec 06,
 * Regel 20: Daten und Bedeutung gemeinsam, Bedienung je App). Prädikat,
 * Speicherort und Qualifier bleiben die des Toolkits; die neue Selbstaktion
 * schreibt nur Werte, die der Qualifier deklariert. Die einzige Ausnahme
 * von „kein Override" (Erweiterung und Merge, Punkt 3).
 */
export interface SelfActionOverride {
  predicate: string
  itemRole: RelationRole
  selfAction: SelfActionEntry
}

/**
 * Qualifier-Werte einer Schicht für eine Kante des Toolkit-Registers, die
 * einen Qualifier ohne (oder mit anderen) Werten erlaubt (Spec 06, Regel 20:
 * das Modul bringt sein Vokabular mit). Vereinigt nach Wert-Id; derselbe Wert
 * aus zwei Schichten ist ein Konflikt.
 */
export interface QualifierValuesEntry {
  predicate: string
  itemRole: RelationRole
  values: readonly FieldOption[]
}

/** Additively fills fields an existing presentation left unset
 *  (spec: Erweiterungsfragment, Darstellungsseite). */
export interface TypePresentationFragment extends RegisterLists {
  /** Must address an id already presented by an earlier layer. */
  id: string
  /** Eigene Bedienung einer Toolkit-Kante (Regel 20), je Kante höchstens einmal über alle Schichten. */
  selfActions?: readonly SelfActionOverride[]
  /** Qualifier-Werte samt Anzeige für Toolkit-Kanten (Regel 20). */
  qualifierValues?: readonly QualifierValuesEntry[]
  badge?: TypeBadgeStyle
  composerWidgets?: readonly string[]
  /** United by key; an existing key is a conflict. */
  relationWidgets?: Readonly<Record<string, string>>
  preview?: ComponentType<ItemSlotProps>
  detail?: ComponentType<ItemSlotProps>
  detailSlot?: "meta" | "reverse"
  footer?: ComponentType<ItemSlotProps>
  composer?: TypeComposerPresentation
}

export interface TypePresentationLayer {
  definitions?: readonly TypePresentationEntry[]
  extensions?: readonly TypePresentationFragment[]
}

/** What surfaces consume: entry with every fallback already applied. */
export interface ResolvedTypePresentation extends RegisterLists {
  id: string
  label: string
  badge?: TypeBadgeStyle
  composerWidgets?: readonly string[]
  relationWidgets?: Readonly<Record<string, string>>
  preview?: ComponentType<ItemSlotProps>
  /** Inhalt der Meta-Box. */
  detail: ComponentType<ItemSlotProps>
  /** Übergangs-Slot im Slot `reverse`, wo der Typ ihn dorthin legt (`detailSlot`). */
  reverse?: ComponentType<ItemSlotProps>
  /**
   * Slot `actions`: Selbstaktionen (C2) und Stimme (C4) aus den Kanten, wo der
   * Typ welche führt (Spec 06, Regel 9).
   */
  actions?: ComponentType<ItemSlotProps>
  footer?: ComponentType<ItemSlotProps>
  composer?: TypeComposerPresentation
  /** True when rendering generically: the type is unknown to the manifest OR
   *  has no presentation yet (spec rule 5 — visible, neutral, never broken). */
  generic: boolean
}

// ---------------------------------------------------------------------------
// Core slot components

/**
 * Die Meta-Box aus dem Register (shared-components, Item-Detail aus dem
 * Register): liest Feld- und Kantenliste des Typs, den das Item trägt. Die
 * Aufgaben-Zuweisungen standen bis S1 als Typ-Fußzeile; sie sind jetzt eine
 * Kante in der Meta-Box wie jede andere Personen-Kante.
 */
const REGISTER_DETAIL: ComponentType<ItemSlotProps> = function RegisterDetail({ item }) {
  const presentation = resolveTypePresentation(item.type)
  return <RegisterMeta item={item} fields={readableFields(presentation.fields)} edges={presentation.edges} lists={presentation.lists} />
}

/** Slot `reverse` aus dem Register: Rückwärts-Listen (Detail-Anatomie, Regel 8). */
const REGISTER_REVERSE: ComponentType<ItemSlotProps> = function RegisterReverseSlot({ item }) {
  const presentation = resolveTypePresentation(item.type)
  return <RegisterReverse item={item} lists={presentation.lists} edges={presentation.edges} />
}

// Die benannten Abfragen der Toolkit-Typen (06, Regel 12): `family` definiert
// die Resonanz-Spec (resonance.md → Varianten).
registerListQuery("family", { lazy: () => familyListQuery })

/** Slot `actions` aus dem Register (C2, C4). */
const REGISTER_ACTIONS: ComponentType<ItemSlotProps> = function RegisterActionsSlot({ item }) {
  const presentation = resolveTypePresentation(item.type)
  return <RegisterActions item={item} edges={presentation.edges} fields={presentation.fields} defaultStatus={presentation.composer?.defaultStatus} />
}

function EventPreview({ item }: ItemSlotProps) {
  return <ItemMetaRow item={item} />
}

const GENERIC_DETAIL: ComponentType<ItemSlotProps> = function GenericDetail({ item }) {
  return <ItemMetaRow item={item} />
}

/** The generic fallback badge style (spec rule 5). */
export const GENERIC_BADGE: TypeBadgeStyle = {
  icon: Shapes,
  className: "bg-muted text-muted-foreground border-border",
}

// ---------------------------------------------------------------------------
// Registry state

/** The seven core types RLS ships (spec 06, "Core-Typ"). Labels and badge
 *  styles are verbatim from the previous ItemTypeBadge DEFAULT_CONFIG; the
 *  preview slots are the previous getItemPreviewAdornments bodies. */
// Feld- und Kantenlisten der Toolkit-Typen (Spec 06, Register je Typ). Nur
// Kanten, die das Manifest deklariert (Regel 1): `partOf` und `blocks` seit S3
// mit ihrer Relation-Typ-Definition (TOOLKIT_RELATION_PREDICATES); `locatedAt`
// am Event folgt mit S4 (Kollision 7 aus #506). Felder, deren Widget es noch
// nicht gibt (`meetingLink` als url), folgen mit S4.
const TITLE: FieldEntry = { key: "title", widget: "title", pos: "head" }
const DESCRIPTION: FieldEntry = { key: "description", widget: "text", pos: "content", label: "Beschreibung" }
const TAGS: FieldEntry = { key: "tags", widget: "tags", pos: "tags" }
const GROUP: FieldEntry = { key: "group", widget: "group", pos: "badge" }
// Der Ort: Das Location-Widget schreibt address, position und locationName
// (shared-components, Location-Widget) — ein Feld, ein Widget.
const ADDRESS: FieldEntry = { key: "address", widget: "location", pos: "meta" }

const CORE_PRESENTATION: readonly TypePresentationEntry[] = [
  {
    id: "post",
    composer: { submitLabel: "Posten" },
    label: "Post",
    // Regel 5: Das Body-Feld ist ein Feldeintrag — beim Beitrag `content`.
    fields: [
      { key: "content", widget: "text", pos: "content" },
      { key: "media", widget: "media", pos: "content" },
      TAGS,
    ],
  },
  {
    id: "event",
    label: "Event",
    composer: { submitLabel: "Erstellen" },
    badge: { icon: Calendar, className: "bg-blue-50 text-blue-700 border-blue-200" },
    fields: [TITLE, DESCRIPTION, { key: "start", widget: "date", pos: "meta" }, ADDRESS, GROUP, TAGS],
    // Eingeladene und Zusagen in EINER Menschen-Zeile (08 → Teilnahme am
    // Event, Regel 5): `invited` bleibt eingebettet, die Zusage ist ein
    // eigener Record von der Person zum Event (Entscheidung 22/23).
    edges: [
      { predicate: "invited", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "Eingeladen", add: "Einladen…" },
      {
        predicate: "attends",
        itemRole: "to",
        storage: "record",
        widget: "people",
        pos: "meta",
        // Beschriftung des gemeinsamen Personenfelds im Formular (Design: „Wer").
        label: "Wer",
        qualifier: {
          key: "role",
          values: [
            { id: "going", label: "zugesagt", action: "Zusagen" },
            { id: "maybe", label: "vielleicht", action: "Vielleicht" },
            { id: "declined", label: "abgesagt", action: "Absagen" },
          ],
        },
        selfAction: { label: "Zusagen", mine: "Zugesagt", qualifiers: ["going", "maybe", "declined"] },
        count: "one-per-subject",
        // Eine Zeile mit den Eingeladenen, im Lesen wie im Formular.
        joins: "invited",
      },
    ],
    preview: EventPreview,
  },
  {
    id: "place",
    label: "Ort",
    composer: { submitLabel: "Erstellen" },
    badge: { icon: MapPin, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    fields: [TITLE, DESCRIPTION, ADDRESS, TAGS],
  },
  {
    id: "task",
    label: "Task",
    composer: { defaultStatus: "open", groupRequired: true },
    badge: { icon: CheckSquare, className: "bg-amber-50 text-amber-700 border-amber-200" },
    fields: [
      TITLE,
      DESCRIPTION,
      // Die Frist schreibt das Datums-Widget nach `start` (Spec 06, Die Rolle
      // von type: „Ein Task mit Deadline und ein Event tragen beide start").
      { key: "start", widget: "date", pos: "meta", label: "Fällig" },
      {
        key: "status",
        widget: "status",
        pos: "meta",
        // Statuswerte = die Spalten des Kanban (kanban-board.tsx, defaultColumns).
        // Hier ausgeschrieben statt importiert: Das Darstellungs-Register darf
        // kein Modul einziehen. Aendert sich eine Spalte, aendern sich beide.
        // Die Rollen (Spec 06, Regel 18; task/v1): Übergänge, Folgeaktion und
        // durchgestrichene Ziele lesen sie, nie die Id. `archived` (task/v1)
        // steht nicht im Formular und hätte keine Rolle.
        options: [
          { id: "open", label: "To Do", role: "open" },
          { id: "in-progress", label: "In Arbeit", role: "active" },
          { id: "done", label: "Erledigt", role: "done" },
        ],
      },
      TAGS,
      // Position im Modul: nie im Formular, nie in der Meta-Box (Regel 4).
      { key: "order", widget: "number", pos: "module", edit: false },
    ],
    edges: [
      {
        predicate: "assignedTo",
        itemRole: "from",
        storage: "embedded",
        widget: "people",
        pos: "meta",
        label: "Zugewiesen",
        add: "Zuweisen…",
        // Das Modul bringt sein Vokabular mit (Spec 06, Regel 20): Der Kern
        // erlaubt `role` an der Zuweisung, deklariert aber keine Werte und
        // keine Knopftexte. Werte samt Anzeige und eigene Pills bringt die
        // Register-Schicht eines Moduls (`qualifierValues`, `selfActions`);
        // unbekannte Werte bleiben erhalten und stehen ohne Zustandstext da.
        qualifier: { key: "role", values: [] },
        // „Übernehmen", mit anderen an der Kante „Mitmachen"; danach
        // „✓ Übernommen" (allein) oder „✓ Dabei" (mit anderen) · „Erledigt".
        // Übergänge des Status nach Regel 19.
        selfAction: {
          label: "Übernehmen",
          mine: "Übernommen",
          join: { label: "Mitmachen", mine: "Dabei", release: "Nicht mehr mitmachen" },
          followUps: {
            field: "status",
            complete: { label: "Erledigt" },
            release: "Übernahme zurückgeben",
          },
        },
      },
      // Item-Kanten (C3). `blocks` heißt von beiden Enden gleich: „Braucht"
      // (eingehend) und „Ermöglicht" (ausgehend) (Entscheidung 19). Beide
      // eingebettet am blockierenden Item. „Braucht" schreibt das Formular
      // am anderen Item, nur mit Schreibrecht dort (S3b).
      { predicate: "blocks", itemRole: "to", storage: "embedded", widget: "item-relation", pos: "meta", label: "Braucht", add: "@ Aufgabe suchen…" },
      { predicate: "blocks", itemRole: "from", storage: "embedded", widget: "item-relation", pos: "meta", label: "Ermöglicht", add: "@ Aufgabe suchen…" },
      { predicate: "partOf", itemRole: "from", storage: "embedded", widget: "item-relation", pos: "meta", label: "Teil von", add: "@ Projekt suchen…" },
    ],
  },
  {
    id: "person",
    label: "Profil",
    badge: { icon: UserIcon, className: "bg-violet-50 text-violet-700 border-violet-200" },
    preview: ItemProfileMeta,
  },
  { id: "project", label: "Projekt", preview: ItemProjectMeta },
  { id: "resource", label: "Ressource", preview: ItemResourceMeta },
  // Seit 21.09.2026 ein Toolkit-Typ (Spec 06): Das Toolkit liefert die
  // Resonanz vollständig, also auch die Darstellung ihrer Aussage. Die
  // Stimmleiste ist eine TYP-Regel — sie gehört zur Aussage, wo immer die
  // gezeigt wird (Regel 3, kein Typ-Verzweigen in Modulen).
  {
    id: "statement",
    label: "Aussage",
    badge: { icon: MessageSquareQuote, className: "bg-sky-50 text-sky-700 border-sky-200" },
    fields: [
      { ...TITLE, label: "Aussage" },
      { ...DESCRIPTION, label: "Kontext" },
      // Feld mit Item-Verweis (B15, Regel 11): gehört zum signierten Wortlaut,
      // darum ein Feld und keine Kante; nach dem Anlegen fest. Auf der Karte
      // als Chip, im Detail durch die Liste `family` abgedeckt (`covers`).
      {
        key: "variantOf",
        widget: "item-ref",
        pos: "meta",
        label: "Variante von",
        edit: "fixed",
        ref: { type: "statement", missing: "nicht verfügbare Aussage" },
      },
      TAGS,
    ],
    // Fassungen und „+ Variante" (resonance.md → Varianten; Entscheidung 24:
    // die Aktion gehört zur Liste, nicht ins ⋮-Menü).
    lists: [
      { query: "family", label: "Fassungen", action: { id: "create-variant", label: "+ Variante" }, covers: ["variantOf"] },
    ],
    // Die Stimme ist ein Qualifier am Record (08, Qualifier an Kanten). Im
    // Detail steht sie im Slot `actions` (Pills und Balken, C4); die Karte
    // zeigt im Übergang weiter den `footer` (Regel 17).
    edges: [
      {
        predicate: "votesOn",
        itemRole: "to",
        storage: "record",
        widget: "vote",
        pos: "actions",
        label: "Stimmen",
        qualifier: {
          key: "value",
          values: [
            { id: "green", label: "Dafür" },
            { id: "yellow", label: "Skeptisch" },
            { id: "red", label: "Dagegen" },
          ],
        },
        selfAction: { label: "Abstimmen", mine: "Abgestimmt", qualifiers: ["green", "yellow", "red"] },
        count: "one-per-subject",
      },
    ],
    composer: { submitLabel: "Einbringen" },
    footer: StatementVotesFooter,
  },
]

/** `itemRole: "to"`: votes are INCOMING records; the bar queries records pointing at this item.
    Below it, wherever the statement shows: of which statement it is a
    variant and how many variants exist (resonance.md → Varianten, rule 5). */
function StatementVotesFooter({ item }: ItemSlotProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <VoteBar statementId={item.id} className="w-full" />
      <StatementVariantLine item={item} />
    </div>
  )
}

/** Toolkit default: core manifest only. Apps composing more layers hand the
 *  result in via {@link setTypeManifest} BEFORE registering presentation. */
const TOOLKIT_ONLY_MANIFEST = composeTypeManifest([TOOLKIT_TYPE_LAYER])

let manifest: ComposedTypeManifest = TOOLKIT_ONLY_MANIFEST
const layers = new Map<string, TypePresentationLayer>([
  ["core", { definitions: CORE_PRESENTATION }],
])
/** Composed view, invalidated on every registration. */
let composedCache: Map<string, TypePresentationEntry> | null = null

/**
 * Bind the register to the app's composed manifest (the authoritative type
 * identity, spec rule 1). Call once at startup, before app/space layers
 * register presentation. Existing layers are re-validated against the new
 * manifest so a narrower manifest cannot leave orphans behind.
 */
export function setTypeManifest(next: ComposedTypeManifest): void {
  // Erst alles prüfen, dann binden: Ein abgelehntes Manifest darf weder hier
  // noch in data-interface ankommen, sonst widersprechen sich die Schichten.
  for (const [name, layer] of layers) {
    for (const entry of layer.definitions ?? []) {
      if (!next.has(entry.id)) {
        throw new Error(
          `Typ-Register: Manifest kennt "${entry.id}" nicht, Layer "${name}" präsentiert es aber — das Darstellungs-Register führt keine Typen ein (Spec 06, Regel 1/6).`,
        )
      }
      assertRelationWidgetKeys(next, entry.id, entry.relationWidgets, name)
      assertRegisterLists(next, entry.id, entry, name)
    }
    // Extensions carry relationWidgets and edges too — a rebind that skipped
    // them could leave orphan keys behind (#228).
    for (const frag of layer.extensions ?? []) {
      assertRelationWidgetKeys(next, frag.id, frag.relationWidgets, name)
      assertRegisterLists(next, frag.id, frag, name)
    }
  }
  // Dasselbe Manifest für Hinweise und Filter in data-interface: Wer im
  // Toolkit bindet, bindet einmal (Spec 06, Regel 1 — eine Identitätsquelle).
  bindDataInterfaceManifest(next)
  manifest = next
}

/** Every relationWidgets key MUST name an edge the manifest declares for the
 *  type — the UI cannot offer a widget for an affordance that has no
 *  authoritative identity (spec: Verhältnis zu Relations, Regel 2/3). */
function assertRelationWidgetKeys(
  source: ComposedTypeManifest,
  typeId: string,
  widgets: Readonly<Record<string, string>> | undefined,
  layerName: string,
): void {
  if (!widgets) return
  const declared = new Set((source.get(typeId)?.relations ?? []).map(relationAffordanceKey))
  for (const key of Object.keys(widgets)) {
    if (!declared.has(key)) {
      throw new Error(
        `Typ-Register [${layerName}]: relationWidgets["${key}"] an "${typeId}" hat keine Manifest-Kante — Widgets bedienen nur deklarierte Affordances (Spec 06, Verhältnis zu Relations).`,
      )
    }
  }
}

/** Test seam: core-only manifest, core-only presentation. Deliberately NOT
 *  exported via the package barrel — tests import this module directly. */
export function resetTypePresentationForTests(): void {
  manifest = TOOLKIT_ONLY_MANIFEST
  for (const key of [...layers.keys()]) if (key !== "core") layers.delete(key)
  composedCache = null
}

/**
 * Register a presentation layer (the app; space layers are not supported yet
 * — see the SCOPE note above and rls#212) at startup.
 *
 * - *Definitions* present a manifest-known type for the first time. An id the
 *   manifest does not know throws (no type introduction, spec rules 1/6); an
 *   id already presented by ANOTHER layer throws (no override in v0.1).
 * - *Extensions* additively fill fields of an already-presented type: scalar
 *   fields only where the base left them unset, `relationWidgets` united by
 *   key. Collisions throw.
 * - Re-registering the SAME layer name replaces that layer wholesale — a
 *   layer updating itself (Vite HMR), not an override between layers.
 *
 * A plain entry array is shorthand for `{ definitions }`.
 */
export function registerTypePresentation(
  layerName: string,
  layer: TypePresentationLayer | readonly TypePresentationEntry[],
): void {
  const normalized: TypePresentationLayer = Array.isArray(layer)
    ? { definitions: layer as readonly TypePresentationEntry[] }
    : (layer as TypePresentationLayer)

  const ownedElsewhere = new Map<string, string>()
  for (const [name, existing] of layers) {
    if (name === layerName) continue
    for (const e of existing.definitions ?? []) ownedElsewhere.set(e.id, name)
  }

  for (const entry of normalized.definitions ?? []) {
    if (!manifest.has(entry.id)) {
      throw new Error(
        `Typ-Register [${layerName}]: Manifest kennt "${entry.id}" nicht — das Darstellungs-Register führt keine Typen ein (Spec 06, Regel 1/6). Erst setTypeManifest() mit der App-Komposition aufrufen.`,
      )
    }
    const owner = ownedElsewhere.get(entry.id)
    if (owner) {
      throw new Error(
        `Typ-Register [${layerName}]: Darstellung für "${entry.id}" ist bereits in Layer "${owner}" vergeben — kein Override in v0.1; zum Ergänzen einzelner Felder Extensions verwenden (Spec 06, Erweiterung und Merge).`,
      )
    }
    assertRelationWidgetKeys(manifest, entry.id, entry.relationWidgets, layerName)
    assertRegisterLists(manifest, entry.id, entry, layerName)
  }
  for (const frag of normalized.extensions ?? []) {
    assertRelationWidgetKeys(manifest, frag.id, frag.relationWidgets, layerName)
    assertRegisterLists(manifest, frag.id, frag, layerName)
  }

  const previous = layers.get(layerName)
  layers.set(layerName, normalized)
  composedCache = null
  try {
    composePresentation() // fail fast: extension conflicts surface at registration
  } catch (err) {
    if (previous) layers.set(layerName, previous)
    else layers.delete(layerName)
    composedCache = null
    throw err
  }
}

const SCALAR_SLOTS = ["badge", "composerWidgets", "preview", "detail", "detailSlot", "footer", "composer"] as const

function composePresentation(): Map<string, TypePresentationEntry> {
  if (composedCache) return composedCache
  const composed = new Map<string, TypePresentationEntry>()
  // Pass 1: definitions. Deterministic — ids are unique across layers by the
  // registration checks, so order cannot change the outcome.
  for (const [, layer] of layers) {
    for (const def of layer.definitions ?? []) {
      composed.set(def.id, { ...def, relationWidgets: { ...(def.relationWidgets ?? {}) } })
    }
  }
  // Welche Selbstaktionen schon ersetzt sind, je Typ und Kante (Regel 20: einmal).
  const overridden = new Map<string, string>()
  // Welche Schicht welchen Qualifier-Wert deklariert, je Typ, Kante und Wert.
  const valueOwners = new Map<string, string>()
  // Pass 2: extensions — additive only (spec: Erweiterungsfragment). Sorted
  // by layer name: the lists are ordered, and the composed view must not
  // depend on registration order (Spec 06, Erweiterung und Merge).
  for (const [name, layer] of [...layers].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    for (const frag of layer.extensions ?? []) {
      const base = composed.get(frag.id)
      if (!base) {
        throw new Error(
          `Typ-Register [${name}]: Fragment adressiert "${frag.id}", das keine Darstellung hat — Fragmente erweitern vorhandene Einträge (Spec 06, Erweiterung und Merge).`,
        )
      }
      for (const field of SCALAR_SLOTS) {
        const incoming = frag[field]
        if (incoming === undefined) continue
        if (base[field] !== undefined) {
          throw new Error(
            `Typ-Register [${name}]: Fragment setzt "${field}" an "${frag.id}", das die Basis bereits setzt — Skalare sind nur setzbar, wo die Basis schweigt (Spec 06).`,
          )
        }
        ;(base as unknown as Record<string, unknown>)[field] = incoming
      }
      for (const [key, widget] of Object.entries(frag.relationWidgets ?? {})) {
        const widgets = base.relationWidgets as Record<string, string>
        if (key in widgets) {
          throw new Error(
            `Typ-Register [${name}]: relationWidgets["${key}"] an "${frag.id}" ist bereits vergeben (Spec 06, Erweiterung und Merge).`,
          )
        }
        widgets[key] = widget
      }
      Object.assign(base, uniteRegisterLists(base, frag, frag.id, name))
      if (frag.qualifierValues?.length) addQualifierValues(base, frag.qualifierValues, name, valueOwners)
    }
  }
  // Pass 3: Selbstaktionen der Schichten (Regel 20) — erst nachdem alle
  // Qualifier-Werte vereinigt sind, damit die Pills gegen das zusammengesetzte
  // Vokabular geprüft werden, unabhängig von der Reihenfolge der Schichten.
  for (const [name, layer] of [...layers].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    for (const frag of layer.extensions ?? []) {
      const base = composed.get(frag.id)
      if (base && frag.selfActions?.length) overrideSelfActions(base, frag.selfActions, name, overridden)
    }
  }
  // Was aus der Feldliste abgeleitet wird, darf nicht zusätzlich von Hand
  // gesetzt sein — sonst gäbe es zwei Quellen für dieselbe Antwort (Regeln 2, 16).
  for (const entry of composed.values()) {
    assertNoParallelComposerSource(entry)
    assertJoins(entry.id, entry.edges)
    assertFollowUps(entry.id, entry.fields, entry.edges)
  }
  composedCache = composed
  return composed
}

/**
 * Regel 20: Eine App ersetzt die Selbstaktion einer Kante, die das
 * Toolkit-Register (Schicht `core`) mit Selbstaktion führt. Nur die
 * Selbstaktion wechselt; ihre Pills schreiben nur deklarierte Werte. Je
 * Kante eine Ersetzung über alle Schichten — zwei wären ein Konflikt.
 */
function overrideSelfActions(
  base: TypePresentationEntry,
  overrides: readonly SelfActionOverride[],
  layerName: string,
  overridden: Map<string, string>,
): void {
  const fail = (message: string): never => {
    throw new Error(`Typ-Register [${layerName}]: ${message} an "${base.id}" (Spec 06, Feld- und Kantenregister, Regel 20).`)
  }
  const core = layers.get("core")?.definitions?.find((d) => d.id === base.id)
  for (const override of overrides) {
    const key = edgeKey(override)
    const toolkitEdge = core?.edges?.find((e) => edgeKey(e) === key)
    if (!toolkitEdge?.selfAction) fail(`Selbstaktion an (${override.predicate}, ${override.itemRole}) ersetzt keine Kante mit Selbstaktion im Toolkit-Register`)
    const slot = `${base.id}|${key}`
    const owner = overridden.get(slot)
    if (owner) fail(`Selbstaktion an (${override.predicate}, ${override.itemRole}) ist bereits von Schicht "${owner}" ersetzt`)
    overridden.set(slot, layerName)
    // Das Modul bringt sein Vokabular mit: Die Pills einer Schicht schreiben
    // nur Werte, die der Kern oder DIESELBE Schicht deklariert. So hängt das
    // Ergebnis nicht davon ab, in welcher Reihenfolge Schichten registriert
    // werden (Erweiterung und Merge; Codex R5/1).
    const own = new Set([
      ...(toolkitEdge!.qualifier?.values ?? []).map((v) => v.id),
      ...(layers.get(layerName)?.extensions ?? [])
        .filter((f) => f.id === base.id)
        .flatMap((f) => f.qualifierValues ?? [])
        .filter((q) => edgeKey(q) === key)
        .flatMap((q) => q.values.map((v) => v.id)),
    ])
    const foreign = (override.selfAction.qualifiers ?? []).filter((q) => !own.has(q))
    if (foreign.length > 0) {
      fail(`Selbstaktion an (${override.predicate}, ${override.itemRole}) setzt ${foreign.join(", ")}, das weder der Kern noch dieselbe Schicht deklariert`)
    }
    const composedEdge = (base.edges ?? []).find((e) => edgeKey(e) === key) ?? toolkitEdge!
    assertSelfActionValues(composedEdge, override.selfAction, fail)
    base.edges = (base.edges ?? []).map((edge) => (edgeKey(edge) === key ? { ...edge, selfAction: override.selfAction } : edge))
  }
}

/**
 * Regel 20: Eine Schicht bringt Qualifier-Werte samt Anzeige für eine Kante
 * des Toolkit-Registers mit, die einen Qualifier erlaubt. Schlüssel,
 * Prädikat und Speicherort bleiben die des Kerns. Werte werden nach Id
 * vereinigt; einen Wert, den der Kern oder eine andere Schicht schon
 * deklariert, umzudefinieren ist ein Konflikt (Erweiterung und Merge, Punkt 2)
 * — auch mit gleichem Label, damit die Anzeige nie von der Ladereihenfolge
 * abhängt.
 */
function addQualifierValues(
  base: TypePresentationEntry,
  entries: readonly QualifierValuesEntry[],
  layerName: string,
  owners: Map<string, string>,
): void {
  const fail = (message: string): never => {
    throw new Error(`Typ-Register [${layerName}]: ${message} an "${base.id}" (Spec 06, Feld- und Kantenregister, Regel 20).`)
  }
  const core = layers.get("core")?.definitions?.find((d) => d.id === base.id)
  for (const entry of entries) {
    const key = edgeKey(entry)
    const toolkitEdge = core?.edges?.find((e) => edgeKey(e) === key)
    if (!toolkitEdge?.qualifier) fail(`Qualifier-Werte an (${entry.predicate}, ${entry.itemRole}) nennen keine Kante mit Qualifier im Toolkit-Register`)
    base.edges = (base.edges ?? []).map((edge) => {
      if (edgeKey(edge) !== key || !edge.qualifier) return edge
      const values = [...edge.qualifier.values]
      for (const value of entry.values) {
        const slot = `${base.id}|${key}|${value.id}`
        const owner = values.some((v) => v.id === value.id) ? (owners.get(slot) ?? "core") : undefined
        if (owner) fail(`Qualifier-Wert "${value.id}" an (${entry.predicate}, ${entry.itemRole}) ist bereits von Schicht "${owner}" deklariert`)
        owners.set(slot, layerName)
        values.push(value)
      }
      return { ...edge, qualifier: { ...edge.qualifier, values } }
    })
  }
}

function assertNoParallelComposerSource(entry: TypePresentationEntry): void {
  if (!hasRegisterLists(entry)) return
  const parallel = [
    entry.composerWidgets && "composerWidgets",
    entry.relationWidgets && Object.keys(entry.relationWidgets).length > 0 && "relationWidgets",
    entry.composer?.widgetLabels && "composer.widgetLabels",
    entry.composer?.statusOptions && "composer.statusOptions",
  ].filter(Boolean)
  if (parallel.length > 0) {
    throw new Error(
      `Typ-Register: "${entry.id}" hat eine Feld- und Kantenliste und setzt zusätzlich ${parallel.join(", ")} — das wird aus fields/edges abgeleitet (Spec 06, Feld- und Kantenregister, Regeln 2 und 16).`,
    )
  }
}

/**
 * Resolve the presentation for a type. Generic (spec rule 5) when the type is
 * unknown to the manifest OR has a manifest entry without presentation —
 * visible with title, meta row and neutral badge, never invisible or broken.
 */
export function resolveTypePresentation(typeId: string): ResolvedTypePresentation {
  // Ueber die normalisierte Klassenmenge (Spec 06, Regel 7 und 9): eine
  // volle IRI findet ihre Darstellung, und bei mehreren Klassen zaehlt die
  // erste, fuer die eine Vorlage existiert — eine UI-Wahl, keine Aussage
  // ueber das Item (rls#417).
  const klassen = normalizeItemType(typeId)
  const darstellungen = composePresentation()
  const id = klassen.find((k) => darstellungen.has(k) && manifest.has(k)) ?? klassen[0] ?? typeId
  const entry = darstellungen.get(id)
  if (!entry || !manifest.has(id)) {
    return { id, label: id, detail: GENERIC_DETAIL, generic: true }
  }
  // Übergang (Regel 17): ein gesetztes `detail` gewinnt, dort, wo der Typ es
  // hinlegt (Standard: Meta-Box); sonst die Meta-Box aus dem Register; ein
  // Typ ohne Feldliste behält die Vorschau-Zeile.
  const fromRegister = hasRegisterLists(entry) ? REGISTER_DETAIL : (entry.preview ?? GENERIC_DETAIL)
  const inReverse = entry.detail && entry.detailSlot === "reverse"
  const reverse = inReverse ? entry.detail : hasReverseLists(entry.lists, entry.edges) ? REGISTER_REVERSE : undefined
  return {
    ...entry,
    detail: inReverse ? fromRegister : (entry.detail ?? fromRegister),
    ...(reverse ? { reverse } : {}),
    ...(actionEdges(entry.edges).length > 0 ? { actions: REGISTER_ACTIONS } : {}),
    generic: false,
  }
}

/**
 * Die Typ-Fußzeile im DETAIL, oder null. Übergang (Spec 06, Regel 17): nur
 * noch für Typen ohne Feld- und Kantenliste — Zusagen und Stimmen stehen mit
 * S2 im Slot `actions`, der Prop `footer` trägt danach nur Reaktionen und
 * Kommentieren (shared-components, `ItemDetailBody`). Karten nehmen
 * {@link renderTypeCardFooter}.
 */
export function renderTypeFooter(item: Item): ReactNode {
  const presentation = resolveTypePresentation(item.type)
  if (hasRegisterLists(presentation) || !presentation.footer) return null
  return createElement(presentation.footer, { item })
}

/**
 * Die Fußzeile einer KARTE: die Typ-Fußzeile, wo ein Typ sie im Übergang noch
 * setzt (Regel 17), sonst der Avatar-Stapel seiner Personen-Kanten aus dem
 * Register (shared-components, Item-Detail aus dem Register, Regel 9). Im
 * Detail stehen die Personen in der Meta-Box, dort gilt {@link renderTypeFooter}.
 */
export function renderTypeCardFooter(item: Item): ReactNode {
  const presentation = resolveTypePresentation(item.type)
  // Felder mit Item-Verweis stehen auf der Karte immer als Chip (B15, Regel 11).
  const refs = (presentation.fields ?? []).some((f) => f.widget === "item-ref")
    ? createElement(RegisterCardRefs, { item, fields: presentation.fields })
    : null
  const main = presentation.footer
    ? createElement(presentation.footer, { item })
    : presentation.edges?.length
      ? createElement(RegisterPeopleStack, { item, edges: presentation.edges })
      : null
  if (!refs) return main
  return createElement("div", { className: "flex w-full flex-col gap-1.5" }, main, refs)
}
