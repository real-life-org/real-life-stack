"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { isAggregateVisibleItemType, type ActivityEntry } from "@real-life-stack/data-interface"

import { useActivity } from "../../hooks/use-activity"
import { useOptionalCurrentUser } from "../../hooks/use-auth"
import { useCurrentGroup, useMembers } from "../../hooks/use-groups"
import { useOptionalItemFocus } from "../../hooks/use-item-focus"
import { useItems } from "../../hooks/use-items"
import { useMarkNotificationsSeen, useNotifications } from "../../hooks/use-notifications"
import { useModulePanel } from "../module-panel/module-panel"
import { ActivityPanel } from "./activity-panel"
import { NotificationCenter, type NotificationCandidate } from "./notification-center"

export interface ActivityPanelControllerProps {
  /** Ist die Glocke offen? Der Zustand gehört der Shell, das Panel dem Controller. */
  open: boolean
  onClose: () => void
  /** Klick auf eine Benachrichtigung — die App baut daraus eine Route. */
  onOpenNotification: (notification: NotificationCandidate) => void
  /** Klick auf den Gruppennamen. */
  onOpenGroup: (groupId: string) => void
  /** Klick auf ein Ziel im rohen Verlauf — Item-Id, bereits auf die Karte aufgelöst. */
  onOpenEntryTarget: (targetId: string) => void
}

/**
 * Verlauf und Benachrichtigungen im geteilten Modul-Panel — statt einer
 * zweiten Shell-Fläche. Bis zum 21.09.2026 stand dieser Controller in beiden
 * Apps wörtlich gleich (die Netzwerk-App ohne die Fokus-Regel); was Apps
 * teilen können, gehört nicht in die App (Spec 01, Der Modul-Host).
 */
export function ActivityPanelController({ open, onClose, onOpenNotification, onOpenGroup, onOpenEntryTarget }: ActivityPanelControllerProps) {
  const panel = useModulePanel()
  const focus = useOptionalItemFocus()
  const clearFocus = focus?.clearFocus
  const ownedActivityPanel = useRef(false)
  const wasOpen = useRef(open)
  const openTarget = useCallback((entry: ActivityEntry) => {
    onOpenEntryTarget(entry.targetId)
    onClose()
  }, [onOpenEntryTarget, onClose])
  useEffect(() => {
    const openedNow = open && !wasOpen.current
    wasOpen.current = open
    if (!open) {
      ownedActivityPanel.current = false
      if (panel.current?.itemId === "__activity__") panel.close({ silent: true })
      return
    }
    if (panel.current?.itemId === "__activity__") {
      ownedActivityPanel.current = true
      return
    }
    // Ein Inhaltswechsel ruft das `onClose` des vorigen Panels nicht auf. Die
    // geteilte Fläche wird abgegeben, nicht dem neuen Besitzer entrissen.
    if (ownedActivityPanel.current && !openedNow) {
      ownedActivityPanel.current = false
      onClose()
      return
    }
    ownedActivityPanel.current = true
    // Wie beim Erstellen lässt das Öffnen des Verlaufs den Item-Fokus los: Das
    // geteilte Panel zeigt genau eines, und nur ein Fokus-WECHSEL gibt es dem
    // Detail-Host zurück. Ein stehender Fokus machte den Klick auf dasselbe
    // Item zu einem Nichts.
    clearFocus?.()
    panel.open({
      kind: "custom",
      itemId: "__activity__",
      content: <NotificationCenterContent onOpenTarget={openTarget} onOpenNotification={onOpenNotification} onOpenGroup={onOpenGroup} onCloseCenter={onClose} onOpenActivity={() => panel.open({ kind: "custom", itemId: "__activity__", content: <ActivityLogContent onOpenTarget={openTarget} />, onClose })} />,
      onClose,
    })
  }, [clearFocus, onClose, open, openTarget, panel.close, panel.current?.itemId, panel.open])
  return null
}

function NotificationCenterContent({ onOpenTarget, onOpenNotification, onOpenGroup, onOpenActivity, onCloseCenter }: { onOpenTarget: (entry: ActivityEntry) => void; onOpenNotification: (notification: NotificationCandidate) => void; onOpenGroup: (groupId: string) => void; onOpenActivity: () => void; onCloseCenter: () => void }) {
  const notifications = useNotifications()
  useMarkNotificationsSeen(notifications)
  if (!notifications.supported) return <ActivityLogContent onOpenTarget={onOpenTarget} />
  return <NotificationCenter notifications={notifications.notifications} onOpenSubject={onOpenNotification} onOpenGroup={onOpenGroup} onOpenActivity={onOpenActivity} onMarkRead={notifications.stateSupported ? (keys) => void notifications.update?.({ op: "markRead", keys }) : undefined} onMarkAllRead={notifications.stateSupported ? () => { if (notifications.maxTs) void notifications.update?.({ op: "markAllReadUpTo", ts: notifications.maxTs }); onCloseCenter() } : undefined} onMuteGroup={notifications.stateSupported ? (groupId, muted) => void notifications.update?.(muted ? { op: "mute", groupId } : { op: "unmute", groupId }) : undefined} />
}

function ActivityLogContent({ onOpenTarget }: { onOpenTarget: (entry: ActivityEntry) => void }) {
  const { data: entries } = useActivity()
  const { data: items } = useItems()
  const currentGroup = useCurrentGroup()
  const { data: members } = useMembers(currentGroup?.id ?? null)
  const { data: currentUser } = useOptionalCurrentUser()
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  // Eine Reaktion öffnet ihr ELTERN-Item — sie selbst hat keine Karte. Welche
  // Typen keine haben, sagt der Datenvertrag, keine Liste hier.
  const resolveOpenId = useCallback((entry: ActivityEntry) => {
    if (!isAggregateVisibleItemType(entry.targetType) || entry.action === "delete") return undefined
    if (entry.targetType === "reaction") {
      const reaction = itemById.get(entry.targetId)
      const target = reaction?.relations?.find((relation) => relation.predicate === "reactsTo")?.target
      const parentId = target?.startsWith("item:") ? target.slice("item:".length) : undefined
      return parentId && itemById.has(parentId) ? parentId : undefined
    }
    return itemById.has(entry.targetId) ? entry.targetId : undefined
  }, [itemById])
  const isTargetOpenable = useCallback((entry: ActivityEntry) => resolveOpenId(entry) !== undefined, [resolveOpenId])
  const resolveActor = useCallback(
    (actorId: string) => members.find((member) => member.id === actorId) ?? (currentUser?.id === actorId ? currentUser : undefined),
    [members, currentUser],
  )
  const openResolvedTarget = useCallback((entry: ActivityEntry) => {
    const openId = resolveOpenId(entry)
    if (openId) onOpenTarget({ ...entry, targetId: openId })
  }, [onOpenTarget, resolveOpenId])
  return <ActivityPanel entries={entries} isTargetOpenable={isTargetOpenable} onOpenTarget={openResolvedTarget} resolveActor={resolveActor} />
}
