"use client"

import type { ReactNode } from "react"
import type { Item } from "@real-life-stack/data-interface"
import { Calendar, MapPin } from "lucide-react"
import { cn } from "../../lib/utils"
import { isAllDayDate, parseEventDate } from "../../lib/date-utils"
import { useFieldLink } from "../navigation/field-navigation"

/**
 * `ItemMetaRow` — small inline meta row showing the temporal and
 * spatial cues for an item. Belongs in the `metaAdornment` slot of
 * `ItemPreview`. Renders nothing if the item has neither a `data.start`
 * nor a place, so callers can drop it in unconditionally.
 *
 * This is the meta row for the shared **detail panel** — every module
 * registers it, so the panel looks the same whichever one opened it.
 * `ItemTimeRange` is the sibling for date-grouped lists, where the day is
 * already implied by the group header and only the time-of-day is needed.
 *
 * Spec: `docs/spec/modules/shared-components.md` → `ItemMetaRow`.
 *
 * Date formatting handles the common event shapes: single date, single
 * datetime, same-day range, and multi-day range. Bare YYYY-MM-DD dates
 * are treated as all-day (no clock time) — see `lib/date-utils.ts` for
 * the parsing rationale. Locale defaults to German because the demo
 * data and references currently target a German audience; future
 * polish can lift the locale into a prop or read a context.
 */
export interface ItemMetaRowProps {
  item: Item
  className?: string
}

export function ItemMetaRow({ item, className }: ItemMetaRowProps) {
  const data = item.data as Record<string, unknown>
  const start = typeof data.start === "string" ? data.start : undefined
  const end = typeof data.end === "string" ? data.end : undefined
  // Same resolution as ItemTimeRange and the calendar's `toCalendarEvent()`:
  // the human name of a place beats its postal address, and an item that only
  // carries a `locationName` still shows where it happens.
  const place =
    (typeof data.locationName === "string" && data.locationName) ||
    (typeof data.address === "string" && data.address) ||
    undefined

  // Fuehrt das Feld irgendwohin? Das entscheidet nicht diese Zeile, sondern
  // das Modul-Register (wer stellt es dar) und die App (fuehrt der Space es,
  // und wie kommt man hin). Ohne Ziel bleibt der Wert Text.
  // Beide Hooks laufen immer — ein bedingter Aufruf waere ein Verstoss gegen
  // die Hook-Regeln, auch wenn das Ergebnis danach verworfen wird.
  const zumDatum = useFieldLink("start", item)
  const ortsziel = useFieldLink("position", item)
  // Die Karte braucht Koordinaten; ein Ort, der nur benannt ist, laesst sich
  // dort nicht zeigen.
  const zumOrt = data.position ? ortsziel : null

  if (!start && !place) return null

  return (
    <div className={cn("flex flex-wrap gap-3 text-xs text-muted-foreground", className)}>
      {start && (
        <MetaWert icon={<Calendar className="h-3 w-3" />} onClick={zumDatum}>
          {formatEventRange(start, end)}
        </MetaWert>
      )}
      {place && (
        <MetaWert icon={<MapPin className="h-3 w-3" />} onClick={zumOrt}>
          {place}
        </MetaWert>
      )}
    </div>
  )
}

/**
 * Ein Meta-Wert — anklickbar, wenn er irgendwohin fuehrt, sonst schlichter
 * Text. Beides sieht bis auf die Unterstreichung beim Ueberfahren gleich aus:
 * Der Wert ist die Auskunft, der Weg dorthin eine Zugabe.
 */
function MetaWert({
  icon,
  onClick,
  children,
}: {
  icon: ReactNode
  onClick: (() => void) | null
  children: ReactNode
}) {
  const inhalt = (
    <>
      {icon}
      {children}
    </>
  )
  if (!onClick) return <span className="inline-flex items-center gap-1">{inhalt}</span>
  return (
    <button
      type="button"
      // Der Klick gehoert dem Wert, nicht der Karte darunter: Sonst oeffnete
      // ein Tippen auf das Datum die Detailansicht, statt in den Kalender zu
      // fuehren.
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className="inline-flex items-center gap-1 rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {inhalt}
    </button>
  )
}

/**
 * Format a single date or a range. Exported for callers that need the
 * string outside of the inline meta row (e.g. a table cell, a tooltip).
 */
export function formatEventRange(start: string, end?: string): string {
  const startAllDay = isAllDayDate(start)
  const s = parseEventDate(start)
  if (Number.isNaN(s.getTime())) return start

  const dateStr = s.toLocaleDateString("de-DE", { day: "numeric", month: "short" })
  const timeStr = startAllDay
    ? null
    : s.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })

  if (!end) return timeStr ? `${dateStr}, ${timeStr}` : dateStr

  const endAllDay = isAllDayDate(end)
  const e = parseEventDate(end)
  if (Number.isNaN(e.getTime())) return timeStr ? `${dateStr}, ${timeStr}` : dateStr

  const endTimeStr = endAllDay
    ? null
    : e.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })

  // Same day — four cases, handle the mixed ones explicitly so a null
  // side doesn't get interpolated into the string.
  if (s.toDateString() === e.toDateString()) {
    if (!timeStr && !endTimeStr) return dateStr
    if (timeStr && endTimeStr) return `${dateStr}, ${timeStr} – ${endTimeStr}`
    if (timeStr) return `${dateStr}, ${timeStr}`
    return `${dateStr}, bis ${endTimeStr}`
  }

  const endDateStr = e.toLocaleDateString("de-DE", { day: "numeric", month: "short" })
  const startPart = timeStr ? `${dateStr}, ${timeStr}` : dateStr
  const endPart = endTimeStr ? `${endDateStr}, ${endTimeStr}` : endDateStr
  return `${startPart} – ${endPart}`
}
