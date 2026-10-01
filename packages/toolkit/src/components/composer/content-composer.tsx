"use client"

import * as React from "react"
import type { Item } from "@real-life-stack/data-interface"
import { Check, ChevronDown, CircleAlert, Globe, Home, Loader2, Lock, Trash2, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/primitives/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/primitives/tooltip"
import { ItemTypeBadge } from "../preview/item-type-badge"
import { GENERIC_BADGE, resolveTypePresentation } from "../preview/type-presentation"
import { Button } from "@/components/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu"
import { useIsCompact } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { GeoJSONPoint } from "@/lib/geo"
import { WidgetWrapper } from "./widgets/widget-wrapper"
import { TitleWidget } from "./widgets/title-widget"
import { TextWidget, WIDGET_ICONS, WIDGET_LABELS } from "./widgets/text-widget"
import { DateWidget } from "./widgets/date-widget"
import {
  dateWidgetPatch,
  dateWidgetToggles,
  dateWidgetValue,
  NO_DATE_TOGGLES,
  type DateWidgetToggles,
  toDateInputValue,
} from "./date-widget-state"
import { LocationField } from "./widgets/location-field"
import { useFormState, type FieldAccess } from "@/lib/form-state"
import { asString, asStrings, incomingField, itemRefField, locationField, peopleField, scalarField } from "./form-fields"
import { FieldNotice } from "./widgets/field-notice"
import { AvatarField } from "./widgets/avatar-widget"
import type { Geocoder, ReverseGeocoder } from "@/lib/geocode"
import { MediaWidget } from "./widgets/media-widget"
import { PeopleWidget, type PeopleWidgetRecord, type PersonOption } from "./widgets/people-widget"
export type { PersonOption } from "./widgets/people-widget"
import { peopleQualifierKey, peopleStatementKey, resolvePeopleFields, type PeopleRelationConfig } from "./people-relations"
export type { PeopleRelationConfig } from "./people-relations"
import { TagsWidget } from "./widgets/tags-widget"
import { useFormSpaceSources } from "./use-form-space-sources"
import { ITEM_BINDINGS_REASON } from "../../lib/item-bindings"
import { StatusWidget } from "./widgets/status-widget"
import { ChipsField, ContactField, NumberGroupField, OptionField, UrlField } from "./widgets/value-widgets"
import { VALUE_WIDGETS, valueFieldError, type ValueFieldConfig } from "./value-fields"
import { groupNumberFields } from "../preview/field-register"
import { chipValues, type OptionTone } from "../../lib/field-values"
import { FixedItemRefField, IncomingRelationField, ItemRelationWidget, type RequestItemPick } from "./widgets/item-relation-widget"
import { incomingRemovedKey, itemRelationChoiceKeys, itemRelationDataKey, itemRelationDataKeys, type ItemRefFieldConfig, type ItemRelationFieldConfig } from "./item-relations"
import { survivesSpaceChange } from "@/lib/item-targets"

// ── Types ────────────────────────────────────────────────────────────────

export type WidgetType =
  | "title"
  | "text"
  | "media"
  | "date"
  | "location"
  | "people"
  | "tags"
  | "status"
  | "group"
  /** Item-Kanten (C3) aus dem Register — nie zum Zuschalten. */
  | "item-relation"
  /** Felder mit Item-Verweis (B15) aus dem Register — nie zum Zuschalten. */
  | "item-ref"
  /** Wert-Widgets (B7–B10, B12) aus dem Register — nie zum Zuschalten. */
  | "number"
  | "select"
  | "url"
  | "chips"
  | "contact"
  /** Bild im Kopf (B11) aus dem Register — nie zum Zuschalten. */
  | "avatar"

export interface MediaFile {
  id: string
  name: string
  url: string
  type?: string
}

export interface DateRange {
  start: string
  end?: string
  showEnd?: boolean
  showTime?: boolean
  showRecurrence?: boolean
  rrule?: string
}

export interface LocationData {
  address?: string
  link?: string
  isOnline?: boolean
  position?: { lat: number; lng: number }
}

export interface WidgetData {
  title?: string
  text?: string
  media?: MediaFile[]
  /** ISO datetime, start of an event/task. Spec: data.start */
  start?: string
  /** ISO datetime, end of an event/task. Spec: data.end */
  end?: string
  /** Optional RFC 5545 recurrence rule. Spec: data.rrule */
  rrule?: string
  /** Human-readable address. Spec: data.address */
  address?: string
  /** Named location (e.g. "Markthalle 7"). Spec: data.locationName */
  locationName?: string
  /** GeoJSON Point for map display. Spec: data.position */
  position?: GeoJSONPoint
  /** Online meeting URL (Zoom, Jitsi, etc.). Spec: data.meetingLink */
  meetingLink?: string
  people?: string[]
  tags?: string[]
  status?: string
  group?: string
  [key: string]: unknown
}

export interface StatusOption {
  id: string
  label: string
  /** Ton der Pille, aus dem Register (Ton der Option, sonst Rolle, sonst Typfarbe). */
  tone?: OptionTone | "type"
  className?: string
}

export interface GroupOption {
  id: string
  name: string
  /** Space logo (`data.image`), as the space switcher shows it. */
  image?: string
  /** Space colour (`data.primaryColor`): the logo tile's surface. */
  color?: string
  /** The personal space („Privat") — shown with the home icon, like the switcher. */
  personal?: boolean
  /** Number of members, shown muted in the space menu. */
  memberCount?: number
}

export interface ContentTypeConfig {
  id: string
  label: string
  defaultWidgets: (WidgetType | string)[]
  widgetLabels?: Partial<Record<WidgetType | string, string>>
  submitLabel?: string
  editLabel?: string
  icon?: React.ComponentType<{ className?: string }>
  statusOptions?: StatusOption[]
  defaultStatus?: string
  groupOptions?: GroupOption[]
  defaultGroup?: string
  groupRequired?: boolean
  /** Why the space cannot be changed (one fixed option) — tooltip in the form head. */
  groupFixedReason?: string
  /**
   * Der Connector hat Spaces, das Formular kann aber keinen bestimmen (etwa
   * ohne GroupScopeCapable in der Übersicht): Anlegen ist gesperrt, der
   * Grund steht im Formular (Space des Formulars, Regeln 6 und 8).
   */
  groupUnavailableReason?: string
  /** Where this type keeps its free text. Default: `content` for `post`, else `description`. */
  textField?: "content" | "description"
  /**
   * How this type links people: the relation predicate the `people` widget
   * maps to (task → `assignedTo`, event → `invited`, …). Declared per type so
   * the shared submission mapper / pre-fill stay type-driven instead of
   * hard-coding `assignedTo`. The widget only shows when `people` is in
   * `defaultWidgets`; the predicate may be declared ahead of enabling it. Label
   * stays in `widgetLabels.people`.
   */
  peopleRelation?: { predicate: string }
  /**
   * Mehrere Personenfelder je Typ (z.B. eine Aufgabe mit „Kann ich" =
   * `assignedTo` und „Will lernen" = `wantsToLearn`). Jeder Eintrag rendert
   * dasselbe `people`-Widget mit eigenem Label und eigenem Datenschlüssel;
   * `peopleRelation` (Einzahl) bleibt die Kurzform für genau einen Eintrag.
   * Auflösung siehe {@link resolvePeopleFields}.
   */
  peopleRelations?: readonly PeopleRelationConfig[]
  /** Item-Kanten (C3), je Kante ein Feld; abgeleitet aus dem Register. */
  itemRelations?: readonly ItemRelationFieldConfig[]
  /** Felder mit Item-Verweis (B15); abgeleitet aus dem Register. */
  itemRefs?: readonly ItemRefFieldConfig[]
  /** Wert-Felder (number, select, url, chips, contact); abgeleitet aus dem Register. */
  valueFields?: readonly ValueFieldConfig[]
}

export interface WidgetComponentProps<T = unknown> {
  value: T
  onChange: (value: T) => void
  label: string
}

export interface CustomWidgetDefinition {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType<WidgetComponentProps<unknown>>
}

/**
 * Fehler beim Speichern (shared-components, Detail-Anatomie Slot `note` im
 * Bearbeiten: „Fehler-Banner inline"; Zustand „Fehler": Banner mit „Erneut",
 * Eingaben bleiben erhalten). Steht unter dem Kopf des Formulars; Farben nur
 * über das Token `destructive`.
 */
function SaveErrorBanner({ reason, onRetry, busy }: { reason?: string; onRetry: () => void; busy: boolean }) {
  return (
    <div
      data-slot="save-error"
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2.5 text-sm"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground">Konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.</span>
        {reason && <span className="text-xs text-muted-foreground">{reason}</span>}
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="shrink-0 rounded-md px-2 py-0.5 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:opacity-50"
      >
        Erneut
      </button>
    </div>
  )
}

export interface ContentComposerSubmitData {
  contentType: string
  /**
   * @deprecated Kein Mapper und kein Connector liest den Wert; die
   * Sichtbarkeit folgt aus dem Space im Kopf des Formulars (shared-components,
   * Edit-Regeln 3). Bleibt bis zum nächsten Major im Vertrag.
   */
  isPublic: boolean
  data: WidgetData
}

export interface ContentComposerHandle {
  /** Merge a patch into the composer's widget data (e.g. update only `start`). */
  patchData: (patch: Partial<WidgetData>) => void
}

export interface ContentComposerProps {
  contentTypes: ContentTypeConfig[]
  initialContentType?: string
  mode?: string
  initialData?: Partial<WidgetData>
  /** Imperative handle, set on mount — lets the host patch the open composer (e.g. its date) without remounting. */
  apiRef?: React.MutableRefObject<ContentComposerHandle | null>
  onSubmit: (data: ContentComposerSubmitData) => void | Promise<void>
  onCancel?: () => void
  onDelete?: () => void
  editMode?: boolean
  /**
   * Hand off to an app-level map picker. The composer passes pick handlers: the
   * picker commits each picked position via `onPick` and restores the pre-pick
   * position via `onCancel`. The location widget shows a "pick on map" button
   * when this is provided.
   */
  requestMapPick?: (handlers: {
    onPick: (pos: { lat: number; lng: number }) => void
    onCancel?: () => void
    /** Marker = Ort-Item (B4): `true`, wenn das Ort-Feld das Item nimmt. */
    onPickItem?: (item: Item) => boolean
  }) => void
  /** Address geocoder injected into the location widget (debounced suggestions). */
  geocode?: Geocoder
  /** Reverse geocoder: fills the address field after a map pick. */
  reverseGeocode?: ReverseGeocoder
  /**
   * Geltende Zustände der Personenfelder mit Record-Kante (Event: Zusagen),
   * je Prädikat des Feldes. Fehlt der Eintrag, kann der Connector die
   * Aussagen nicht schreiben, und das Feld zeigt keine Zustände.
   */
  peopleStates?: Record<string, { live: PeopleWidgetRecord["live"] }>
  /**
   * Modul-Pick für Item-Kanten (Brett-Klick, Marker-Klick; Edit-Regeln 7):
   * Das Modul liefert ihn, das Feld zeigt dann „Im Modul wählen".
   */
  requestItemPick?: RequestItemPick
  /** Das bearbeitete Item — nie sein eigenes Ziel einer Item-Kante. */
  itemId?: string
  /** Structured people options: stores IDs, displays names. Takes precedence over peopleSuggestions. */
  peopleOptions?: PersonOption[]
  /** Simple string suggestions (legacy). Ignored when `peopleOptions` is provided. */
  peopleSuggestions?: string[] | ((query: string) => Promise<string[]>)
  tagSuggestions?: string[] | ((query: string) => Promise<string[]>)
  /** Quick-select tag suggestions shown as clickable chips below the tag input */
  tagQuickSuggestions?: string[]
  /** Quick-select people suggestions shown as clickable chips below the people input */
  peopleQuickSuggestions?: PersonOption[]
  widgets?: CustomWidgetDefinition[]
  /**
   * @deprecated Default `false` since S1 (Anton, 27.09.2026): the stack has no
   * public items, and the public/private split on the submit button promised
   * something no connector does — `isPublic` is read by no mapper. Kept for
   * callers that set it explicitly.
   */
  showVisibility?: boolean
  defaultPublic?: boolean
  showPreview?: boolean
  renderPreview?: (data: WidgetData, contentType: string) => React.ReactNode
  /** When true, every data change immediately calls onSubmit and the footer is hidden */
  liveUpdate?: boolean
  /**
   * Pin the action footer (Löschen · Abbrechen · Speichern) to the bottom of
   * the surrounding scroll area — the edit form inside the detail card
   * (shared-components, Edit-Regeln 4). The composer then fills the card's
   * height so the footer sits at the card end even for a short form.
   */
  stickyFooter?: boolean
  /** Fires on every data/type change (and on mount) — for a live preview of the
   *  in-progress item without persisting it. */
  onChange?: (submission: ContentComposerSubmitData) => void
  /** Fires when the "has unsaved content" state flips. Dirty means the content
   *  fields now differ from what they were on mount (so an untouched or fully
   *  emptied form is never dirty) — used to guard against discarding edits. */
  onDirtyChange?: (dirty: boolean) => void
  className?: string
}

// ── Constants ────────────────────────────────────────────────────────────

/**
 * Order of the widgets a type does NOT list in `defaultWidgets` (the ones a
 * user can switch on). The type's own widgets render in ITS order — the order
 * of the meta box, derived from the field and edge register (Spec 06, Regel
 * 16; shared-components, Edit-Regeln 2). Until S1 this list fixed the order
 * for every type, with `group` and `status` first.
 */
const WIDGET_ORDER: WidgetType[] = [
  "group",
  "status",
  "title",
  "text",
  "media",
  "date",
  "location",
  "people",
  "tags",
]

const DEFAULT_WIDGET_LABELS: Record<WidgetType, string> = {
  "item-relation": "Verknüpfungen",
  "item-ref": "Verweis",
  number: "Zahl",
  select: "Auswahl",
  url: "Link",
  chips: "Liste",
  contact: "Kontakt",
  avatar: "Bild",
  group: "Gruppe",
  title: "Titel",
  text: "Text",
  media: "Medien",
  date: "Datum",
  location: "Ort",
  people: "Personen",
  tags: "Tags",
  status: "Status",
}

const DEFAULT_DATA: WidgetData = {
  title: "",
  text: "",
  media: [],
  people: [],
  tags: [],
  status: "",
  group: "",
}

/**
 * Which widget a data field belongs to — used to reveal a widget initially when
 * the item already carries a value for it (so editing a task that has a date /
 * place shows those fields instead of hiding them behind the "+" toggles).
 * `status`/`group` are intentionally excluded: they are config-gated (need
 * statusOptions/groupOptions) and handled separately.
 */
const PRESENCE_WIDGET_BY_FIELD: Record<string, WidgetType> = {
  title: "title",
  text: "text",
  media: "media",
  start: "date",
  end: "date",
  rrule: "date",
  address: "location",
  locationName: "location",
  position: "location",
  meetingLink: "location",
  people: "people",
  tags: "tags",
}

/** Widgets that have a non-empty value in `data` — shown initially when present. */
function widgetsWithValue(
  data: Partial<WidgetData> | undefined,
  peopleKeys: readonly string[],
): Set<string> {
  const set = new Set<string>()
  if (!data) return set
  const hasValue = (value: unknown) => {
    if (value == null) return false
    if (typeof value === "string" && value.trim() === "") return false
    if (Array.isArray(value) && value.length === 0) return false
    return true
  }
  for (const [field, widget] of Object.entries(PRESENCE_WIDGET_BY_FIELD)) {
    if (hasValue((data as Record<string, unknown>)[field])) set.add(widget)
  }
  // Alle konfigurierten Personenfelder zeigen dasselbe Widget.
  for (const key of peopleKeys) {
    if (hasValue((data as Record<string, unknown>)[key])) set.add("people")
  }
  return set
}

/**
 * Content fields that count toward "has unsaved changes". Deliberately excludes
 * `status`/`group` — those carry config defaults (and get rewritten by the
 * type-switch effect), so including them would flag an untouched/empty form as
 * dirty. The guard is about user-entered content that would be lost.
 */
const DIRTY_FIELDS: readonly string[] = [
  "title", "text", "media", "start", "end", "rrule",
  "address", "locationName", "position", "meetingLink", "tags",
  // Personenfelder kommen aus der Typ-Konfiguration dazu (siehe dirtySignature).
]

/**
 * Stable signature of the dirty-relevant content, empties stripped. Two states
 * with the same signature are "equal" for dirtiness — so typing then clearing a
 * field, or leaving the form untouched, reads as not dirty. Fixed field order
 * keeps the JSON key order deterministic.
 */
function dirtySignature(data: WidgetData, peopleKeys: readonly string[], relationKeys: readonly string[] = []): string {
  const out: Record<string, unknown> = {}
  // Qualifier je Person zählen mit: Antippen am Chip ist eine Änderung.
  const fields = [...new Set([...DIRTY_FIELDS, ...peopleKeys.flatMap((key) => [key, peopleQualifierKey(key), peopleStatementKey(key)]), ...relationKeys])]
  for (const field of fields) {
    const value = (data as Record<string, unknown>)[field]
    if (value === "" || value === null || value === undefined) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) continue
    out[field] = value
  }
  return JSON.stringify(out)
}

/** Bearbeitbare Item-Verweise (B15) aller angebotenen Typen — auch die eines gerade nicht gewählten. */
function refKeysOf(types: readonly ContentTypeConfig[]): string[] {
  return types.flatMap((t) => (t.itemRefs ?? []).filter((r) => !r.fixed).map((r) => r.key))
}

/**
 * Ein Patch, der den Space im Kopf wechselt, nimmt im SELBEN Zustand die
 * space-lokalen Ziele heraus (`item:<id>`, Spec 04): Sie zeigten im neuen
 * Space ins Leere oder auf ein anderes Item. Space-qualifizierte Ziele
 * (`space:{id}/item:`) bleiben gültig. Betrifft alle Item-Kanten-Felder
 * (`relation:*`) und bearbeitbaren Item-Verweise, auch die eines anderen
 * Typs im Formular — ein Typwechsel hin und zurück bringt nichts Ungültiges
 * zurück. Das erste Setzen eines Space ist kein Wechsel.
 */
export function withSpaceChange(d: WidgetData, patch: Partial<WidgetData>, refKeys: readonly string[]): WidgetData {
  const next: WidgetData = { ...d, ...patch }
  const before = typeof d.group === "string" ? d.group : ""
  if (!("group" in patch) || !before || patch.group === before) return next
  // Der Auflöser sagt, was einen Space-Wechsel übersteht (04: `item:` ist space-lokal).
  const local = (t: unknown) => !survivesSpaceChange(t)
  for (const [key, value] of Object.entries(next)) {
    if (key.startsWith("relation:") && Array.isArray(value)) next[key] = value.filter((t) => !local(t))
  }
  for (const key of refKeys) if (local(next[key])) next[key] = ""
  return next
}

/**
 * Position of each built-in widget in the FORM (shared-components,
 * Edit-Regeln 2): title → description → meta fields (people → time → place →
 * values) → tags; the space (`group`) sits in the form head. Used to place widgets a user switches on at THEIR slot
 * instead of at the end (Edit-Regeln 2).
 */
const ANATOMY_RANK: Record<WidgetType, number> = {
  title: 0,
  avatar: 0.5,
  text: 1,
  media: 2,
  people: 3,
  date: 4,
  location: 5,
  "item-relation": 5.5,
  "item-ref": 5.6,
  status: 6,
  select: 6.1,
  number: 6.2,
  url: 6.3,
  chips: 6.4,
  contact: 6.5,
  tags: 7,
  group: 8,
}

/** Widgets, die nur das Register setzt: Sie stehen, wo der Typ sie führt, und sind nie zuschaltbar. */
const REGISTER_ONLY_WIDGETS: ReadonlySet<string> = new Set(["item-relation", "item-ref", "avatar", ...VALUE_WIDGETS])

/**
 * The built-in widgets in render order: those the type lists in
 * `defaultWidgets` keep that order; every other built-in is inserted before
 * the first listed widget that comes after it in the anatomy. Ids the
 * composer has no built-in for (custom widgets, or register widgets that
 * arrive with later steps) are skipped here.
 */
export function widgetRenderOrder(defaultWidgets: readonly string[]): WidgetType[] {
  const builtIn = new Set<string>([...WIDGET_ORDER, ...REGISTER_ONLY_WIDGETS])
  const order = defaultWidgets.filter((w, i): w is WidgetType => builtIn.has(w) && defaultWidgets.indexOf(w) === i)
  const extras = WIDGET_ORDER.filter((w) => !order.includes(w)).sort((a, b) => ANATOMY_RANK[a] - ANATOMY_RANK[b])
  for (const w of extras) {
    const before = order.findIndex((o) => ANATOMY_RANK[o] > ANATOMY_RANK[w])
    if (before === -1) order.push(w)
    else order.splice(before, 0, w)
  }
  return order
}

// ── Form head ────────────────────────────────────────────────────────────

/** Sichtbarer Fokus und der offene Zustand (Ring in Primärfarbe, 3 px, ~18 %) an Badge und Pille. */
const HEAD_TRIGGER =
  "rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:ring-[3px] data-[state=open]:ring-primary/20"

/** Das Menü unter Badge und Pille: weiß, Radius 12 px, weicher Schatten, 6 px Innenabstand. */
const HEAD_MENU = "rounded-xl border-border/60 p-1.5 shadow-lg"

/** Eine Menüzeile; die aktuelle hervorgehoben, halbfett, Häkchen rechts in Primärfarbe. */
const HEAD_ITEM = "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm data-[current=true]:bg-accent data-[current=true]:font-semibold"

interface ComposerHeadProps {
  types: readonly ContentTypeConfig[]
  selectedType: string
  /** Set when the type may be chosen (create with several types); otherwise the type is shown fixed. */
  onSelectType?: (id: string) => void
  space?: {
    value: string
    options: readonly GroupOption[]
    required: boolean
    fixedReason?: string
    /** Das Formular hat Beziehungen: Der Space steht fest, mit diesem Grund (Space des Formulars, Regel 5). */
    lockedReason?: string
    onChange: (id: string) => void
  }
}

/**
 * Kopf des Formulars (shared-components, Edit-Regeln 3; Design Anton
 * 27.09.2026): links in einer Zeile der Typ als Typ-Badge und der Space als
 * Pille. Wählbar öffnen beide ein Menü (DropdownMenu: Enter/Leertaste,
 * Pfeiltasten, Escape); fest ohne Chevron und ohne Schloss, ein fester Space
 * gedämpft mit dem Grund im Tooltip.
 */
function ComposerHead({ types, selectedType, onSelectType, space }: ComposerHeadProps) {
  const current = types.find((t) => t.id === selectedType) ?? types[0]
  return (
    // Eine Zeile; rechts bleibt Platz für die Knöpfe eines Panels darüber (✕).
    <div className="flex min-w-0 items-center gap-2 pr-8">
      {current && (
        <span data-slot="composer-type" className="inline-flex shrink-0">
          {onSelectType ? (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label={`Typ wählen, aktuell ${current.label}`} data-value={current.id} className={HEAD_TRIGGER}>
                <TypeBadge config={current} trailing={<ChevronDown className="h-3 w-3 opacity-80" aria-hidden />} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className={cn(HEAD_MENU, "w-[220px]")}>
                {types.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    // Auswahlzustand für Screenreader, nicht nur als Häkchen.
                    role="menuitemradio"
                    aria-checked={t.id === current.id}
                    data-current={t.id === current.id}
                    onSelect={() => onSelectType(t.id)}
                    className={HEAD_ITEM}
                  >
                    <TypeIcon config={t} />
                    <span className="flex-1">{t.label}</span>
                    {t.id === current.id && <Check className="h-4 w-4 text-primary" aria-hidden />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <TypeBadge config={current} />
          )}
        </span>
      )}
      {space && <SpacePill {...space} />}
    </div>
  )
}

/** Badge-Stil (Icon, Label, Farbe) eines Typs aus dem Register; unbekannte Typen neutral mit eigenem Label. */
function typeBadgeStyle(config: ContentTypeConfig) {
  const resolved = resolveTypePresentation(config.id)
  const badge = resolved.generic || !resolved.badge ? GENERIC_BADGE : resolved.badge
  return { icon: config.icon ?? badge.icon, className: badge.className, generic: resolved.generic }
}

/** The type as ItemTypeBadge (register colour), sized for the form head. */
function TypeBadge({ config, trailing }: { config: ContentTypeConfig; trailing?: React.ReactNode }) {
  const style = typeBadgeStyle(config)
  const override = style.generic
    ? { [config.id]: { icon: style.icon, label: config.label, className: style.className } }
    : undefined
  return (
    <ItemTypeBadge
      type={config.id}
      config={override}
      fallback
      trailing={trailing}
      className="h-6 px-2.5 text-[11.5px] font-semibold"
    />
  )
}

/** Rundes Typ-Icon im Menü: 22 px, Typ-Pastell, Rand im Typton — dieselben Farben wie das Badge. */
function TypeIcon({ config }: { config: ContentTypeConfig }) {
  const style = typeBadgeStyle(config)
  const Icon = style.icon
  return (
    <span data-slot="type-icon" className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border", style.className)}>
      <Icon className="h-3 w-3" />
    </span>
  )
}

function spaceInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]!).join("").toUpperCase().slice(0, 1) || "?"
}

/**
 * Logo-Kachel eines Space wie im Space-Wechsler: Bild, sonst die Initiale auf
 * der Space-Farbe; der persönliche Space zeigt das Haus.
 */
function SpaceLogo({ option, size = "sm" }: { option?: GroupOption; size?: "sm" | "md" }) {
  const box = size === "md" ? "h-[22px] w-[22px] rounded-[6px]" : "h-[18px] w-[18px] rounded-[5px]"
  if (option?.personal) {
    return (
      <span data-slot="space-logo" className={cn("flex shrink-0 items-center justify-center bg-primary/10 text-primary", box)}>
        <Home className="h-3 w-3" aria-hidden />
      </span>
    )
  }
  return (
    <Avatar data-slot="space-logo" className={cn("shrink-0", box)}>
      {option?.image && <AvatarImage src={option.image} alt="" className={cn("object-cover", box)} />}
      <AvatarFallback
        className={cn(box, "text-[10px] font-semibold", option?.color ? "text-background" : "bg-muted text-muted-foreground")}
        style={option?.color ? { backgroundColor: option.color } : undefined}
      >
        {option ? spaceInitials(option.name) : "?"}
      </AvatarFallback>
    </Avatar>
  )
}

function SpacePill({ value, options, required, fixedReason: fixedBy, lockedReason, onChange }: NonNullable<ComposerHeadProps["space"]>) {
  const selected = options.find((o) => o.id === value)
  // Mit Beziehungen fest wie der feste Space einer Variante (Regel 5). Ohne
  // gesetzten Space ist auch eine einzige Option zu wählen, statt als gesetzt
  // zu erscheinen (Regeln 1 und 8).
  const choosable = (options.length > 1 || (!selected && !fixedBy)) && !(lockedReason && selected)
  const fixedReason = (selected && lockedReason) || fixedBy
  const missing = required && !value
  const [query, setQuery] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)
  if (!choosable) {
    // Nur der tatsächliche Wert; ohne ihn „Space unbekannt“ (Codex R2/3).
    const only = selected
    const fixed = (
      <span
        data-slot="composer-space"
        // Mit Grund fokussierbar: Der Tooltip öffnet auch per Tastatur, und
        // der Grund steht für Screenreader im Text.
        tabIndex={fixedReason ? 0 : undefined}
        className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {only && <SpaceLogo option={only} />}
        <span className="truncate">{only?.name ?? "Space unbekannt"}</span>
        {fixedReason && <span className="sr-only">{`: ${fixedReason}`}</span>}
      </span>
    )
    if (!fixedReason) return fixed
    return (
      <Tooltip>
        <TooltipTrigger asChild>{fixed}</TooltipTrigger>
        <TooltipContent side="bottom">{fixedReason}</TooltipContent>
      </Tooltip>
    )
  }
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options
  const personal = shown.filter((o) => o.personal)
  const groups = shown.filter((o) => !o.personal)
  const row = (o: GroupOption) => (
    <DropdownMenuItem
      key={o.id}
      role="menuitemradio"
      aria-checked={o.id === value}
      data-current={o.id === value}
      onSelect={() => onChange(o.id)}
      className={HEAD_ITEM}
    >
      <SpaceLogo option={o} size="md" />
      <span data-slot="space-name" className="min-w-0 flex-1 truncate">{o.name}</span>
      {o.memberCount !== undefined && <span className="text-xs font-normal text-muted-foreground">{o.memberCount}</span>}
      {o.id === value && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
    </DropdownMenuItem>
  )
  return (
    <span data-slot="composer-space" className="inline-flex min-w-0">
      <DropdownMenu
        onOpenChange={(open) => {
          if (!open) {
            setQuery("")
            return
          }
          // Das Suchfeld bekommt beim Öffnen den Fokus, nachdem Radix ihn
          // auf Menü oder ersten Eintrag gesetzt hat: tippen filtert sofort.
          setTimeout(() => searchRef.current?.focus(), 0)
        }}
      >
        <DropdownMenuTrigger
          aria-label={selected ? `Space wählen, aktuell ${selected.name}` : "Space wählen"}
          aria-invalid={missing || undefined}
          aria-required={required || undefined}
          data-value={value}
          className={cn(
            HEAD_TRIGGER,
            "inline-flex h-7 min-w-0 items-center gap-1.5 border bg-background pl-1 pr-2.5 text-xs text-foreground",
            !selected && "pl-2.5",
            missing && "border-destructive text-destructive",
          )}
        >
          {selected && <SpaceLogo option={selected} />}
          <span className="truncate">{selected?.name ?? `Space wählen${required ? " *" : ""}`}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className={cn(HEAD_MENU, "w-[250px]")}
        >
          <input
            ref={searchRef}
            type="search"
            placeholder="Space suchen…"
            aria-label="Space suchen"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Tippen gehört dem Feld, nicht der Typeahead-Suche des Menüs;
            // Pfeiltasten und Escape bleiben beim Menü.
            onKeyDown={(e) => {
              // Pfeil runter führt in die Treffer; Escape bleibt beim Menü.
              if (e.key === "ArrowDown") {
                e.preventDefault()
                e.stopPropagation()
                e.currentTarget.closest('[role="menu"]')?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus()
                return
              }
              if (e.key !== "Escape") e.stopPropagation()
            }}
            className="mb-1 h-8 w-full rounded-lg border bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          {personal.length > 0 && (
            <>
              <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Persönlich</DropdownMenuLabel>
              {personal.map(row)}
            </>
          )}
          {groups.length > 0 && (
            <>
              <DropdownMenuLabel className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gruppen</DropdownMenuLabel>
              {groups.map(row)}
            </>
          )}
          {shown.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Kein Space gefunden</p>}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

/** Die leere Beschreibung, eingeklappt: „+ Beschreibung" und daneben die Schalter der übrigen Felder. */
function CollapsedText({
  label,
  onOpen,
  availableWidgets,
  onToggleWidget,
}: {
  label: string
  onOpen: () => void
  availableWidgets: readonly WidgetType[]
  onToggleWidget: (w: WidgetType) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        + {label}
      </button>
      <span className="ml-auto flex items-center gap-0.5">
        {availableWidgets.map((w) => {
          const Icon = WIDGET_ICONS[w]
          if (!Icon) return null
          return (
            <Button
              key={w}
              type="button"
              variant="ghost"
              size="icon-sm"
              title={WIDGET_LABELS[w]}
              onClick={() => onToggleWidget(w)}
              className="h-7 w-7 text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          )
        })}
      </span>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────

export function ContentComposer({
  contentTypes,
  initialContentType,
  mode,
  initialData,
  apiRef,
  onSubmit,
  onCancel,
  onDelete,
  stickyFooter = false,
  editMode: editModeProp,
  requestMapPick,
  geocode,
  reverseGeocode,
  peopleOptions,
  peopleStates,
  requestItemPick,
  itemId,
  peopleSuggestions,
  tagSuggestions,
  tagQuickSuggestions,
  peopleQuickSuggestions,
  widgets: customWidgets,
  showVisibility = false,
  defaultPublic = true,
  showPreview = true,
  renderPreview,
  liveUpdate = false,
  onChange,
  onDirtyChange,
  className,
}: ContentComposerProps) {
  const isEditMode = editModeProp ?? !!onDelete
  const isSingleTypeMode = !!mode

  // Resolve initial content type
  const resolvedInitialType =
    mode || initialContentType || contentTypes[0]?.id || ""

  // Der Formularzustand (shared-components → Formularzustand): der einzige
  // Besitzer der Werte, des Typs, der Epoche, der Warte-Zustände und der
  // Hinweise. Widgets erhalten daraus je einen Feldzugang, nie einen Setter.
  const contentTypesRef = React.useRef(contentTypes)
  contentTypesRef.current = contentTypes
  const refKeysRef = React.useRef(refKeysOf(contentTypes))
  const form = useFormState<WidgetData>(() => ({
    data: { ...DEFAULT_DATA, ...initialData },
    type: resolvedInitialType,
    spaceOf: (d) => (typeof d.group === "string" && d.group !== "" ? d.group : undefined),
    // Ein Space-Wechsel nimmt im selben Zustand die space-lokalen Ziele heraus.
    normalize: (d, patch) => withSpaceChange(d, patch as Partial<WidgetData>, refKeysRef.current),
    typeLabel: (type) => contentTypesRef.current.find((t) => t.id === type)?.label ?? type,
  }))
  const selectedType = form.getType()
  const setSelectedType = (type: string) => form.setType(type)

  // Current content type config (Achtung: nur eine Ableitung, kein Hook — der
  // Abbruch bei fehlendem Typ steht weiter unten, nach allen Hooks).
  const currentConfig = contentTypes.find((t) => t.id === selectedType) || contentTypes[0]
  // Personenfelder des Typs (mehrere je Typ möglich, siehe peopleRelations).
  // Welche Datenschlüssel Personen tragen, sagt die Konfiguration.
  const peopleFields = resolvePeopleFields(currentConfig ?? {})
  const peopleKeys = peopleFields.map((field) => field.dataKey)
  // Item-Kanten (C3) je Kante ein Datenschlüssel; bearbeitbare Item-Verweise (B15) dazu.
  const relationKeys = [
    ...itemRelationDataKeys(currentConfig?.itemRelations),
    ...(currentConfig?.itemRefs ?? []).filter((r) => !r.fixed).map((r) => r.key),
    // Wert-Felder (S4a) zählen für Ungespeichert und liveUpdate mit.
    // Status nicht: Sein Standardwert ist Konfiguration, keine Eingabe (DIRTY_FIELDS).
    ...(currentConfig?.valueFields ?? []).filter((v) => v.widget !== "status").map((v) => v.key),
  ]

  const data = form.getData()
  // Start with the widgets the item already has a value for, so editing reveals
  // its set fields (a task's date/place) instead of hiding them behind toggles.
  const [manualWidgets, setManualWidgets] = React.useState<Set<string>>(
    () => widgetsWithValue(initialData, peopleKeys),
  )
  // The date widget's sub-fields (end date, time, recurrence) are UI state: an
  // opened-but-empty field has no data to be derived from. See date-widget-state.
  const [dateToggles, setDateToggles] = React.useState<DateWidgetToggles>(NO_DATE_TOGGLES)
  // Imperative handle so the host can patch the open composer without remounting
  // it — e.g. update only `start` when another calendar date is clicked, keeping
  // already-entered content intact.
  const peopleKeysRef = React.useRef(peopleKeys)
  const relationKeysRef = React.useRef(relationKeys)
  React.useEffect(() => {
    peopleKeysRef.current = peopleKeys
    relationKeysRef.current = relationKeys
    refKeysRef.current = refKeysOf(contentTypes)
  })
  React.useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      patchData: (patch) => {
        form.patch(patch)
        // Reveal any widget the patch gives a value to, so a field prefilled
        // after mount (e.g. a position handed back from the map picker) isn't
        // stuck hidden behind a "+" toggle. manualWidgets is seeded only from
        // the initial data, so post-mount patches need this.
        setManualWidgets((prev) => {
          const revealed = widgetsWithValue(patch, peopleKeysRef.current)
          if ([...revealed].every((w) => prev.has(w))) return prev
          return new Set([...prev, ...revealed])
        })
      },
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef])
  const [isPublic, setIsPublic] = React.useState(defaultPublic)
  // Genau ein möglicher Space: Er steht fest im Kopf und MUSS dann auch
  // gesetzt sein — eine Anzeige, die beim Speichern nicht gilt, täuscht.
  // Genau ein möglicher Space ist beim Erstellen vorausgewählt (Space des
  // Formulars, Regel 1): Er steht fest im Kopf und gilt dann auch. Beim
  // Bearbeiten gibt allein der Space des Items vor, sonst verschöbe Speichern.
  const onlySpace = !isEditMode && currentConfig?.groupOptions?.length === 1 ? currentConfig.groupOptions[0]!.id : undefined
  React.useEffect(() => {
    if (onlySpace && !data.group) form.update((d) => (d.group ? d : { ...d, group: onlySpace }))
  }, [onlySpace, data.group])
  // Der Formular-Space (shared-components → Space des Formulars): EINE
  // Quelle, `data.group`. Suche, Vorschläge, Prüfung und Speichern lesen ihn
  // von hier, nie den geöffneten Space der App.
  const formSpace = typeof data.group === "string" && data.group !== "" ? data.group : undefined
  const spaceSources = useFormSpaceSources(formSpace)
  const effectivePeopleOptions = spaceSources?.people ?? peopleOptions
  const effectivePeopleQuick = spaceSources?.people ? spaceSources.people.slice(0, 10) : peopleQuickSuggestions
  const effectiveTagSuggestions = spaceSources?.tags ?? tagSuggestions
  const effectiveTagQuick = spaceSources?.tags ? spaceSources.tags.slice(0, 10) : tagQuickSuggestions
  // Space-Pflicht beim Anlegen (Space des Formulars, Regel 8), EIN Tor für
  // jeden Weg, der `onSubmit` erreicht: Speichern, „Erneut“ und liveUpdate
  // (#538). Beim Bearbeiten ist der Space nie Pflicht.
  const spaceUnavailable = !isEditMode && !!currentConfig?.groupUnavailableReason
  const spaceRequired = spaceUnavailable || (!isEditMode && (currentConfig?.groupOptions?.length ?? 0) > 0 && (currentConfig?.groupRequired ?? true))
  const isSpaceMissing = (d: WidgetData) => spaceUnavailable || (spaceRequired && !d.group)
  // Ein ungültiger Wert (Adresse ohne http/https, Zahl außerhalb der Grenzen,
  // kein Telefon/E-Mail) wird nie gespeichert — auch nicht per liveUpdate.
  // Ein festes Feld prüft nur das Anlegen (Vorgabe des Kontexts); beim
  // Bearbeiten bleibt der gespeicherte Wert unberührt und sperrt nichts.
  const valueErrorsOf = (d: WidgetData): Record<string, string | null> =>
    Object.fromEntries(
      (currentConfig?.valueFields ?? []).map((v) => [v.key, v.fixed && isEditMode ? null : valueFieldError(v, (d as Record<string, unknown>)[v.key])]),
    )
  const hasInvalidValues = (d: WidgetData) => Object.values(valueErrorsOf(d)).some(Boolean)
  // Wert-Felder eines anderen angebotenen Typs (nach einem Typwechsel) gehen
  // nicht mit: Sie wären weder geprüft noch nach ihrem Vertrag abgebildet.
  // Eigene Felder bleiben, auch der Status eines Typs mit `statusOptions` ohne Register.
  const ownValueKeys = new Set([
    ...(currentConfig?.valueFields ?? []).map((v) => v.key),
    ...(currentConfig?.statusOptions?.length ? ["status"] : []),
  ])
  const foreignValueKeys = [
    ...new Set(contentTypes.flatMap((t) => (t.valueFields ?? []).map((v) => v.key)).filter((k) => !ownValueKeys.has(k))),
  ]
  const submitGuarded = (submission: ContentComposerSubmitData): void | Promise<void> => {
    if (isSpaceMissing(submission.data) || hasInvalidValues(submission.data)) return
    if (foreignValueKeys.length === 0) return onSubmit(submission)
    const data = { ...submission.data }
    for (const key of foreignValueKeys) delete data[key]
    return onSubmit({ ...submission, data })
  }
  // Ein verzögerter liveUpdate prüft beim Auslösen gegen den AKTUELLEN Stand
  // (Konfiguration, Typ, Daten), nicht gegen den beim Planen (Codex zu #538).
  const liveRef = React.useRef({ submitGuarded, selectedType, isPublic, data })
  liveRef.current = { submitGuarded, selectedType, isPublic, data }
  // „+ Beschreibung" aufgeklappt? Nur UI-Zustand; mit Inhalt ist sie immer offen.
  const [textOpen, setTextOpen] = React.useState(false)
  const [isPreviewing, setIsPreviewing] = React.useState(false)

  if (!currentConfig) return null

  // Apply defaults from config on type change
  const prevTypeRef = React.useRef(selectedType)
  React.useEffect(() => {
    if (prevTypeRef.current !== selectedType) {
      prevTypeRef.current = selectedType
      // Apply default status/group when switching type
      if (currentConfig.defaultStatus && !data.status) {
        form.update((d) => ({ ...d, status: currentConfig.defaultStatus }))
      }
      if (currentConfig.defaultGroup && !data.group) {
        form.update((d) => ({ ...d, group: currentConfig.defaultGroup }))
      }
    }
  }, [selectedType, currentConfig, data.status, data.group])

  // Set defaults on mount
  React.useEffect(() => {
    form.update((d) => {
      const newStatus = d.status || currentConfig.defaultStatus || ""
      const newGroup = d.group || currentConfig.defaultGroup || ""
      if (newStatus === d.status && newGroup === d.group) return d
      return { ...d, status: newStatus, group: newGroup }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live update: submit on data change, debounced for text fields only
  const prevDataRef = React.useRef(data)
  React.useEffect(() => {
    if (prevDataRef.current === data) return
    const prev = prevDataRef.current
    prevDataRef.current = data
    if (liveUpdate) {
      const isTextOnly = prev.title !== data.title || prev.text !== data.text
      const hasNonTextChange =
        prev.status !== data.status ||
        prev.group !== data.group ||
        prev.tags !== data.tags ||
        [...peopleKeys, ...relationKeys].some(
          (key) => (prev as Record<string, unknown>)[key] !== (data as Record<string, unknown>)[key],
        ) ||
        prev.start !== data.start ||
        prev.end !== data.end ||
        prev.address !== data.address ||
        prev.locationName !== data.locationName ||
        prev.position !== data.position ||
        prev.meetingLink !== data.meetingLink ||
        prev.media !== data.media
      if (isTextOnly && !hasNonTextChange) {
        const timer = setTimeout(() => {
          const now = liveRef.current
          void Promise.resolve(now.submitGuarded({ contentType: now.selectedType, isPublic: now.isPublic, data: now.data })).catch(() => {})
        }, 300)
        return () => clearTimeout(timer)
      }
      void Promise.resolve(submitGuarded({ contentType: selectedType, isPublic, data })).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, liveUpdate])

  // Live preview: publish the current draft on every data/type change (and on
  // mount), so modules can show the in-progress item before it's saved.
  React.useEffect(() => {
    onChange?.({ contentType: selectedType, isPublic, data })
  }, [onChange, selectedType, isPublic, data])

  // Dirty tracking: compare the live content signature against the mount-time
  // baseline. Baseline is captured once (lazily) from the initial data — so a
  // prefilled create (e.g. a position handed in) only goes dirty once the user
  // changes something, and an emptied form goes back to clean.
  const dirtyBaselineRef = React.useRef<string | null>(null)
  if (dirtyBaselineRef.current === null) {
    dirtyBaselineRef.current = dirtySignature({ ...DEFAULT_DATA, ...initialData }, peopleKeys, relationKeys)
  }
  React.useEffect(() => {
    onDirtyChange?.(dirtySignature(data, peopleKeysRef.current, relationKeysRef.current) !== dirtyBaselineRef.current)
  }, [onDirtyChange, data])

  // Auf dem Telefon oeffnet ein Autofokus die Tastatur und schiebt den Kopf des
  // Formulars (Typ, Gruppe) aus dem Bild. Dort ist der Typ die erste
  // Entscheidung, nicht der Titel — die Tastatur kommt, wenn jemand tippt.
  // Der Hook antwortet schon im ersten Render und bleibt aktuell: Wer die
  // Breite beim Einhaengen einfriert, haengt nach einem Groessenwechsel den
  // Edit-Widgets den alten Wert an (rls#481).
  const imDrawer = useIsCompact()

  // Active widgets = defaults + manually added
  const defaultWidgets = new Set(currentConfig.defaultWidgets)
  const activeWidgets = new Set([...defaultWidgets, ...manualWidgets])

  // Widgets that require config and should be hidden when config is missing
  const hasStatusOptions = currentConfig.statusOptions && currentConfig.statusOptions.length > 0
  const hasGroupOptions = currentConfig.groupOptions && currentConfig.groupOptions.length > 0

  // Group: im Edit-Modus automatisch aktiv wenn ≥2 Options, sonst nur als Toggle
  if (hasGroupOptions && isEditMode && currentConfig.groupOptions!.length >= 2) {
    activeWidgets.add("group")
  }

  // Die Kante, die das Ort-Feld schreibt (B4), wenn der Typ eine führt.
  const placeField = currentConfig.itemRelations?.find((f) => f.location)

  // Render order: the type's widgets in its own order, the rest at their
  // place in the form. The space is rendered in the form head, not here.
  const renderOrder = widgetRenderOrder(currentConfig.defaultWidgets).filter((w) => w !== "group")

  // Die Beschreibung ist eingeklappt, wenn sie leer ist — aber nur, wo es
  // einen Titel gibt; beim Beitrag IST der Text der Inhalt (Edit-Regeln 2).
  const textCollapsed = !textOpen && !data.text?.trim() && activeWidgets.has("title")

  // Widgets available to toggle on (not active, not title/text, not status
  // without config; the space lives in the form head, never as a toggle)
  const toggleableWidgets = renderOrder.filter(
    (w) =>
      !activeWidgets.has(w) &&
      !REGISTER_ONLY_WIDGETS.has(w) &&
      w !== "title" &&
      w !== "text" &&
      !(w === "status" && !hasStatusOptions),
  ) as Exclude<WidgetType, "item-relation" | "item-ref" | "number" | "select" | "url" | "chips" | "contact" | "avatar">[]

  // Get widget label
  const getWidgetLabel = (widgetId: string): string => {
    return (
      currentConfig.widgetLabels?.[widgetId] ||
      DEFAULT_WIDGET_LABELS[widgetId as WidgetType] ||
      widgetId
    )
  }

  // Schreiben des Composers selbst (Kopf, @-Erwähnung, #Tag) — nie an Widgets
  // gegeben; Widgets schreiben nur über ihren Feldzugang.
  const updateData = <K extends keyof WidgetData>(key: K, value: WidgetData[K]) => {
    form.patch({ [key]: value })
  }

  // Toggle a manual widget
  const toggleWidget = (widgetId: WidgetType) => {
    setManualWidgets((prev) => {
      const next = new Set(prev)
      if (next.has(widgetId)) {
        next.delete(widgetId)
      } else {
        next.add(widgetId)
      }
      return next
    })
  }

  // Handle @mention in text
  const handleMention = (name: string) => {
    if (!activeWidgets.has("people")) {
      setManualWidgets((prev) => new Set([...prev, "people"]))
    }
    // @mention landet im ersten Personenfeld des Typs — gegen den Wert JETZT,
    // nicht gegen den Render, in dem der Rückruf entstand.
    const key = peopleFields[0].dataKey
    const current = asStrings(form.getData()[key])
    if (!current.includes(name)) {
      updateData(key, [...current, name])
    }
  }

  // Handle #tag in text
  const handleHashtag = (tag: string) => {
    if (!activeWidgets.has("tags")) {
      setManualWidgets((prev) => new Set([...prev, "tags"]))
    }
    const tags = asStrings(form.getData().tags)
    if (!tags.includes(tag)) {
      updateData("tags", [...tags, tag])
    }
  }

  // Beziehungen im Formular (Regel 5): eine gewählte Item-Kante (auch
  // „Braucht") oder ein bearbeitbarer Item-Verweis hält den Space fest; eine
  // entfernte eingehende Quelle nicht.
  const choiceKeys = [
    ...itemRelationChoiceKeys(currentConfig?.itemRelations),
    ...(currentConfig?.itemRefs ?? []).filter((r) => !r.fixed).map((r) => r.key),
  ]
  const formHasItemBinding = choiceKeys.some((key) => {
    const value = (data as Record<string, unknown>)[key]
    return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value !== ""
  })
  // Pflicht nur beim Anlegen (Regel 8): ohne Space kein Speichern.
  const spaceMissing = isSpaceMissing(data)

  // Submit
  const hasContent = !!(data.title?.trim() || data.text?.trim() || (data.media && data.media.length > 0))
  const valueErrors = valueErrorsOf(data)
  const canSubmit = !spaceMissing && hasContent && !Object.values(valueErrors).some(Boolean)
  // Wer den Kontakt sieht (B12): die Mitglieder des Formular-Space.
  const formSpaceOption = currentConfig.groupOptions?.find((o) => o.id === data.group)
  const contactVisibility = formSpaceOption
    ? formSpaceOption.personal
      ? "Nur für dich sichtbar (Privat)"
      : `Sichtbar für alle in ${formSpaceOption.name}`
    : undefined
  // Wert-Felder stehen im Formular in Register-Reihenfolge an der Stelle des
  // ersten Wert-Widgets; nur benachbarte Zahlen mit gleicher Beschriftung
  // teilen eine Gruppe (B7).
  // Der Status gehört dazu, wenn das Register ihn führt (Reihenfolge, Regel 16).
  const statusInValues = (currentConfig.valueFields ?? []).some((v) => v.widget === "status")
  const firstValueWidget = renderOrder.find((w) => VALUE_WIDGETS.has(w) || (statusInValues && w === "status"))
  const chipSuggestions = (field: ValueFieldConfig): string[] => {
    const own = field.suggestions ?? []
    const fromSpace = (spaceSources?.items ?? []).flatMap((i) => chipValues((i.data as Record<string, unknown> | undefined)?.[field.key]))
    return [...new Set([...own, ...fromSpace])]
  }

  const [submitting, setSubmitting] = React.useState(false)
  // Fehler beim Speichern: Banner unter dem Kopf; `reason` ist der Grund des
  // Connectors, wenn er einen liefert (Error.cause).
  const [submitError, setSubmitError] = React.useState<{ reason?: string } | null>(null)

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitGuarded({ contentType: selectedType, isPublic, data })
    } catch (err) {
      // Grund des Connectors: `reason` oder `cause` am Fehler (ohne es2022-Typen).
      const carrier = (err ?? {}) as { reason?: unknown; cause?: unknown }
      const cause = carrier.reason ?? carrier.cause
      const reason = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : undefined
      setSubmitError(reason ? { reason } : {})
    } finally {
      setSubmitting(false)
    }
  }

  // Submit label
  const submitLabel = isEditMode
    ? currentConfig.editLabel || "Speichern"
    : currentConfig.submitLabel || "Erstellen"

  // ── Render ──

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Kopf des Formulars: Typ und Space, kompakt als Auswahlfelder
          (shared-components, Edit-Regeln 2). Der Space steht oben, weil er
          Sichtbarkeit, Personen- und Tag-Vorschläge bestimmt. */}
      <ComposerHead
        types={contentTypes}
        selectedType={selectedType}
        onSelectType={!isSingleTypeMode && contentTypes.length > 1 ? setSelectedType : undefined}
        space={
          hasGroupOptions
            ? {
                value: data.group || "",
                options: currentConfig.groupOptions!,
                required: spaceRequired,
                fixedReason: currentConfig.groupFixedReason,
                ...(formHasItemBinding ? { lockedReason: ITEM_BINDINGS_REASON } : {}),
                onChange: (v) => updateData("group", v),
              }
            : undefined
        }
      />

      {submitError && <SaveErrorBanner reason={submitError.reason} onRetry={() => void handleSubmit()} busy={submitting} />}
      {/* Nicht übernommene Ergebnisse von Feldern, die es im aktuellen Typ nicht gibt (Formularzustand, Regel 10). */}
      {form.formNotices().map((notice) => (
        <FieldNotice key={notice.id} text={notice.text} onDismiss={notice.dismiss} />
      ))}
      {/* Ohne Space wird nichts angelegt — auch nicht per liveUpdate (#538). Sichtbar, sobald es etwas zu speichern gäbe. */}
      {spaceMissing && hasContent && (
        <p data-space-required role="status" className="text-xs text-destructive">
          {currentConfig.groupUnavailableReason && !isEditMode ? currentConfig.groupUnavailableReason : "Erst einen Space wählen – vorher wird nichts gespeichert."}
        </p>
      )}

      {/* Preview or Edit mode. Die Vorschau baut keine Felder ab: Laufende
          Arbeit bleibt (Formularzustand, Regel 8). */}
      {isPreviewing && form.keepFields()}
      {isPreviewing ? (
        <div
          className="min-h-[200px] rounded-md border p-4"
          style={{
            opacity: 1,
            transition: "opacity 150ms ease-out",
          }}
        >
          {renderPreview ? (
            renderPreview(data, selectedType)
          ) : (
            <DefaultPreview data={data} activeWidgets={activeWidgets} config={currentConfig} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Render widgets in the type's order (register), then the rest.
              Nur aktive Felder bekommen einen Feldzugang: Ein Feld, das nicht
              dasteht, gibt es für den Formularzustand nicht (Regeln 8, 10). */}
          {renderOrder.map((widgetId) => {
            const isActive = activeWidgets.has(widgetId)
            if (!isActive) return null
            const isDefault = defaultWidgets.has(widgetId)
            const widgetLabel = getWidgetLabel(widgetId)
            const text = (key: string, label: string, locked?: boolean) => form.field<string>(key, scalarField(key, label, asString, { locked }))

            return (
              <WidgetWrapper key={widgetId} visible>
                <div className="relative">
                  {/* Remove button for non-default widgets */}
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => toggleWidget(widgetId)}
                      className="absolute right-0 top-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      title="Entfernen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Widget content. Der Space (`group`) steht im Kopf. */}
                  {widgetId === "title" && (
                    <SyncField field={text("title", widgetLabel)}>
                      {(f) => <TitleWidget value={f.value} onChange={f.set} label={widgetLabel} autoFocus={!data.title && !imDrawer} />}
                    </SyncField>
                  )}
                  {widgetId === "avatar" && (
                    <div className="flex flex-col gap-4">
                      {(currentConfig.valueFields ?? [])
                        .filter((field) => field.widget === "avatar")
                        .map((field) => (
                          <AvatarField key={field.key} label={field.label} field={text(field.key, field.label, field.fixed)} />
                        ))}
                    </div>
                  )}
                  {widgetId === "text" && textCollapsed && (
                    <CollapsedText
                      label={widgetLabel}
                      onOpen={() => setTextOpen(true)}
                      availableWidgets={toggleableWidgets}
                      onToggleWidget={toggleWidget}
                    />
                  )}
                  {widgetId === "text" && !textCollapsed && (
                    <SyncField field={text("text", widgetLabel)}>
                      {(f) => (
                        <TextWidget
                          value={f.value}
                          onChange={f.set}
                          label={widgetLabel}
                          availableWidgets={toggleableWidgets}
                          onToggleWidget={toggleWidget}
                          onMention={handleMention}
                          onHashtag={handleHashtag}
                          autoFocus={!activeWidgets.has("title") && !imDrawer}
                        />
                      )}
                    </SyncField>
                  )}
                  {widgetId === "media" && (
                    <SyncField field={form.field<MediaFile[]>("media", scalarField("media", widgetLabel, (raw) => (Array.isArray(raw) ? (raw as MediaFile[]) : [])))}>
                      {(f) => <MediaWidget value={f.value} onChange={f.set} label={widgetLabel} />}
                    </SyncField>
                  )}
                  {widgetId === "date" && (
                    <SyncField
                      field={form.field<DateRange>("date", {
                        label: widgetLabel,
                        keys: ["start", "end", "rrule"],
                        read: (d) => dateWidgetValue(d as WidgetData, dateToggles),
                        write: (v) => dateWidgetPatch(v),
                      })}
                    >
                      {(f) => (
                        <DateWidget
                          value={f.value}
                          onChange={(v) => {
                            // Remember which sub-fields are open *before* writing the
                            // data: opening "Enddatum" produces no value yet, and a
                            // purely data-derived toggle would close it again.
                            setDateToggles(dateWidgetToggles(v))
                            f.set(v)
                          }}
                          label={widgetLabel}
                        />
                      )}
                    </SyncField>
                  )}
                  {widgetId === "location" && (
                    // EIN Ort-Feld (B4): Ort-Item ODER Adresse und Position.
                    <LocationField
                      label={widgetLabel}
                      field={form.field("location", locationField(widgetLabel, placeField ? itemRelationDataKey(placeField.predicate) : undefined))}
                      geocode={geocode}
                      reverseGeocode={reverseGeocode}
                      requestMapPick={requestMapPick}
                      placeField={placeField}
                      spaceId={formSpace}
                      itemId={itemId}
                    />
                  )}
                  {widgetId === "status" &&
                    !statusInValues &&
                    currentConfig.statusOptions &&
                    currentConfig.statusOptions.length > 0 && (
                      <SyncField field={text("status", widgetLabel)}>
                        {(f) => (
                          <StatusWidget
                            value={f.value}
                            onChange={f.set}
                            label={widgetLabel}
                            options={currentConfig.statusOptions!}
                            typeTone={typeBadgeStyle(currentConfig).className}
                          />
                        )}
                      </SyncField>
                    )}
                  {widgetId === "people" && (
                    <div className="flex flex-col gap-4">
                      {peopleFields.map((field) => (
                        <PeopleWidget
                          key={field.dataKey}
                          field={form.field(
                            field.dataKey,
                            peopleField(field.label, {
                              people: field.dataKey,
                              qualifiers: peopleQualifierKey(field.dataKey),
                              changes: peopleStatementKey(field.dataKey),
                            }),
                          )}
                          // `resolvePeopleFields` hat `widgetLabels.people` für
                          // die Einzahl-Kurzform schon eingesetzt; deklarierte
                          // `peopleRelations`-Labels gewinnen.
                          label={field.label}
                          options={effectivePeopleOptions}
                          suggestions={peopleSuggestions}
                          quickSuggestions={effectivePeopleQuick}
                          placeholder={field.placeholder}
                          {...(field.record && field.predicate && peopleStates?.[field.predicate]
                            ? {
                                record: {
                                  base: field.record.base,
                                  values: field.record.values,
                                  live: peopleStates[field.predicate].live,
                                },
                              }
                            : {})}
                          {...(field.qualifier ? { qualifier: field.qualifier } : {})}
                        />
                      ))}
                    </div>
                  )}
                  {widgetId === "item-relation" && (
                    <div className="flex flex-col gap-4">
                      {(currentConfig.itemRelations ?? []).filter((field) => !field.location).map((field) =>
                        field.incoming ? (
                          // „Braucht": die Kante liegt am anderen Item (S3b).
                          <IncomingRelationField
                            key={`in:${field.predicate}`}
                            label={field.label}
                            predicate={field.predicate}
                            targetType={field.targetType}
                            placeholder={field.placeholder}
                            itemId={itemId}
                            spaceId={formSpace}
                            field={form.field(
                              itemRelationDataKey(field.predicate, true),
                              incomingField(field.label, { added: itemRelationDataKey(field.predicate, true), removed: incomingRemovedKey(field.predicate) }),
                            )}
                            requestItemPick={requestItemPick}
                          />
                        ) : (
                          <ItemRelationWidget
                            key={field.predicate}
                            label={field.label}
                            predicate={field.predicate}
                            targetType={field.targetType}
                            placeholder={field.placeholder}
                            field={form.field(itemRelationDataKey(field.predicate), scalarField(itemRelationDataKey(field.predicate), field.label, asStrings))}
                            excludeId={itemId}
                            spaceId={formSpace}
                            requestItemPick={requestItemPick}
                          />
                        ),
                      )}
                    </div>
                  )}
                  {widgetId === "item-ref" && (
                    <div className="flex flex-col gap-4">
                      {(currentConfig.itemRefs ?? []).map((field) => {
                        const value = typeof data[field.key] === "string" ? (data[field.key] as string) : ""
                        if (field.fixed) {
                          // Fest: nur mit Wert sichtbar (06, Regel 14).
                          return value ? <FixedItemRefField key={field.key} label={field.label} value={value} missing={field.missing} targetType={field.targetType} spaceId={formSpace} /> : null
                        }
                        return (
                          <ItemRelationWidget
                            key={field.key}
                            single
                            label={field.label}
                            predicate={field.key}
                            targetType={field.targetType}
                            field={form.field(field.key, itemRefField(field.key, field.label))}
                            excludeId={itemId}
                            spaceId={formSpace}
                          />
                        )
                      })}
                    </div>
                  )}
                  {widgetId === firstValueWidget && (
                    <div className="flex flex-col gap-4">
                      {groupNumberFields((currentConfig.valueFields ?? []).filter((v) => v.widget !== "avatar")).map((group) => {
                        const field = group[0]!
                        switch (field.widget) {
                          case "number": {
                            // Je Zahl ein Feld mit seinem Schlüssel; die Gruppe ist nur die Anzeige.
                            const fields = new Map(group.map((g) => [g.key, text(g.key, g.label, g.fixed)] as const))
                            return (
                              <NumberGroupField
                                key={field.key}
                                label={field.label}
                                fields={group}
                                values={Object.fromEntries([...fields].map(([key, f]) => [key, f.value]))}
                                errors={valueErrors}
                                onChange={(key, v) => fields.get(key)?.set(v)}
                              />
                            )
                          }
                          case "status":
                            return currentConfig.statusOptions?.length ? (
                              <SyncField key={field.key} field={text("status", getWidgetLabel("status"))}>
                                {(f) => (
                                  <StatusWidget
                                    value={f.value}
                                    onChange={f.set}
                                    label={getWidgetLabel("status")}
                                    options={currentConfig.statusOptions!}
                                    typeTone={typeBadgeStyle(currentConfig).className}
                                  />
                                )}
                              </SyncField>
                            ) : null
                          case "select":
                            return (
                              <SyncField key={field.key} field={text(field.key, field.label, field.fixed)}>
                                {(f) => (
                                  <OptionField
                                    label={field.label}
                                    options={field.options ?? []}
                                    value={f.value}
                                    onChange={f.set}
                                    allowClear
                                    disabled={f.locked}
                                    typeTone={typeBadgeStyle(currentConfig).className}
                                  />
                                )}
                              </SyncField>
                            )
                          case "url":
                            return (
                              <SyncField key={field.key} field={text(field.key, field.label, field.fixed)}>
                                {(f) => <UrlField label={field.label} value={f.value} onChange={f.set} error={valueErrors[field.key] ?? null} disabled={f.locked} />}
                              </SyncField>
                            )
                          case "chips":
                            return (
                              <SyncField key={field.key} field={form.field<string[]>(field.key, scalarField(field.key, field.label, chipValues, { locked: field.fixed }))}>
                                {(f) => <ChipsField label={field.label} value={f.value} onChange={f.set} suggestions={chipSuggestions(field)} disabled={f.locked} />}
                              </SyncField>
                            )
                          case "contact":
                            return (
                              <SyncField key={field.key} field={text(field.key, field.label, field.fixed)}>
                                {(f) => (
                                  <ContactField
                                    label={field.label}
                                    value={f.value}
                                    onChange={f.set}
                                    error={valueErrors[field.key] ?? null}
                                    visibility={contactVisibility}
                                    disabled={f.locked}
                                  />
                                )}
                              </SyncField>
                            )
                        }
                      })}
                    </div>
                  )}
                  {widgetId === "tags" && (
                    <TagsWidget
                      field={form.field("tags", scalarField("tags", widgetLabel, asStrings))}
                      label={widgetLabel}
                      suggestions={effectiveTagSuggestions}
                      quickSuggestions={effectiveTagQuick}
                      {...(spaceSources?.tagsUnavailable ? { hint: "Keine Vorschläge: Dieser Speicher liest nur Tags des geöffneten Space" } : {})}
                    />
                  )}
                </div>
              </WidgetWrapper>
            )
          })}

          {/* Custom widgets */}
          {customWidgets?.map((cw) => {
            const isActive = activeWidgets.has(cw.id)
            if (!isActive) return null
            const isDefault = defaultWidgets.has(cw.id)
            const CustomComponent = cw.component
            const label = currentConfig.widgetLabels?.[cw.id] || cw.label
            return (
              <WidgetWrapper key={cw.id} visible>
                <div className="relative">
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualWidgets((prev) => {
                          const next = new Set(prev)
                          next.has(cw.id) ? next.delete(cw.id) : next.add(cw.id)
                          return next
                        })
                      }}
                      className="absolute right-0 top-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      title="Entfernen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Ein eigenes Widget schreibt genau seinen Schlüssel, über den Schreibweg seines Felds. */}
                  <SyncField field={form.field<unknown>(cw.id, scalarField(cw.id, label, (raw) => raw))}>
                    {(f) => <CustomComponent value={f.value} onChange={f.set} label={label} />}
                  </SyncField>
                </div>
              </WidgetWrapper>
            )
          })}
        </div>
      )}


      {/* Footer: actions (hidden in liveUpdate mode) */}
      {!liveUpdate && <div
        data-slot="edit-footer"
        className={cn(
          "flex items-center justify-between pt-1",
          stickyFooter && "sticky bottom-0 z-10 -mx-4 mt-auto border-t bg-card px-4 py-3",
        )}
      >
        <div className="flex items-center gap-2">
          {/* Delete button (edit mode only) */}
          {isEditMode && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              // Schmal gehalten: Auf dem Telefon (390 px) passen Löschen,
              // Abbrechen und der Speichern-Split sonst nicht in eine Zeile.
              className="gap-1.5 px-2 has-[>svg]:px-1.5 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Löschen
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" className="px-2" onClick={onCancel}>
              Abbrechen
            </Button>
          )}
          {/* Preview toggle */}
          {showPreview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsPreviewing(!isPreviewing)}
            >
              {isPreviewing ? "Bearbeiten" : "Vorschau"}
            </Button>
          )}
          {/* Split-Button: Submit + Visibility */}
          {showVisibility ? (
            <div className="flex items-center">
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                aria-busy={submitting}
                className="gap-1.5 rounded-r-none has-[>svg]:px-2"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : isPublic ? (
                  <Globe className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {submitLabel}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-l-none border-l border-l-primary-foreground/20 px-1.5"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsPublic(true)}>
                    <Globe className="h-3.5 w-3.5" />
                    Oeffentlich
                    {isPublic && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsPublic(false)}>
                    <Lock className="h-3.5 w-3.5" />
                    Privat
                    {!isPublic && <span className="ml-auto text-xs">✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Button type="button" size="sm" onClick={handleSubmit} disabled={!canSubmit || submitting} aria-busy={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {submitLabel}
            </Button>
          )}
        </div>
      </div>}
    </div>
  )
}

/** Bindet ein Widget ohne eigene Arbeit an seinen Feldzugang: Wert und Schreibweg für Eingaben. */
function SyncField<V, C>({ field, children }: { field: FieldAccess<V, C>; children: (field: FieldAccess<V, C>) => React.ReactNode }) {
  return <>{children(field)}</>
}

// ── Default Preview ──────────────────────────────────────────────────────

function DefaultPreview({
  data,
  activeWidgets,
  config,
}: {
  data: WidgetData
  activeWidgets: Set<string>
  config: ContentTypeConfig
}) {
  const has = (w: string) => activeWidgets.has(w)

  const statusLabel = has("status") && data.status
    ? config.statusOptions?.find((o) => o.id === data.status)?.label
    : undefined

  const groupLabel = has("group") && data.group
    ? config.groupOptions?.find((o) => o.id === data.group)?.name
    : undefined

  return (
    <div className="space-y-3">
      {(groupLabel || statusLabel) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {groupLabel && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
              {groupLabel}
            </span>
          )}
          {statusLabel && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {statusLabel}
            </span>
          )}
        </div>
      )}
      {has("title") && data.title && (
        <h2 className="text-xl font-bold">{data.title}</h2>
      )}
      {has("text") && data.text && (
        <div className="whitespace-pre-wrap text-sm">{data.text}</div>
      )}
      {has("media") && data.media && data.media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {data.media.map((file) => (
            <img
              key={file.id}
              src={file.url}
              alt={file.name}
              className="aspect-square rounded-md object-cover"
            />
          ))}
        </div>
      )}
      {has("date") && data.start && (
        <div className="text-sm text-muted-foreground">
          {toDateInputValue(data.start)}
          {data.end && ` — ${toDateInputValue(data.end)}`}
        </div>
      )}
      {has("location") && (data.address || data.locationName || data.meetingLink) && (
        <div className="text-sm text-muted-foreground">
          {data.locationName || data.address || data.meetingLink}
        </div>
      )}
      {has("people") &&
        resolvePeopleFields(config).map((field) => {
          const people = (data[field.dataKey] as string[] | undefined) ?? []
          if (people.length === 0) return null
          return (
            <div key={field.dataKey} className="flex flex-wrap gap-1">
              {people.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                >
                  {p}
                </span>
              ))}
            </div>
          )
        })}
      {has("tags") && data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
