import type { Item } from "@real-life-stack/data-interface"
import { normalizeItemType } from "@real-life-stack/data-interface"
import type { ContentTypeConfig, WidgetData } from "./content-composer"
import type { ItemEditorMapper } from "../../hooks/use-item-editor"
import {
  peopleDataKeys,
  peopleRelationsFromWidgetData,
  peopleRelationsToWidgetData,
} from "./people-relations"
import { toStoredDateTime } from "./date-widget-state"

/**
 * Composer ↔ item: the one mapping every module and every app shares.
 *
 * Lived in the reference app until 2026-09-19; every other app (and the
 * handbook's garden) had to rebuild it and got the edge cases wrong — a title
 * edit that leaks `status: ""` onto a task, an emptied field that comes back.
 * Now the toolkit owns it; the app only supplies its content types.
 */

/** Where a type keeps its free text: `content` for posts (base/v1), `description`
 *  for everything else (events, places, tasks, …). A type may override it. */
export function textFieldFor(type: string, config?: ContentTypeConfig): "content" | "description" {
  return config?.textField ?? (type === "post" ? "content" : "description")
}

function isEmptyValue(v: unknown): boolean {
  if (v === "" || v === null || v === undefined) return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

/**
 * Data fields the composer round-trips into the edit form (via
 * `editInitialData`) and that the user can clear through its widgets. For
 * these, an empty value in an EDIT submission is an intentional clear, so the
 * field is dropped from the saved item. Fields NOT listed here (e.g.
 * `meetingLink`) aren't loaded back into the form, so an empty value just means
 * "not shown" and the existing value must be preserved. `text`, `tags` and
 * `people` are clearable too but handled separately below.
 *
 * Keep this in sync with the fields `editInitialData` produces.
 */
const CLEARABLE_DATA_FIELDS = new Set([
  "title",
  "start",
  "end",
  "rrule",
  "address",
  "locationName",
  "position",
  "status",
  "media",
])

export interface ComposerMapping {
  /** Composer submission → item payload, for create and edit (see below). */
  mapSubmission: ItemEditorMapper
  /** Pre-fill the edit composer from an item's stored data (inverse of the mapper). */
  editInitialData: (item: Item) => Partial<WidgetData>
}

type Resolve = (id: string) => ContentTypeConfig | undefined

/**
 * Build the mapping for a set of content types (or a resolver over them).
 *
 * Create and edit have explicit, different semantics:
 *
 * - **Create** strips empty composer defaults (status/title/… initialise to
 *   "" / []), so e.g. a post doesn't ship `status: ""` — which would leak it
 *   onto the Kanban board.
 * - **Edit** starts from the existing data (so fields the composer doesn't
 *   manage survive untouched) and treats an empty value for a round-tripped
 *   field as an intentional clear: the user emptied a field they saw, so it is
 *   removed from the item (including `tags: []`). Fields the user didn't touch
 *   keep their value.
 */
export function createComposerMapping(types: readonly ContentTypeConfig[] | Resolve): ComposerMapping {
  const resolve: Resolve = typeof types === "function" ? types : (id) => types.find((t) => t.id === id)

  const mapSubmission: ItemEditorMapper = (submission, { existingItem }) => {
    // `group` is the item's group/space association, persisted via the connector
    // (moveItemToGroup in useItemEditor) — never written into item.data.
    // `people` becomes relations (below), not item.data. `tags` is top-level.
    const { text, tags: submittedTags, group: _group, people: _people, ...rest } = submission.data
    // Was gespeichert wird, ist die Klassenmenge des Items (unveraendert);
    // die VORLAGE ist die erste Klasse, fuer die es eine gibt (Spec 06, Regel 9).
    const type = existingItem?.type ?? submission.contentType
    const klassen = normalizeItemType(type)
    const vorlage = klassen.find((k) => resolve(k) !== undefined) ?? klassen[0] ?? submission.contentType
    const typeConfig = resolve(vorlage)

    // Which keys carry people is said by the type (an entry may set its own
    // dataKey) — they become relations, not item.data.
    const peopleKeys = new Set(typeConfig ? peopleDataKeys(typeConfig) : ["people"])

    // Base on the existing data so unmanaged fields survive an edit; empty on create.
    const itemData: Record<string, unknown> = { ...(existingItem?.data ?? {}) }
    for (const [key, value] of Object.entries(rest)) {
      if (peopleKeys.has(key)) continue
      if (!isEmptyValue(value)) {
        itemData[key] = value
      } else if (existingItem && CLEARABLE_DATA_FIELDS.has(key)) {
        delete itemData[key]
      }
    }

    // Timed start/end are stored with the author's offset (spec 06); a value
    // prefilled from a calendar click may still be a zone-less local string.
    for (const key of ["start", "end"] as const) {
      if (typeof itemData[key] === "string") itemData[key] = toStoredDateTime(itemData[key] as string)
    }

    // Free text maps to content/description by type. Clearing it in edit removes
    // the stored field; an empty text on create writes nothing.
    const textField = textFieldFor(vorlage, typeConfig)
    if (text) itemData[textField] = text
    else if (existingItem) delete itemData[textField]

    // Tags live top-level (spec 07-tags.md); drop any legacy data.tags.
    delete itemData.tags
    // Create default: a fresh status-bearing item (task) lands in its default
    // column if no status was picked.
    if (!existingItem && typeConfig?.defaultStatus && !itemData.status) {
      itemData.status = typeConfig.defaultStatus
    }
    // Tags: on edit the submission is authoritative (an emptied widget → `[]`
    // clears the list); on create the empty default is stripped.
    const tags = existingItem
      ? Array.isArray(submittedTags)
        ? submittedTags
        : existingItem.tags
      : Array.isArray(submittedTags) && submittedTags.length > 0
        ? submittedTags
        : undefined

    // People → relations on the type's predicates. Only the predicates of the
    // submitted fields are replaced; other relations stay.
    const relations = typeConfig
      ? (peopleRelationsFromWidgetData(typeConfig, submission.data, existingItem?.relations) ??
        existingItem?.relations)
      : existingItem?.relations

    return {
      type,
      data: itemData,
      ...(tags ? { tags } : {}),
      ...(relations ? { relations } : {}),
    }
  }

  const editInitialData = (item: Item): Partial<WidgetData> => {
    const d = item.data as Record<string, unknown>
    // Die Vorlage folgt der kanonischen Klasse (Spec 06, Regel 7, 9): ein Item,
    // das mit voller IRI ankam, verliert sonst hier seine Vorbelegung (rls#417).
    // Regel 9: die erste Klasse, fuer die es eine Vorlage gibt.
    const klassen = normalizeItemType(item.type)
    const type = klassen.find((k) => resolve(k) !== undefined) ?? klassen[0] ?? item.type
    const typeConfig = resolve(type)
    const text = d[textFieldFor(type, typeConfig)]
    const people = typeConfig ? peopleRelationsToWidgetData(typeConfig, item.relations) : {}
    return {
      ...(typeof d.title === "string" ? { title: d.title } : {}),
      ...(typeof text === "string" ? { text } : {}),
      ...(typeof d.start === "string" ? { start: d.start } : {}),
      ...(typeof d.end === "string" ? { end: d.end } : {}),
      ...(typeof d.rrule === "string" ? { rrule: d.rrule } : {}),
      ...(typeof d.address === "string" ? { address: d.address } : {}),
      ...(typeof d.locationName === "string" ? { locationName: d.locationName } : {}),
      ...(d.position && typeof d.position === "object"
        ? { position: d.position as WidgetData["position"] }
        : {}),
      ...(Array.isArray(d.media) && d.media.length > 0 ? { media: d.media as WidgetData["media"] } : {}),
      ...(typeof d.status === "string" ? { status: d.status } : {}),
      ...people,
      tags: item.tags ?? [],
    }
  }

  return { mapSubmission, editInitialData }
}

/**
 * Inject the group/sharing-scope widget into content types: the available groups
 * as options + the current space as default. The composer auto-shows the `group`
 * widget in edit mode when ≥2 options exist. The chosen group is persisted as the
 * item's group association by `useItemEditor` (not as item data).
 */
/**
 * Pin the create form to ONE space: the group widget offers only `groupId`
 * and starts on it, so the author cannot move the new item elsewhere. For
 * items whose data refers to another item by its space-local id — a
 * statement variant's `variantOf` must point into its own space
 * (resonance.md, Varianten rule 2).
 */
export function withFixedGroup(types: ContentTypeConfig[], groupId: string): ContentTypeConfig[] {
  return types.map((t) => {
    const option = t.groupOptions?.find((o) => o.id === groupId) ?? { id: groupId, name: "Space der Vorlage" }
    return {
      ...t,
      groupOptions: [option],
      defaultGroup: groupId,
      ...(t.defaultWidgets.includes("group") ? {} : { defaultWidgets: [...t.defaultWidgets, "group"] }),
    }
  })
}

export function withGroupOptions(
  types: ContentTypeConfig[],
  // May be undefined while the groups query is still loading — guarded below.
  groups: { id: string; name: string }[] | undefined,
  currentGroupId?: string,
  personalGroupId?: string | null,
): ContentTypeConfig[] {
  // Options = the user's personal/private space („Privat", the „share with
  // nobody" target) + the shared groups. Only surface a picker when there's a
  // real choice (≥2 options).
  const options: { id: string; name: string }[] = []
  if (personalGroupId) options.push({ id: personalGroupId, name: "Privat" })
  options.push(...(groups ?? []).map((g) => ({ id: g.id, name: g.name })))
  if (options.length < 2) return types

  // Default to the current space; in the personal/overview view (no concrete
  // space) default to „Privat" so a new item stays private unless shared.
  const defaultGroup =
    currentGroupId && options.some((o) => o.id === currentGroupId)
      ? currentGroupId
      : personalGroupId ?? undefined
  return types.map((t) => ({
    ...t,
    groupOptions: options,
    ...(defaultGroup ? { defaultGroup } : {}),
    ...(t.defaultWidgets.includes("group") ? {} : { defaultWidgets: [...t.defaultWidgets, "group"] }),
  }))
}
