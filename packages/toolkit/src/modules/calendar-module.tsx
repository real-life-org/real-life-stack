"use client"

import { useCallback, useMemo } from "react"

import { useCurrentUser } from "../hooks/use-auth"
import { useGroups, useMembers, usePersonalGroupId } from "../hooks/use-groups"
import { useItemsWithDraft } from "../hooks/use-items"
import { useItemFocus } from "../hooks/use-item-focus"
import { useItemDetailEdit } from "../hooks/use-item-detail-edit"
import { useItemGroupColorResolver } from "../hooks/use-item-group-color"
import { CalendarView } from "../components/calendar/calendar-view"
import { contentTypesFromRegister, mapComposerSubmission, withGroupOptions } from "../components/composer/content-types"
import { CreateFab } from "../components/create-fab/create-fab"
import { useCreate, useRegisterCreate, type CreateConfig } from "../components/host/create-host"
import { useRegisterDetail, type DetailConfig } from "../components/host/detail-host"
import { useModulePanel } from "../components/module-panel/module-panel"
import { ReactionBar } from "../components/reactions/reaction-bar"
import type { ModuleViewProps } from "../lib/module-register"

const pad2 = (n: number) => String(n).padStart(2, "0")
const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const toLocalDatetime = (d: Date) => `${toLocalDate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`

/**
 * Das Kalender-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host,
 * Regel 1). Bis zum 21.09.2026 stand diese Verdrahtung als
 * `CalendarViewWrapper` in der Referenz-App — wie in sechs anderen Modulen
 * auch, jedes Mal abgeschrieben.
 *
 * Erstellen bietet ALLE Typen an (Anton, 20.09.2026); der Kalender schlaegt
 * beim Klick auf einen leeren Tag „Termin" mit dem Datum VOR — ein Vorschlag,
 * kein Zaun.
 */
export function CalendarModule({ groupId }: ModuleViewProps) {
  const isOverview = groupId === "__overview__"
  const currentSpace = isOverview ? undefined : groupId
  const { data: events } = useItemsWithDraft({ hasField: ["start"] })
  const { data: members } = useMembers(isOverview ? null : groupId)
  const { data: currentUser } = useCurrentUser()
  const { data: groups } = useGroups()
  const personalGroupId = usePersonalGroupId()
  const resolveItemGroupColor = useItemGroupColorResolver(currentSpace)
  const modulePanel = useModulePanel()
  const { itemId: focusedId, focusItem } = useItemFocus()

  const editConfig = useItemDetailEdit(members)
  const { startCreate, patchCreate, isComposing } = useCreate()
  const composerProps = editConfig.composerProps
  const createConfig = useMemo<CreateConfig>(
    () => ({
      contentTypes: withGroupOptions(contentTypesFromRegister(), groups, currentSpace, personalGroupId),
      mapper: mapComposerSubmission,
      composerProps,
      shell: "sheet",
    }),
    [groups, currentSpace, personalGroupId, composerProps],
  )
  useRegisterCreate("calendar", createConfig)

  const detailConfig = useMemo<DetailConfig>(
    () => ({
      ...editConfig,
      renderCommentReactions: (commentId) => <ReactionBar itemId={commentId} />,
      onShare: () => { void navigator.clipboard?.writeText(window.location.href) },
    }),
    [editConfig],
  )
  useRegisterDetail("calendar", detailConfig)

  const focusedEvent = useMemo(() => (focusedId ? events.find((e) => e.id === focusedId) : undefined), [focusedId, events])
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
    <>
      <CalendarView
        items={events}
        currentUserId={currentUser?.id}
        resolveItemGroupColor={resolveItemGroupColor}
        activeItemId={modulePanel.current?.itemId}
        focusDate={focusDate}
        onItemClick={(event) => focusItem(event.id)}
        onCreateEvent={openComposerAt}
      />
      <CreateFab onClick={() => startCreate("event")} label="Erstellen" />
    </>
  )
}
