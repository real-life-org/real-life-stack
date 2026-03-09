"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../primitives/card"
import { Button } from "../primitives/button"
import { cn } from "../../lib/utils"
import type { Item } from "@real-life-stack/data-interface"

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
]
const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]

interface CalendarDay {
  number: number
  isCurrentMonth: boolean
  hasEvent: boolean
  isToday: boolean
}

function buildCalendarDays(year: number, month: number, eventDays: Set<number>): CalendarDay[] {
  const today = new Date().getDate()
  const isCurrentMonth = new Date().getFullYear() === year && new Date().getMonth() === month
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  return Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - startOffset + 1
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth
    return {
      number: dayNum < 1 ? daysInPrev + dayNum : dayNum > daysInMonth ? dayNum - daysInMonth : dayNum,
      isCurrentMonth: inMonth,
      hasEvent: inMonth && eventDays.has(dayNum),
      isToday: isCurrentMonth && inMonth && dayNum === today,
    }
  })
}

export interface CalendarViewProps {
  events: Item[]
  onEventClick?: (event: Item) => void
  className?: string
}

export function CalendarView({ events, onEventClick, className }: CalendarViewProps) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const eventDays = useMemo(
    () =>
      new Set(
        events
          .filter((e) => e.data.start)
          .map((e) => new Date(String(e.data.start)).getDate())
      ),
    [events]
  )

  const calendarDays = useMemo(
    () => buildCalendarDays(year, month, eventDays),
    [year, month, eventDays]
  )

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{MONTH_NAMES[month]} {year}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm">&lt;</Button>
              <Button variant="ghost" size="sm">&gt;</Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => (
              <button
                key={i}
                className={cn(
                  "aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all",
                  !day.isCurrentMonth && "text-muted-foreground/40",
                  day.isCurrentMonth && !day.isToday && "text-foreground hover:bg-muted",
                  day.isToday && "bg-primary text-primary-foreground font-bold",
                  day.hasEvent && !day.isToday && "bg-primary/10 font-medium",
                )}
              >
                {day.number}
                {day.hasEvent && (
                  <div
                    className={cn(
                      "w-1 h-1 rounded-full mt-0.5",
                      day.isToday ? "bg-primary-foreground" : "bg-primary",
                    )}
                  />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anstehende Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.map((event) => {
            const start = event.data.start ? new Date(String(event.data.start)) : null
            const dayName = start ? DAY_NAMES[start.getDay()] : ""
            const dayNum = start ? start.getDate() : ""
            const time = start
              ? `${start.getHours()}:${String(start.getMinutes()).padStart(2, "0")}`
              : ""

            return (
              <div
                key={event.id}
                onClick={() => onEventClick?.(event)}
                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
              >
                <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex flex-col items-center justify-center text-primary-foreground">
                  <span className="text-xs font-medium">{dayName}</span>
                  <span className="text-lg font-bold leading-none">{dayNum}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{String(event.data.title)}</p>
                  <p className="text-sm text-muted-foreground">{time} Uhr</p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
