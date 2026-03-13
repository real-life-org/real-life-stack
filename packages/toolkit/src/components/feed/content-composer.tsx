"use client"

import * as React from "react"
import { ChevronDown, Globe, Lock, Trash2, X } from "lucide-react"
import { Button } from "@/components/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu"
import { cn } from "@/lib/utils"
import { WidgetWrapper } from "./widgets/widget-wrapper"
import { TitleWidget } from "./widgets/title-widget"
import { TextWidget } from "./widgets/text-widget"
import { DateWidget } from "./widgets/date-widget"
import { LocationWidget } from "./widgets/location-widget"
import { MediaWidget } from "./widgets/media-widget"
import { PeopleWidget } from "./widgets/people-widget"
import { TagsWidget } from "./widgets/tags-widget"
import { StatusWidget } from "./widgets/status-widget"
import { GroupWidget } from "./widgets/group-widget"

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
  date?: DateRange
  location?: LocationData
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

export interface ContentComposerProps {
  contentTypes: ContentTypeConfig[]
  initialContentType?: string
  mode?: string
  initialData?: Partial<WidgetData>
  onSubmit: (data: ContentComposerSubmitData) => void
  onCancel?: () => void
  onDelete?: () => void
  editMode?: boolean
  renderLocationMap?: (props: {
    position: { lat: number; lng: number } | null
    onPositionChange: (pos: { lat: number; lng: number }) => void
    onConfirm: () => void
  }) => React.ReactNode
  peopleSuggestions?: string[] | ((query: string) => Promise<string[]>)
  tagSuggestions?: string[] | ((query: string) => Promise<string[]>)
  widgets?: CustomWidgetDefinition[]
  showVisibility?: boolean
  defaultPublic?: boolean
  showPreview?: boolean
  renderPreview?: (data: WidgetData, contentType: string) => React.ReactNode
  className?: string
}

// ── Constants ────────────────────────────────────────────────────────────

/** Fixed rendering order for widgets */
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
  date: { start: "" },
  location: {},
  people: [],
  tags: [],
  status: "",
  group: "",
}

// ── Component ────────────────────────────────────────────────────────────

export function ContentComposer({
  contentTypes,
  initialContentType,
  mode,
  initialData,
  onSubmit,
  onCancel,
  onDelete,
  editMode: editModeProp,
  renderLocationMap,
  peopleSuggestions,
  tagSuggestions,
  widgets: customWidgets,
  showVisibility = true,
  defaultPublic = true,
  showPreview = true,
  renderPreview,
  className,
}: ContentComposerProps) {
  const isEditMode = editModeProp ?? !!onDelete
  const isSingleTypeMode = !!mode

  // Resolve initial content type
  const resolvedInitialType =
    mode || initialContentType || contentTypes[0]?.id || ""

  const [selectedType, setSelectedType] = React.useState(resolvedInitialType)
  const [data, setData] = React.useState<WidgetData>(() => ({
    ...DEFAULT_DATA,
    ...initialData,
  }))
  const [manualWidgets, setManualWidgets] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [isPublic, setIsPublic] = React.useState(defaultPublic)
  const [isPreviewing, setIsPreviewing] = React.useState(false)

  // Current content type config
  const currentConfig = contentTypes.find((t) => t.id === selectedType) || contentTypes[0]
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
    setData((d) => ({
      ...d,
      status: d.status || currentConfig.defaultStatus || "",
      group: d.group || currentConfig.defaultGroup || "",
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Widgets available to toggle on (not active, not title/text, not status/group without config)
  const toggleableWidgets = WIDGET_ORDER.filter(
    (w) =>
      !activeWidgets.has(w) &&
      w !== "title" &&
      w !== "text" &&
      !(w === "status" && !hasStatusOptions) &&
      !(w === "group" && !hasGroupOptions),
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
    if (!data.people?.includes(name)) {
      updateData("people", [...(data.people || []), name])
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
  const handleSubmit = () => {
    onSubmit({
      contentType: selectedType,
      isPublic,
      data,
    })
  }

  // Submit label
  const submitLabel = isEditMode
    ? currentConfig.editLabel || "Speichern"
    : currentConfig.submitLabel || "Erstellen"

  // ── Render ──

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Content type selector (multi-type mode only) */}
      {!isSingleTypeMode && contentTypes.length > 1 && (
        <div className="flex gap-1 overflow-x-auto">
          {contentTypes.map((type) => {
            const Icon = type.icon
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  selectedType === type.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {type.label}
              </button>
            )
          })}
        </div>
      )}

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
          {/* Render widgets in fixed order */}
          {WIDGET_ORDER.map((widgetId) => {
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
                  {/* Widget content */}
                  {widgetId === "group" &&
                    currentConfig.groupOptions &&
                    currentConfig.groupOptions.length > 0 && (
                      <GroupWidget
                        value={data.group || ""}
                        onChange={(v) => updateData("group", v)}
                        label={widgetLabel}
                        options={currentConfig.groupOptions}
                        required={currentConfig.groupRequired ?? true}
                      />
                    )}
                  {widgetId === "title" && (
                    <TitleWidget
                      value={data.title || ""}
                      onChange={(v) => updateData("title", v)}
                      label={widgetLabel}
                    />
                  )}
                  {widgetId === "text" && (
                    <TextWidget
                      value={data.text || ""}
                      onChange={(v) => updateData("text", v)}
                      label={widgetLabel}
                      availableWidgets={toggleableWidgets}
                      onToggleWidget={toggleWidget}
                      onMention={handleMention}
                      onHashtag={handleHashtag}
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
                      value={data.date || { start: "" }}
                      onChange={(v) => updateData("date", v)}
                      label={widgetLabel}
                    />
                  )}
                  {widgetId === "location" && (
                    <LocationWidget
                      value={data.location || {}}
                      onChange={(v) => updateData("location", v)}
                      label={widgetLabel}
                      renderMap={renderLocationMap}
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
                    <PeopleWidget
                      value={data.people || []}
                      onChange={(v) => updateData("people", v)}
                      label={widgetLabel}
                      suggestions={peopleSuggestions}
                    />
                  )}
                  {widgetId === "tags" && (
                    <TagsWidget
                      value={data.tags || []}
                      onChange={(v) => updateData("tags", v)}
                      label={widgetLabel}
                      suggestions={tagSuggestions}
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

      {/* Footer: actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* Delete button (edit mode only) */}
          {isEditMode && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="gap-1.5 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Loeschen
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
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
                className="gap-1.5 rounded-r-none"
              >
                {isPublic ? (
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
            <Button type="button" size="sm" onClick={handleSubmit}>
              {submitLabel}
            </Button>
          )}
        </div>
      </div>
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
      {has("date") && data.date?.start && (
        <div className="text-sm text-muted-foreground">
          {data.date.start}
          {data.date.end && ` — ${data.date.end}`}
        </div>
      )}
      {has("location") && (data.location?.address || data.location?.link) && (
        <div className="text-sm text-muted-foreground">
          {data.location.address || data.location.link}
        </div>
      )}
      {has("people") && data.people && data.people.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.people.map((p) => (
            <span
              key={p}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs"
            >
              {p}
            </span>
          ))}
        </div>
      )}
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
