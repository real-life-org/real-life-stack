"use client"

import { useCallback, useMemo } from "react"

import { useItemFocus } from "../hooks/use-item-focus"
import { CalendarView } from "../components/calendar/calendar-view"
import { useCreate } from "../components/host/create-host"
import { useModuleHost } from "../components/host/module-host"
import type { ModuleViewProps } from "../lib/module-register"

const pad2 = (n: number) => String(n).padStart(2, "0")
const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const toLocalDatetime = (d: Date) => `${toLocalDate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`

/**
 * Das Kalender-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host,
 * Regel 1). Es tut nur noch, was Kalender ist: Termine zeigen und einen
 * angeklickten Tag als Vorschlag ins Erstellen geben. Items, Detail,
 * Erstellen und Plusknopf stellt der Host aus dem Eintrag (`presents:
 * ["start"]`, `options.suggestType: "event"`).
 *
 * Bis zum 21.09.2026 stand diese Verdrahtung als `CalendarViewWrapper` in
 * der Referenz-App — wie in sechs anderen Modulen auch, jedes Mal
 * abgeschrieben; bis zum Abend desselben Tages registrierte das Modul Detail
 * und Erstellen noch selbst.
 */
export function CalendarModule({ items = [] }: ModuleViewProps) {
  const { resolveItemGroupColor, currentUser, activeItemId } = useModuleHost()
  const { itemId: focusedId, focusItem } = useItemFocus()
  const { startCreate, patchCreate, isComposing } = useCreate()

  const focusedEvent = useMemo(() => (focusedId ? items.find((e) => e.id === focusedId) : undefined), [focusedId, items])
  const focusDate = useMemo(() => {
    const start = focusedEvent?.data.start
    if (typeof start !== "string") return undefined
    const d = new Date(start)
    return Number.isNaN(d.getTime()) ? undefined : d
  }, [focusedEvent])

  // Klick auf einen leeren Tag oder Zeitschlitz: Composer mit Datum vorbelegt.
  // Ein Tagesklick landet um Mitternacht → nur das Datum, bis jemand eine Zeit setzt.
  const openComposerAt = useCallback((date: Date) => {
    const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
    const start = hasTime ? toLocalDatetime(date) : toLocalDate(date)
    if (isComposing) patchCreate({ start })
    else startCreate("event", { start })
  }, [isComposing, patchCreate, startCreate])

  return (
    <CalendarView
      items={items}
      currentUserId={currentUser?.id}
      resolveItemGroupColor={resolveItemGroupColor}
      activeItemId={activeItemId}
      focusDate={focusDate}
      onItemClick={(event) => focusItem(event.id)}
      onCreateEvent={openComposerAt}
    />
  )
}
