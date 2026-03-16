import { useState, useMemo, useCallback, useEffect, type DragEvent, lazy, Suspense } from "react"
import { Routes, Route, useParams, useNavigate } from "react-router-dom"
import {
  Newspaper,
  Map as MapIcon,
  Calendar,
  Users,
  MessageCircle,
  Plus,
  UserPlus,
  MapPin,
  Sun,
  Moon,
  Columns3,
  Layers,
  LayoutList,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

import {
  AppShell,
  AppShellMain,
  Navbar,
  NavbarStart,
  NavbarCenter,
  NavbarEnd,
  WorkspaceSwitcher,
  UserMenu,
  ModuleTabs,
  BottomNav,
  ConnectorSwitcher,
  SimplePostWidget,
  PostCard,
  StatCard,
  ActionCard,
  KanbanBoard,
  KanbanToolbar,
  applyKanbanFilter,
  KanbanTaskForm,
  AdaptivePanel,
  CalendarView,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  GroupDialog,
  ProfileDialog,
  ContactsDialog,
  VerificationDialog,
  IncomingVerificationDialog,
  IncomingSpaceInviteDialog,
  MutualVerificationDialog,
  RelayStatusBadge,
  IncomingEventsProvider,
  useIncomingEvents,
  ConnectorProvider,
  useItems,
  useUpdateItem,
  useMembers,
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useInviteMember,
  useRemoveMember,
  useCurrentUser,
  useCreateItem,
  useDeleteItem,
  useConnector,
  useContacts,
  useVerification,
  useRelayStatus,
  type Workspace,
  type UserData,
  type Module,
  type Post,
  type KanbanFilter,
  type ConnectorOption,
  type GroupDialogMode,
} from "@real-life-stack/toolkit"
import type { Item, User, Relation, Group, DataInterface, GroupManager } from "@real-life-stack/data-interface"
import { hasGroups, isAuthenticatable, hasMessaging, hasSignedClaims, hasProfile, hasItemGroups } from "@real-life-stack/data-interface"
import { demoItems, demoGroups, demoUsers, demoGroupMembers, demoGroupItems } from "@real-life-stack/data-interface/demo-data"
import { MockConnector } from "@real-life-stack/mock-connector"
import { LocalConnector } from "@real-life-stack/local-connector"

const MODULE_ICONS: Record<string, typeof Newspaper> = {
  feed: Newspaper,
  map: MapIcon,
  calendar: Calendar,
  kanban: Columns3,
}

const MODULE_LABELS: Record<string, string> = {
  feed: "Feed",
  map: "Karte",
  calendar: "Kalender",
  kanban: "Kanban",
}

const CONNECTOR_OPTIONS: ConnectorOption[] = [
  { id: "mock", name: "Mock", description: "In-Memory, kein Speichern" },
  { id: "local", name: "Local", description: "IndexedDB, persistent" },
  { id: "wot", name: "Web of Trust", description: "E2E-verschlüsselt, Multi-Device" },
]

//** Short human-readable fallback for raw IDs (DIDs etc.) */
function shortName(id: string): string {
  return `User-${id.slice(-6)}`
}

// Helper: resolve user info from members list or current user
function resolveAuthor(userId: string, members: User[], currentUser?: User | null) {
  const member = members.find((m) => m.id === userId)
    ?? (currentUser?.id === userId ? currentUser : undefined)
  return {
    name: member?.displayName ?? shortName(userId),
    avatar: member?.avatarUrl,
  }
}

// Helper: relative time string from Date
function timeAgo(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `vor ${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `vor ${hours} Stunden`
  const days = Math.floor(hours / 24)
  if (days === 1) return "gestern"
  return `vor ${days} Tagen`
}

// Helper: map Item to Post for PostCard
function itemToPost(item: Item, members: User[], currentUser?: User | null): Post {
  return {
    id: item.id,
    author: resolveAuthor(item.createdBy, members, currentUser),
    content: String(item.data.content ?? item.data.description ?? ""),
    timestamp: timeAgo(item.createdAt),
    likes: 0,
    comments: 0,
    type: "text",
  }
}

function FeedView({ onInvite, groupId }: { onInvite?: () => void; groupId: string }) {
  const { data: posts } = useItems({ type: "post" })
  const { data: events } = useItems({ type: "event" })
  const { data: members } = useMembers(groupId)
  const { mutate: createItem } = useCreateItem()
  const { data: currentUser } = useCurrentUser()

  const mappedPosts = useMemo(
    () =>
      [...posts]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((item) => itemToPost(item, members, currentUser)),
    [posts, members, currentUser]
  )

  const handlePost = (content: string) => {
    createItem({
      type: "post",
      createdBy: currentUser?.id ?? "anonymous",
      data: { title: "Neuer Post", content, tags: [] },
    })
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Users} value={members.length} label="Mitglieder" color="blue" />
        <StatCard icon={Calendar} value={events.length} label="Events" color="green" />
        <StatCard icon={MessageCircle} value={posts.length} label="Posts" color="orange" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <ActionCard
          icon={Plus}
          label="Neues Event"
          description="Termin erstellen"
          variant="primary"
          onClick={() => console.log("New event")}
        />
        <ActionCard
          icon={UserPlus}
          label="Einladen"
          description="Mitglieder hinzufügen"
          variant="secondary"
          onClick={onInvite}
        />
      </div>

      {/* Post Widget */}
      <SimplePostWidget
        placeholder="Was gibt's Neues in der Nachbarschaft?"
        onSubmit={handlePost}
      />

      {/* Posts Feed */}
      <div className="space-y-4">
        {mappedPosts.map((post: Post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={(id: string) => console.log("Like:", id)}
            onComment={(id: string) => console.log("Comment:", id)}
            onShare={(id: string) => console.log("Share:", id)}
          />
        ))}
      </div>
    </div>
  )
}

function MapView() {
  const { data: places } = useItems({ type: "place" })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5">
            {/* Decorative map elements */}
            <div className="absolute inset-0">
              {/* Grid lines */}
              <div className="absolute inset-0 opacity-20">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={`h-${i}`}
                    className="absolute h-px bg-primary/30 w-full"
                    style={{ top: `${(i + 1) * 12.5}%` }}
                  />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={`v-${i}`}
                    className="absolute w-px bg-primary/30 h-full"
                    style={{ left: `${(i + 1) * 12.5}%` }}
                  />
                ))}
              </div>

              {/* Location markers from connector */}
              {places.map((place, i) => {
                const positions = [
                  { top: "25%", left: "33%" },
                  { top: "50%", left: "66%" },
                  { top: "66%", left: "25%" },
                ]
                const pos = positions[i % positions.length]
                const colors = ["text-primary", "text-secondary", "text-accent"]
                return (
                  <div key={place.id} className="absolute" style={{ top: pos.top, left: pos.left }}>
                    <div className="relative">
                      <MapPin className={`h-7 w-7 ${colors[i % colors.length]} drop-shadow-lg`} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="bg-background/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border">
                <MapPin className="h-12 w-12 text-primary mx-auto mb-3" />
                <p className="text-foreground font-semibold text-center">
                  Interaktive Karte
                </p>
                <p className="text-muted-foreground text-sm text-center mt-1">
                  {places.length} Orte in deiner Nähe
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nearby locations from connector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">In der Nähe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {places.map((place) => (
            <div
              key={place.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{String(place.data.title)}</p>
                <p className="text-xs text-muted-foreground">{String(place.data.address ?? "")}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function CalendarViewWrapper() {
  const { data: events } = useItems({ type: "event" })

  return (
    <CalendarView
      events={events}
      onEventClick={(event) => console.log("Event clicked:", event.id)}
    />
  )
}

type KanbanPanelState =
  | { mode: "closed" }
  | { mode: "edit"; item: Item }
  | { mode: "create" }

function KanbanView({ activeWorkspaceId, groups, selectedItemId, onItemSelect, onItemClose }: { activeWorkspaceId: string | null; groups: Group[]; selectedItemId?: string; onItemSelect?: (id: string) => void; onItemClose?: () => void }) {
  const connector = useConnector()
  const { data: tasks } = useItems({ type: "task" })
  const { data: members } = useMembers("group-1")
  const { data: currentUser } = useCurrentUser()
  const { mutate: updateItem } = useUpdateItem()
  const { mutate: createItem } = useCreateItem()
  const { mutate: deleteItem } = useDeleteItem()
  const [filter, setFilter] = useState<KanbanFilter>({
    searchText: "",
    assignedTo: null,
    myTasksOnly: false,
    tags: [],
  })
  const [panelState, setPanelState] = useState<KanbanPanelState>({ mode: "closed" })
  const [panelPinned, setPanelPinned] = useState(false)

  // Open item panel from URL deep-link
  useEffect(() => {
    if (selectedItemId && tasks.length > 0) {
      const item = tasks.find((t) => t.id === selectedItemId)
      if (item) {
        setPanelState({ mode: "edit", item })
      }
    } else if (!selectedItemId && panelState.mode === "edit") {
      setPanelState({ mode: "closed" })
    }
  }, [selectedItemId, tasks.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const [groupedView, setGroupedView] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)

  const filteredTasks = useMemo(
    () => applyKanbanFilter(tasks, filter, currentUser?.id),
    [tasks, filter, currentUser?.id]
  )

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const task of tasks) {
      const taskTags = task.data.tags as string[] | undefined
      if (taskTags) {
        for (const tag of taskTags) tagSet.add(tag)
      }
    }
    return Array.from(tagSet)
  }, [tasks])

  const handleMoveItem = (itemId: string, newStatus: string, position: number) => {
    const item = tasks.find((t) => t.id === itemId)
    if (!item) return

    // Get items in the target column, sorted by position, excluding the dragged item
    const columnItems = tasks
      .filter((t) => {
        const s = (t.data.status as string) ?? "todo"
        return s === newStatus && t.id !== itemId
      })
      .sort((a, b) => ((a.data.position as number) ?? 0) - ((b.data.position as number) ?? 0))

    // Insert at target position and reassign positions
    columnItems.splice(position, 0, item)
    for (let i = 0; i < columnItems.length; i++) {
      const t = columnItems[i]
      updateItem(t.id, { data: { ...t.data, status: newStatus, position: i } })
    }
  }

  const handleCreateItem = useCallback(() => {
    setPanelState({ mode: "create" })
  }, [])

  const handleItemClick = useCallback((item: Item) => {
    setPanelState({ mode: "edit", item })
    onItemSelect?.(item.id)
  }, [onItemSelect])

  const handleClosePanel = useCallback(() => {
    if (!panelPinned) {
      setPanelState({ mode: "closed" })
      onItemClose?.()
    }
  }, [panelPinned, onItemClose])

  // Explicit close — always closes, ignoring pinned state (used by X button / drawer drag)
  const handleForceClosePanel = useCallback(() => {
    setPanelState({ mode: "closed" })
    onItemClose?.()
  }, [onItemClose])

  // Determine if the active workspace is the aggregate ("Alles") view
  const activeGroup = groups.find((g) => g.id === activeWorkspaceId)
  const isAggregate = (activeGroup?.data?.scope as string) === "aggregate"

  // Non-aggregate groups for grouped view
  const concreteGroups = useMemo(
    () => groups.filter((g) => (g.data?.scope as string) !== "aggregate"),
    [groups]
  )

  // Group tasks by their group for the grouped view
  const tasksByGroup = useMemo(() => {
    if (!isAggregate || !groupedView || !hasItemGroups(connector)) return null
    const map = new Map<string, Item[]>()
    for (const g of concreteGroups) {
      map.set(g.id, [])
    }
    // Collect items without a group under a special key
    map.set("__ungrouped__", [])
    for (const task of filteredTasks) {
      const gid = connector.getItemGroupId(task.id)
      if (gid && map.has(gid)) {
        map.get(gid)!.push(task)
      } else {
        map.get("__ungrouped__")!.push(task)
      }
    }
    return map
  }, [isAggregate, groupedView, connector, concreteGroups, filteredTasks])

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const handleTaskCreate = useCallback((data: { title: string; description: string; status: string; tags: string[]; assigneeId: string | null; groupId: string | null }) => {
    const relations: Relation[] = data.assigneeId
      ? [{ predicate: "assignedTo", target: `global:${data.assigneeId}` }]
      : []
    // Temporarily switch to the target group so the connector scopes the item correctly
    const previousGroupId = activeWorkspaceId
    if (data.groupId && hasGroups(connector)) {
      (connector as DataInterface & GroupManager).setCurrentGroup(data.groupId)
    }
    createItem({
      type: "task",
      createdBy: currentUser?.id ?? "user-1",
      data: { title: data.title, description: data.description, status: data.status, position: tasks.length, tags: data.tags },
      relations,
    })
    // Restore previous group
    if (data.groupId && previousGroupId && data.groupId !== previousGroupId && hasGroups(connector)) {
      (connector as DataInterface & GroupManager).setCurrentGroup(previousGroupId)
    }
    if (!panelPinned) setPanelState({ mode: "closed" })
  }, [createItem, currentUser?.id, tasks.length, activeWorkspaceId, connector, panelPinned])

  const handleTaskEdit = useCallback((data: { title: string; description: string; status: string; tags: string[]; assigneeId: string | null; groupId: string | null }) => {
    if (panelState.mode !== "edit") return
    const item = panelState.item
    const relations: Relation[] = data.assigneeId
      ? [{ predicate: "assignedTo", target: `global:${data.assigneeId}` }]
      : []
    updateItem(item.id, {
      data: { ...item.data, title: data.title, description: data.description, status: data.status, tags: data.tags },
      relations,
    })
    // Move item to different group if changed
    if (data.groupId && hasItemGroups(connector)) {
      const currentGroupId = connector.getItemGroupId(item.id)
      if (currentGroupId !== data.groupId) {
        connector.moveItemToGroup(item.id, data.groupId)
      }
    }
    if (!panelPinned) setPanelState({ mode: "closed" })
  }, [panelState, updateItem, connector, panelPinned])

  const handleTaskDelete = useCallback(() => {
    if (panelState.mode !== "edit") return
    deleteItem(panelState.item.id)
    setPanelState({ mode: "closed" })
  }, [panelState, deleteItem])

  const viewModeToggle = isAggregate ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          {groupedView ? <LayoutList className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={!groupedView}
          onCheckedChange={() => setGroupedView(false)}
        >
          Zusammengeführt
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={groupedView}
          onCheckedChange={() => setGroupedView(true)}
        >
          Nach Gruppe
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : undefined

  const moveToGroup = useCallback((itemId: string, targetGroupId: string) => {
    if (!hasItemGroups(connector)) return
    const currentGroupId = connector.getItemGroupId(itemId)
    if (currentGroupId !== targetGroupId) {
      connector.moveItemToGroup(itemId, targetGroupId)
    }
  }, [connector])

  const handleGroupDrop = useCallback((e: DragEvent<HTMLDivElement>, targetGroupId: string) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData("text/plain")
    if (!itemId) return
    moveToGroup(itemId, targetGroupId)
  }, [moveToGroup])

  // Stable map of group-specific external drop handlers (avoids new closures per render)
  const externalDropHandlers = useMemo(() => {
    if (!tasksByGroup) return new Map<string, (itemId: string, newStatus: string, position: number) => void>()
    const map = new Map<string, (itemId: string, newStatus: string, position: number) => void>()
    for (const g of concreteGroups) {
      map.set(g.id, (itemId: string, newStatus: string, position: number) => {
        const item = tasks.find((t) => t.id === itemId)
        if (!item) return

        // Move to target group first
        moveToGroup(itemId, g.id)

        // Recalculate positions scoped to the TARGET GROUP's items in the target column
        const groupItems = tasksByGroup.get(g.id) ?? []
        const columnItems = groupItems
          .filter((t) => {
            const s = (t.data.status as string) ?? "todo"
            return s === newStatus && t.id !== itemId
          })
          .sort((a, b) => ((a.data.position as number) ?? 0) - ((b.data.position as number) ?? 0))

        columnItems.splice(position, 0, item)
        for (let i = 0; i < columnItems.length; i++) {
          const t = columnItems[i]
          updateItem(t.id, { data: { ...t.data, status: newStatus, position: i } })
        }
      })
    }
    return map
  }, [concreteGroups, moveToGroup, tasks, tasksByGroup, updateItem])

  return (
    <div className="space-y-4">
      <KanbanToolbar
        items={tasks}
        users={members}
        currentUserId={currentUser?.id}
        onFilterChange={setFilter}
        onCreateItem={handleCreateItem}
        onEditColumns={() => console.log("Edit columns")}
        extraActions={viewModeToggle}
      />

      {isAggregate && groupedView && tasksByGroup ? (
        <div className="space-y-6">
          {concreteGroups.map((group) => {
            const groupTasks = tasksByGroup.get(group.id) ?? []
            if (groupTasks.length === 0 && dragOverGroupId !== group.id) return null
            const isCollapsed = collapsedGroups.has(group.id)
            const isDragOver = dragOverGroupId === group.id
            return (
              <div key={group.id}>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setDragOverGroupId(group.id)
                  }}
                  onDragLeave={(e) => {
                    const related = e.relatedTarget as Node | null
                    if (related && e.currentTarget.contains(related)) return
                    setDragOverGroupId((prev) => prev === group.id ? null : prev)
                  }}
                  onDrop={(e) => {
                    setDragOverGroupId(null)
                    handleGroupDrop(e, group.id)
                  }}
                  className={`flex items-center gap-2 mb-3 px-2 py-1 -mx-2 rounded-lg transition-colors${isDragOver ? " bg-primary/10 ring-2 ring-primary/30" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    }
                    {group.name}
                    <span className="text-xs font-normal text-muted-foreground">({groupTasks.length})</span>
                  </button>
                </div>
                {!isCollapsed && (
                  <KanbanBoard
                    items={groupTasks}
                    users={members}
                    onMoveItem={handleMoveItem}
                    onItemClick={handleItemClick}
                    onExternalDrop={externalDropHandlers.get(group.id)}
                  />
                )}
              </div>
            )
          })}
          {(tasksByGroup.get("__ungrouped__") ?? []).length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => toggleGroupCollapse("__ungrouped__")}
                className="flex items-center gap-2 mb-3 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                {collapsedGroups.has("__ungrouped__")
                  ? <ChevronRight className="h-4 w-4" />
                  : <ChevronDown className="h-4 w-4" />
                }
                Ohne Gruppe
                <span className="text-xs font-normal">({tasksByGroup.get("__ungrouped__")!.length})</span>
              </button>
              {!collapsedGroups.has("__ungrouped__") && (
                <KanbanBoard
                  items={tasksByGroup.get("__ungrouped__")!}
                  users={members}
                  onMoveItem={handleMoveItem}
                  onItemClick={handleItemClick}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <KanbanBoard
          items={filteredTasks}
          users={members}
          onMoveItem={handleMoveItem}
          onItemClick={handleItemClick}
        />
      )}
      <AdaptivePanel
        open={panelState.mode !== "closed"}
        onClose={handleForceClosePanel}
        allowedModes={["modal", "sidebar", "drawer"]}
        sidebarWidth="420px"
        sidebarMinWidth="300px"
        pinned={panelPinned}
        onPinnedChange={setPanelPinned}
      >
        {panelState.mode === "edit" && (
          <KanbanTaskForm
            key={panelState.item.id}
            onSubmit={handleTaskEdit}
            onCancel={handleClosePanel}
            onDelete={handleTaskDelete}
            initialData={{
              title: String(panelState.item.data.title ?? ""),
              description: String(panelState.item.data.description ?? ""),
              status: String(panelState.item.data.status ?? "todo"),
              tags: (panelState.item.data.tags as string[]) ?? [],
              assigneeId: (panelState.item.relations ?? [])
                .find((r) => r.predicate === "assignedTo")
                ?.target.replace(/^global:/, "") ?? null,
              groupId: hasItemGroups(connector)
                ? connector.getItemGroupId(panelState.item.id)
                : activeWorkspaceId,
            }}
            users={members}
            groups={groups}
            availableTags={availableTags}
          />
        )}
        {panelState.mode === "create" && (
          <KanbanTaskForm
            onSubmit={handleTaskCreate}
            onCancel={handleClosePanel}
            users={members}
            groups={groups}
            defaultGroupId={isAggregate ? null : activeWorkspaceId}
            availableTags={availableTags}
          />
        )}
      </AdaptivePanel>
    </div>
  )
}

function RelayStatusBadgeWrapper() {
  const { state, pendingCount } = useRelayStatus()
  return <RelayStatusBadge state={state} pendingCount={pendingCount} />
}

/**
 * Global incoming event dialogs — counter-verify, space invite, mutual verification.
 * Must be rendered inside IncomingEventsProvider.
 */
function IncomingEventDialogs() {
  const connector = useConnector()
  const { incomingVerification, spaceInvite, mutualVerification, dismiss } = useIncomingEvents()

  const handleCounterVerify = async () => {
    if (!incomingVerification || !hasSignedClaims(connector)) return
    await connector.counterVerify(incomingVerification.fromId)
    dismiss()
  }

  const navigate = useNavigate()
  const handleOpenSpace = () => {
    if (spaceInvite) {
      navigate(`/spaces/${spaceInvite.spaceId}/feed`)
    }
    dismiss()
  }

  return (
    <>
      <IncomingVerificationDialog
        open={!!incomingVerification}
        fromId={incomingVerification?.fromId ?? ""}
        fromName={incomingVerification?.fromName}
        onConfirm={handleCounterVerify}
        onReject={dismiss}
      />
      <IncomingSpaceInviteDialog
        open={!!spaceInvite}
        spaceName={spaceInvite?.spaceName ?? ""}
        inviterName={spaceInvite?.fromName}
        onOpen={handleOpenSpace}
        onDismiss={dismiss}
      />
      <MutualVerificationDialog
        open={!!mutualVerification}
        peerName={mutualVerification?.fromName}
        onDismiss={dismiss}
      />
    </>
  )
}

function Home({ activeConnectorId, onConnectorChange }: { activeConnectorId: string; onConnectorChange: (id: string) => void }) {
  const connector = useConnector()
  const navigate = useNavigate()
  const { spaceId: urlSpaceId, module: urlModule, itemId: urlItemId } = useParams<{ spaceId?: string; module?: string; itemId?: string }>()
  const { data: groups } = useGroups()
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const inviteMember = useInviteMember()
  const removeMember = useRemoveMember()
  const { data: currentUser } = useCurrentUser()
  const { activeContacts, pendingContacts, contacts: allContacts, removeContact, updateContactName, supportsContacts } = useContacts()
  const verification = useVerification()

  // Dialog state
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false)
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false)
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const profileData = useMemo(() => ({
    did: currentUser?.id ?? "",
    name: currentUser?.displayName ?? "",
    bio: "",
    avatar: currentUser?.avatarUrl,
  }), [currentUser])

  const handleSaveProfile = useCallback(async (updates: { name: string; bio: string }) => {
    if (hasProfile(connector)) {
      await connector.updateMyProfile(updates)
    }
  }, [connector])

  // Group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupDialogMode, setGroupDialogMode] = useState<GroupDialogMode>({ type: "create" })
  const openCreateDialog = useCallback(() => {
    setGroupDialogMode({ type: "create" })
    setGroupDialogOpen(true)
  }, [])

  const openEditDialog = useCallback(async (workspace: Workspace) => {
    const group = groups.find((g) => g.id === workspace.id)
    if (!group) return
    let members: User[] = []
    if (hasGroups(connector)) {
      try {
        members = await (connector as DataInterface & GroupManager).getMembers(group.id)
      } catch { /* ignore */ }
    }
    setGroupDialogMode({ type: "edit", group, members })
    setGroupDialogOpen(true)
  }, [groups, connector])

  const basePath = import.meta.env.BASE_URL
  const workspaces: Workspace[] = useMemo(
    () => groups.map((g) => ({
      id: g.id,
      name: g.name,
      avatar: g.data?.avatar ? `${basePath}${g.data.avatar}` : undefined,
    })),
    [groups, basePath]
  )

  const userData: UserData = useMemo(
    () => ({
      id: currentUser?.id ?? "",
      name: currentUser?.displayName ?? "Laden...",
      email: "",
      avatar: currentUser?.avatarUrl,
    }),
    [currentUser]
  )

  const [isDark, setIsDark] = useState(false)

  // Derive active workspace from URL params (with fallback to localStorage → first space)
  const activeWorkspace: Workspace | null = useMemo(() => {
    if (urlSpaceId) {
      const found = workspaces.find((w) => w.id === urlSpaceId)
      if (found) return found
      // Space ID from URL but not found in list — might still be loading
      if (workspaces.length === 0) return { id: urlSpaceId, name: "" }
      return null // Unknown space
    }
    // No space in URL — try localStorage, then first workspace
    const savedId = localStorage.getItem(STORAGE_KEY_GROUP)
    if (savedId) {
      const found = workspaces.find((w) => w.id === savedId)
      if (found) return found
    }
    return workspaces[0] ?? null
  }, [urlSpaceId, workspaces])

  // Derive active module from URL params
  const VALID_MODULES = ["feed", "kanban", "calendar", "map"]
  const activeModule = urlModule && VALID_MODULES.includes(urlModule) ? urlModule : (localStorage.getItem(STORAGE_KEY_MODULE) ?? "feed")

  // Redirect to URL with space/module if not already there
  useEffect(() => {
    if (workspaces.length === 0) return
    if (!urlSpaceId && activeWorkspace) {
      navigate(`/spaces/${activeWorkspace.id}/${activeModule}`, { replace: true })
    }
  }, [workspaces.length, urlSpaceId, activeWorkspace, activeModule, navigate])

  // Sync connector current group when workspace changes
  useEffect(() => {
    if (activeWorkspace && hasGroups(connector)) {
      (connector as DataInterface & GroupManager).setCurrentGroup(activeWorkspace.id)
    }
  }, [activeWorkspace?.id, connector])

  // Save to localStorage for next session
  useEffect(() => {
    if (activeWorkspace) localStorage.setItem(STORAGE_KEY_GROUP, activeWorkspace.id)
    if (urlModule && VALID_MODULES.includes(urlModule)) localStorage.setItem(STORAGE_KEY_MODULE, urlModule)
  }, [activeWorkspace?.id, urlModule])

  // Derive available modules from active group's data.modules
  const activeGroup = groups.find((g) => g.id === activeWorkspace?.id)
  const groupModuleIds = (activeGroup?.data?.modules as string[] | undefined) ?? ["feed", "kanban", "calendar", "map"]
  const supportsMessaging = hasMessaging(connector)
  const modules: Module[] = useMemo(
    () => groupModuleIds
      .filter((id) => MODULE_ICONS[id])
      .map((id) => ({ id, label: MODULE_LABELS[id] ?? id, icon: MODULE_ICONS[id] })),
    [groupModuleIds.join(",")]
  )

  // When switching workspace, navigate to URL
  const handleWorkspaceChange = useCallback((workspace: Workspace) => {
    const group = groups.find((g) => g.id === workspace.id)
    const mods = (group?.data?.modules as string[] | undefined) ?? ["feed", "kanban", "calendar", "map"]
    const mod = mods.includes(activeModule) ? activeModule : (mods[0] ?? "feed")
    navigate(`/spaces/${workspace.id}/${mod}`)
  }, [groups, activeModule, navigate])

  const handleModuleChange = (moduleId: string) => {
    if (activeWorkspace) {
      navigate(`/spaces/${activeWorkspace.id}/${moduleId}`)
    }
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle("dark")
  }

  return (
    <AppShell>
      <Navbar>
        <NavbarStart>
          {activeWorkspace ? (
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onWorkspaceChange={handleWorkspaceChange}
              onCreateWorkspace={openCreateDialog}
              onEditWorkspace={openEditDialog}
            />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={openCreateDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue Gruppe
            </Button>
          )}
        </NavbarStart>
        <NavbarCenter>
          <ModuleTabs
            modules={modules}
            activeModule={activeModule}
            onModuleChange={handleModuleChange}
          />
        </NavbarCenter>
        <NavbarEnd>
          {supportsMessaging && <RelayStatusBadgeWrapper />}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <UserMenu
            user={userData}
            onProfile={() => setProfileDialogOpen(true)}
            onContacts={supportsContacts ? () => setContactsDialogOpen(true) : undefined}
            contactCount={activeContacts.length}
            onLogout={isAuthenticatable(connector) ? async () => {
              await connector.logout()
              window.location.reload()
            } : undefined}
          />
        </NavbarEnd>
      </Navbar>

      <AppShellMain withBottomNav>
        {urlSpaceId && !activeWorkspace && workspaces.length > 0 ? (
          <div className="container mx-auto px-4 pt-12 max-w-md text-center">
            <p className="text-lg font-medium text-foreground">Du bist kein Mitglied dieses Spaces</p>
            <p className="text-sm text-muted-foreground mt-2">Der Space existiert nicht oder du hast keinen Zugang.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Zurück zur Übersicht</Button>
          </div>
        ) : (
          <div className={`container mx-auto px-4 pt-6 ${activeModule === "kanban" ? "max-w-5xl" : "max-w-2xl"}`}>
            {activeModule === "feed" && <FeedView groupId={activeWorkspace?.id ?? ""} onInvite={() => activeWorkspace && openEditDialog(activeWorkspace)} />}
            {activeModule === "kanban" && <KanbanView activeWorkspaceId={activeWorkspace?.id ?? null} groups={groups} selectedItemId={urlItemId} onItemSelect={(id) => navigate(`/spaces/${activeWorkspace?.id}/${activeModule}/item/${id}`)} onItemClose={() => navigate(`/spaces/${activeWorkspace?.id}/${activeModule}`)} />}
            {activeModule === "map" && <MapView />}
            {activeModule === "calendar" && <CalendarViewWrapper />}
          </div>
        )}
      </AppShellMain>

      <BottomNav
        items={modules}
        activeItem={activeModule}
        onItemChange={handleModuleChange}
      />
      <GroupDialog
        key={groupDialogMode.type === "edit" ? `edit-${groupDialogMode.group.id}` : "create"}
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        mode={groupDialogMode}
        contacts={allContacts}
        onCreateGroup={async (name) => {
          const group = await createGroup(name)
          handleWorkspaceChange({ id: group.id, name: group.name })
        }}
        onUpdateGroup={async (id, updates) => {
          await updateGroup(id, updates)
        }}
        onDeleteGroup={async (id) => {
          await deleteGroup(id)
          // If deleted group was active, switch to first remaining
          if (activeWorkspace?.id === id) {
            const remaining = workspaces.filter((w) => w.id !== id)
            if (remaining.length > 0) {
              handleWorkspaceChange(remaining[0])
            } else {
              localStorage.removeItem(STORAGE_KEY_GROUP)
              navigate("/")
            }
          }
        }}
        onInviteMember={async (groupId, userId) => {
          await inviteMember(groupId, userId)
        }}
        onRemoveMember={async (groupId, userId) => {
          await removeMember(groupId, userId)
        }}
      />
      <ProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        profile={profileData}
        onSave={handleSaveProfile}
      />

      {/* Contacts Dialog */}
      <ContactsDialog
        open={contactsDialogOpen}
        onOpenChange={setContactsDialogOpen}
        activeContacts={activeContacts}
        pendingContacts={pendingContacts}
        onRemove={removeContact}
        onEditName={updateContactName}
        onVerify={() => { setContactsDialogOpen(false); setVerifyDialogOpen(true) }}
        onAdd={() => { setContactsDialogOpen(false); setVerifyDialogOpen(true) }}
      />

      <VerificationDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        challenge={verification.challenge}
        peerInfo={verification.peerInfo}
        isProcessing={verification.isProcessing}
        error={verification.error}
        onCreateChallenge={verification.createChallenge}
        onScanChallenge={verification.scanChallenge}
        onConfirmVerification={verification.confirmVerification}
        onReset={verification.reset}
      />

      {/* Incoming event dialogs */}
      <IncomingEventDialogs />

      {/* Connector FAB — bottom-left, above BottomNav */}
      <div className="fixed bottom-20 left-4 z-50">
        <ConnectorSwitcher
          connectors={CONNECTOR_OPTIONS}
          activeConnector={activeConnectorId}
          onConnectorChange={onConnectorChange}
        />
      </div>
    </AppShell>
  )
}

const demoData = {
  items: demoItems,
  groups: demoGroups,
  users: demoUsers,
  groupMembers: demoGroupMembers,
  groupItems: demoGroupItems,
}

async function createConnector(type: string): Promise<DataInterface> {
  if (type === "wot") {
    const { WotConnector } = await import("@real-life-stack/wot-connector")
    const connector = new WotConnector({
      relayUrl: "wss://relay.utopia-lab.org",
      profilesUrl: "https://profiles.utopia-lab.org",
      vaultUrl: "https://vault.utopia-lab.org",
    })
    await connector.init()
    return connector
  }
  if (type === "local") {
    const c = new LocalConnector(demoData)
    await c.init()
    return c
  }
  const c = new MockConnector()
  await c.init()
  return c
}

const STORAGE_KEY_CONNECTOR = "rls-connector"
const STORAGE_KEY_GROUP = "rls-active-group"
const STORAGE_KEY_MODULE = "rls-active-module"

function getInitialConnectorId(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get("connector") ?? localStorage.getItem(STORAGE_KEY_CONNECTOR) ?? "mock"
}

// Lazy-load the DIDAuthScreen to keep WoT bundle separate
const LazyDIDAuthScreen = lazy(() =>
  import("@real-life-stack/wot-connector/components").then((m) => ({
    default: m.DIDAuthScreen,
  }))
)

function AuthGate({ connector, children }: { connector: DataInterface; children: React.ReactNode }) {
  // Only check auth state once at mount — do NOT subscribe to changes.
  // The DIDAuthScreen controls when onAuthenticated fires (after seed backup etc.),
  // so reacting to auth state changes would skip the onboarding wizard.
  const [authenticated, setAuthenticated] = useState(() => {
    if (!isAuthenticatable(connector)) return true
    return connector.getAuthState().current.status === "authenticated"
  })

  if (authenticated) {
    return <>{children}</>
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Lade Auth…</div>
        </div>
      }
    >
      <LazyDIDAuthScreen
        connector={connector as any}
        onAuthenticated={() => setAuthenticated(true)}
      />
    </Suspense>
  )
}

export default function App() {
  const [connectorId, setConnectorId] = useState(getInitialConnectorId)
  const [connector, setConnector] = useState<DataInterface | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONNECTOR, connectorId)
    setLoading(true)
    setConnector(null)
    let cancelled = false
    let instance: DataInterface | null = null
    createConnector(connectorId).then((c) => {
      if (cancelled) return // Don't dispose — global singletons (PersonalDoc) are shared
      instance = c
      setConnector(c)
      setLoading(false)
    }).catch((err) => {
      console.error("[App] Failed to create connector:", err)
      if (!cancelled) setLoading(false) // Show empty state instead of infinite loader
    })
    return () => {
      cancelled = true
      // Only dispose on real unmount (connector switch), not Strict Mode re-mount.
      // We detect this by checking if the connector was actually set.
      if (instance && typeof (instance as any).dispose === "function") {
        (instance as any).dispose()
      }
    }
  }, [connectorId])

  if (loading || !connector) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Lade {CONNECTOR_OPTIONS.find((o) => o.id === connectorId)?.name ?? connectorId}…
        </div>
      </div>
    )
  }

  return (
    <ConnectorProvider connector={connector} key={connectorId}>
      <IncomingEventsProvider>
        <AuthGate connector={connector}>
          <Routes>
            <Route path="spaces/:spaceId/:module/item/:itemId" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
            <Route path="spaces/:spaceId/item/:itemId" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
            <Route path="spaces/:spaceId/:module" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
            <Route path="spaces/:spaceId" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
            <Route path="profile" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
            <Route path="contacts" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
            <Route path="*" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
          </Routes>
        </AuthGate>
      </IncomingEventsProvider>
    </ConnectorProvider>
  )
}
