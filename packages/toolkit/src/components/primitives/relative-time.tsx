"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/** Format a date as a relative time string (German). */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1) return "gerade eben"
  if (diffMin < 60) return `vor ${diffMin} Min.`
  if (diffH < 24) return `vor ${diffH} Std.`
  if (diffD === 1) return "gestern"
  if (diffD < 7) return `vor ${diffD} Tagen`

  const d = new Date(date)
  const now_ = new Date()
  if (d.getFullYear() === now_.getFullYear()) {
    return d.toLocaleDateString("de-DE", { day: "numeric", month: "long" })
  }
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })
}

/** Format a date as a full date/time string for tooltips (German). */
export function formatFullDateTime(date: string | Date): string {
  const d = new Date(date)
  const dateStr = d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })
  const timeStr = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
  return `${dateStr}, ${timeStr} Uhr`
}

/** Returns the appropriate auto-update interval in ms based on the age of the timestamp. */
function getUpdateInterval(date: string | Date): number | null {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMin = diffMs / 60000

  if (diffMin < 1) return 10_000       // < 1 min: every 10s
  if (diffMin < 60) return 60_000      // < 1 hour: every 1 min
  if (diffMin < 1440) return 3_600_000 // < 1 day: every 1 hour
  return null                           // >= 1 day: no update
}

export interface RelativeTimeProps {
  /** ISO-8601 date string or Date object. */
  date: string | Date
  /** Additional CSS classes for the <time> element. */
  className?: string
}

/**
 * Displays a relative timestamp (e.g. "vor 2 Stunden") with a native
 * HTML tooltip showing the full date and time on hover.
 * Auto-updates periodically to keep the relative time current.
 */
export function RelativeTime({ date, className }: RelativeTimeProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = getUpdateInterval(date)
    if (interval === null) return

    const id = setInterval(() => setTick((t) => t + 1), interval)
    return () => clearInterval(id)
  }, [date])

  const isoString = new Date(date).toISOString()

  return (
    <time
      dateTime={isoString}
      title={formatFullDateTime(date)}
      className={cn("text-muted-foreground", className)}
    >
      {formatRelativeTime(date)}
    </time>
  )
}
