"use client"

import * as React from "react"
import { Check, ChevronDown, Globe, Home, Loader2, Lock, Trash2, X } from "lucide-react"
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
import { latLngFromPoint, pointFromLatLng, type GeoJSONPoint } from "@/lib/geo"
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
import { LocationWidget } from "./widgets/location-widget"
import type { Geocoder, ReverseGeocoder } from "@/lib/geocode"
import { MediaWidget } from "./widgets/media-widget"
import { PeopleWidget, type PersonOption } from "./widgets/people-widget"
export type { PersonOption } from "./widgets/people-widget"
import { peopleQualifierKey, resolvePeopleFields, type PeopleRelationConfig } from "./people-relations"
export type { PeopleRelationConfig } from "./people-relations"
import { TagsWidget } from "./widgets/tags-widget"
import { StatusWidget } from "./widgets/status-widget"

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

export interface ContentComposerSubmitData {
  contentType: string
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
  }) => void
  /** Address geocoder injected into the location widget (debounced suggestions). */
  geocode?: Geocoder
  /** Reverse geocoder: fills the address field after a map pick. */
  reverseGeocode?: ReverseGeocoder
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
function dirtySignature(data: WidgetData, peopleKeys: readonly string[]): string {
  const out: Record<string, unknown> = {}
  // Qualifier je Person zählen mit: Antippen am Chip ist eine Änderung.
  const fields = [...new Set([...DIRTY_FIELDS, ...peopleKeys.flatMap((key) => [key, peopleQualifierKey(key)])])]
  for (const field of fields) {
    const value = (data as Record<string, unknown>)[field]
    if (value === "" || value === null || value === undefined) continue
    if (Array.isArray(value) && value.length === 0) continue
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) continue
    out[field] = value
  }
  return JSON.stringify(out)
}

/**
 * Position of each built-in widget in the FORM (shared-components,
 * Edit-Regeln 2): title → description → meta fields (people → time → place →
 * values) → tags; the space (`group`) sits in the form head. Used to place widgets a user switches on at THEIR slot
 * instead of at the end (Edit-Regeln 2).
 */
const ANATOMY_RANK: Record<WidgetType, number> = {
  title: 0,
  text: 1,
  media: 2,
  people: 3,
  date: 4,
  location: 5,
  status: 6,
  tags: 7,
  group: 8,
}

/**
 * The built-in widgets in render order: those the type lists in
 * `defaultWidgets` keep that order; every other built-in is inserted before
 * the first listed widget that comes after it in the anatomy. Ids the
 * composer has no built-in for (custom widgets, or register widgets that
 * arrive with later steps) are skipped here.
 */
export function widgetRenderOrder(defaultWidgets: readonly string[]): WidgetType[] {
  const builtIn = new Set<string>(WIDGET_ORDER)
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

function SpacePill({ value, options, required, fixedReason, onChange }: NonNullable<ComposerHeadProps["space"]>) {
  const selected = options.find((o) => o.id === value)
  const choosable = options.length > 1
  const missing = required && !value
  const [query, setQuery] = React.useState("")
  const searchRef = React.useRef<HTMLInputElement>(null)
  if (!choosable) {
    const only = selected ?? options[0]
    const fixed = (
      <span
        data-slot="composer-space"
        // Mit Grund fokussierbar: Der Tooltip öffnet auch per Tastatur, und
        // der Grund steht für Screenreader im Text.
        tabIndex={fixedReason ? 0 : undefined}
        className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <SpaceLogo option={only} />
        <span className="truncate">{only?.name}</span>
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

  const [selectedType, setSelectedType] = React.useState(resolvedInitialType)

  // Current content type config (Achtung: nur eine Ableitung, kein Hook — der
  // Abbruch bei fehlendem Typ steht weiter unten, nach allen Hooks).
  const currentConfig = contentTypes.find((t) => t.id === selectedType) || contentTypes[0]
  // Personenfelder des Typs (mehrere je Typ möglich, siehe peopleRelations).
  // Welche Datenschlüssel Personen tragen, sagt die Konfiguration.
  const peopleFields = resolvePeopleFields(currentConfig ?? {})
  const peopleKeys = peopleFields.map((field) => field.dataKey)

  const [data, setData] = React.useState<WidgetData>(() => ({
    ...DEFAULT_DATA,
    ...initialData,
  }))
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
  React.useEffect(() => {
    peopleKeysRef.current = peopleKeys
  })
  React.useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      patchData: (patch) => {
        setData((d) => ({ ...d, ...patch }))
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
  const onlySpace = currentConfig?.groupOptions?.length === 1 ? currentConfig.groupOptions[0]!.id : undefined
  React.useEffect(() => {
    if (onlySpace && !data.group) setData((d) => (d.group ? d : { ...d, group: onlySpace }))
  }, [onlySpace, data.group])
  // „+ Beschreibung" aufgeklappt? Nur UI-Zustand; mit Inhalt ist sie immer offen.
  const [textOpen, setTextOpen] = React.useState(false)
  const [isPreviewing, setIsPreviewing] = React.useState(false)
  // Aborts the previous reverse-geocode when the user re-picks on the map.
  const reverseAbortRef = React.useRef<AbortController | null>(null)

  if (!currentConfig) return null

  // Apply defaults from config on type change
  const prevTypeRef = React.useRef(selectedType)
  React.useEffect(() => {
    if (prevTypeRef.current !== selectedType) {
      prevTypeRef.current = selectedType
      // Apply default status/group when switching type
      if (currentConfig.defaultStatus && !data.status) {
        setData((d) => ({ ...d, status: currentConfig.defaultStatus }))
      }
      if (currentConfig.defaultGroup && !data.group) {
        setData((d) => ({ ...d, group: currentConfig.defaultGroup }))
      }
    }
  }, [selectedType, currentConfig, data.status, data.group])

  // Set defaults on mount
  React.useEffect(() => {
    setData((d) => {
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
        peopleKeys.some(
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
          void Promise.resolve(onSubmit({ contentType: selectedType, isPublic, data })).catch(() => {})
        }, 300)
        return () => clearTimeout(timer)
      }
      void Promise.resolve(onSubmit({ contentType: selectedType, isPublic, data })).catch(() => {})
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
    dirtyBaselineRef.current = dirtySignature({ ...DEFAULT_DATA, ...initialData }, peopleKeys)
  }
  React.useEffect(() => {
    onDirtyChange?.(dirtySignature(data, peopleKeysRef.current) !== dirtyBaselineRef.current)
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
      w !== "title" &&
      w !== "text" &&
      !(w === "status" && !hasStatusOptions),
  ) as WidgetType[]

  // Get widget label
  const getWidgetLabel = (widgetId: string): string => {
    return (
      currentConfig.widgetLabels?.[widgetId] ||
      DEFAULT_WIDGET_LABELS[widgetId as WidgetType] ||
      widgetId
    )
  }

  // Update a specific data field
  const updateData = <K extends keyof WidgetData>(
    key: K,
    value: WidgetData[K],
  ) => {
    setData((d) => ({ ...d, [key]: value }))
  }

  // Multi-field patch (used by widgets that map to several spec fields)
  const updateMany = (patch: Partial<WidgetData>) => {
    setData((d) => ({ ...d, ...patch }))
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
    // @mention landet im ersten Personenfeld des Typs.
    const key = peopleFields[0].dataKey
    const current = (data[key] as string[] | undefined) || []
    if (!current.includes(name)) {
      updateData(key, [...current, name])
    }
  }

  // Handle #tag in text
  const handleHashtag = (tag: string) => {
    if (!activeWidgets.has("tags")) {
      setManualWidgets((prev) => new Set([...prev, "tags"]))
    }
    if (!data.tags?.includes(tag)) {
      updateData("tags", [...(data.tags || []), tag])
    }
  }

  // Submit
  const canSubmit = !!(data.title?.trim() || data.text?.trim() || (data.media && data.media.length > 0))

  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({ contentType: selectedType, isPublic, data })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.")
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
                required: currentConfig.groupRequired ?? true,
                fixedReason: currentConfig.groupFixedReason,
                onChange: (v) => updateData("group", v),
              }
            : undefined
        }
      />

      {/* Preview or Edit mode */}
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
          {/* Render widgets in the type's order (register), then the rest */}
          {renderOrder.map((widgetId) => {
            const isActive = activeWidgets.has(widgetId)
            const isDefault = defaultWidgets.has(widgetId)
            const widgetLabel = getWidgetLabel(widgetId)

            return (
              <WidgetWrapper key={widgetId} visible={isActive}>
                <div className="relative">
                  {/* Remove button for non-default widgets */}
                  {!isDefault && isActive && (
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
                    <TitleWidget
                      value={data.title || ""}
                      onChange={(v) => updateData("title", v)}
                      label={widgetLabel}
                      autoFocus={!data.title && !imDrawer}
                    />
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
                    <TextWidget
                      value={data.text || ""}
                      onChange={(v) => updateData("text", v)}
                      label={widgetLabel}
                      availableWidgets={toggleableWidgets}
                      onToggleWidget={toggleWidget}
                      onMention={handleMention}
                      onHashtag={handleHashtag}
                      autoFocus={!activeWidgets.has("title") && !imDrawer}
                    />
                  )}
                  {widgetId === "media" && (
                    <MediaWidget
                      value={data.media || []}
                      onChange={(v) => updateData("media", v)}
                      label={widgetLabel}
                    />
                  )}
                  {widgetId === "date" && (
                    <DateWidget
                      value={dateWidgetValue(data, dateToggles)}
                      onChange={(v) => {
                        // Remember which sub-fields are open *before* writing the
                        // data: opening "Enddatum" produces no value yet, and a
                        // purely data-derived toggle would close it again.
                        setDateToggles(dateWidgetToggles(v))
                        updateMany(dateWidgetPatch(v))
                      }}
                      label={widgetLabel}
                    />
                  )}
                  {widgetId === "location" && (
                    <LocationWidget
                      value={{
                        address: data.address,
                        position: data.position ? latLngFromPoint(data.position) ?? undefined : undefined,
                      }}
                      onChange={(v) => {
                        updateMany({
                          address: v.address || undefined,
                          position: v.position
                            ? pointFromLatLng(v.position.lat, v.position.lng)
                            : undefined,
                        })
                      }}
                      label={widgetLabel}
                      geocode={geocode}
                      onPickOnMap={
                        requestMapPick
                          ? () => {
                              const originalPosition = data.position
                              const originalAddress = data.address
                              requestMapPick({
                                onPick: (pos) => {
                                  updateMany({ position: pointFromLatLng(pos.lat, pos.lng) })
                                  // Reverse-geocode (aborting the previous one) to fill the address.
                                  if (reverseGeocode) {
                                    reverseAbortRef.current?.abort()
                                    const controller = new AbortController()
                                    reverseAbortRef.current = controller
                                    reverseGeocode(pos, { signal: controller.signal })
                                      .then((label) => {
                                        if (label && !controller.signal.aborted) {
                                          updateMany({ address: label })
                                        }
                                      })
                                      .catch(() => {})
                                  }
                                },
                                onCancel: () => {
                                  // Abort a pending reverse-geocode so its late
                                  // result can't overwrite the restored address.
                                  reverseAbortRef.current?.abort()
                                  updateMany({ position: originalPosition, address: originalAddress })
                                },
                              })
                            }
                          : undefined
                      }
                    />
                  )}
                  {widgetId === "status" &&
                    currentConfig.statusOptions &&
                    currentConfig.statusOptions.length > 0 && (
                      <StatusWidget
                        value={data.status || ""}
                        onChange={(v) => updateData("status", v)}
                        label={widgetLabel}
                        options={currentConfig.statusOptions}
                      />
                    )}
                  {widgetId === "people" && (
                    <div className="flex flex-col gap-4">
                      {peopleFields.map((field) => (
                        <PeopleWidget
                          key={field.dataKey}
                          value={(data[field.dataKey] as string[] | undefined) || []}
                          onChange={(v) => updateData(field.dataKey, v)}
                          // `resolvePeopleFields` hat `widgetLabels.people` für
                          // die Einzahl-Kurzform schon eingesetzt; deklarierte
                          // `peopleRelations`-Labels gewinnen.
                          label={field.label}
                          options={peopleOptions}
                          suggestions={peopleSuggestions}
                          quickSuggestions={peopleQuickSuggestions}
                          placeholder={field.placeholder}
                          {...(field.qualifier
                            ? {
                                qualifier: field.qualifier,
                                qualifiers: (data[peopleQualifierKey(field.dataKey)] as Record<string, string> | undefined) ?? {},
                                onQualifiersChange: (next: Record<string, string>) => updateData(peopleQualifierKey(field.dataKey), next),
                              }
                            : {})}
                        />
                      ))}
                    </div>
                  )}
                  {widgetId === "tags" && (
                    <TagsWidget
                      value={data.tags || []}
                      onChange={(v) => updateData("tags", v)}
                      label={widgetLabel}
                      suggestions={tagSuggestions}
                      quickSuggestions={tagQuickSuggestions}
                    />
                  )}
                </div>
              </WidgetWrapper>
            )
          })}

          {/* Custom widgets */}
          {customWidgets?.map((cw) => {
            const isActive = activeWidgets.has(cw.id)
            const isDefault = defaultWidgets.has(cw.id)
            const CustomComponent = cw.component
            return (
              <WidgetWrapper key={cw.id} visible={isActive}>
                <div className="relative">
                  {!isDefault && isActive && (
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
                  <CustomComponent
                    value={data[cw.id]}
                    onChange={(v) => updateData(cw.id, v)}
                    label={
                      currentConfig.widgetLabels?.[cw.id] || cw.label
                    }
                  />
                </div>
              </WidgetWrapper>
            )
          })}
        </div>
      )}

      {submitError && (
        <p className="pt-1 text-xs text-destructive" role="alert">
          {submitError}
        </p>
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
