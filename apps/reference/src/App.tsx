import { useState, useMemo, useCallback, useEffect, type DragEvent, lazy, Suspense } from "react"
import { Routes, Route } from "react-router-dom"
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
  Contact,
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
  ContactList,
  AddContactDialog,
  RelayStatusBadge,
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
import { hasGroups, isAuthenticatable, hasContacts, hasMessaging } from "@real-life-stack/data-interface"
import { demoItems, demoGroups, demoUsers, demoGroupMembers, demoGroupItems } from "@real-life-stack/data-interface/demo-data"
import { MockConnector } from "@real-life-stack/mock-connector"
import { LocalConnector } from "@real-life-stack/local-connector"

const MODULE_ICONS: Record<string, typeof Newspaper> = {
  feed: Newspaper,
  map: MapIcon,
  calendar: Calendar,
  kanban: Columns3,
  contacts: Contact,
}

const MODULE_LABELS: Record<string, string> = {
  feed: "Feed",
  map: "Karte",
  calendar: "Kalender",
  kanban: "Kanban",
  contacts: "Kontakte",
}

const CONNECTOR_OPTIONS: ConnectorOption[] = [
  { id: "mock", name: "Mock", description: "In-Memory, kein Speichern" },
  { id: "local", name: "Local", description: "IndexedDB, persistent" },
  { id: "wot", name: "Web of Trust", description: "E2E-verschlüsselt, Multi-Device" },
]

// Helper: resolve user info from members list
function resolveAuthor(userId: string, members: User[]) {
  const member = members.find((m) => m.id === userId)
  return {
    name: member?.displayName ?? userId,
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
function itemToPost(item: Item, members: User[]): Post {
  return {
    id: item.id,
    author: resolveAuthor(item.createdBy, members),
    content: String(item.data.content ?? item.data.description ?? ""),
    timestamp: timeAgo(item.createdAt),
    likes: 0,
    comments: 0,
    type: "text",
  }
}

function FeedView() {
  const { data: posts } = useItems({ type: "post" })
  const { data: events } = useItems({ type: "event" })
  const { data: members } = useMembers("group-1")
  const { mutate: createItem } = useCreateItem()

  const mappedPosts = useMemo(
    () =>
      [...posts]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((item) => itemToPost(item, members)),
    [posts, members]
  )

  const handlePost = (content: string) => {
    createItem({
      type: "post",
      createdBy: "user-1",
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
          onClick={() => console.log("Invite")}
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

function KanbanView({ activeWorkspaceId, groups }: { activeWorkspaceId: string | null; groups: Group[] }) {
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
  }, [])

  const handleClosePanel = useCallback(() => {
    if (!panelPinned) setPanelState({ mode: "closed" })
  }, [panelPinned])

  // Explicit close — always closes, ignoring pinned state (used by X button / drawer drag)
  const handleForceClosePanel = useCallback(() => {
    setPanelState({ mode: "closed" })
  }, [])

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
    if (!isAggregate || !groupedView || !("getItemGroupId" in connector)) return null
    const c = connector as DataInterface & { getItemGroupId(id: string): string | null }
    const map = new Map<string, Item[]>()
    for (const g of concreteGroups) {
      map.set(g.id, [])
    }
    // Collect items without a group under a special key
    map.set("__ungrouped__", [])
    for (const task of filteredTasks) {
      const gid = c.getItemGroupId(task.id)
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
    if (data.groupId && "moveItemToGroup" in connector) {
      const c = connector as DataInterface & { getItemGroupId(id: string): string | null; moveItemToGroup(id: string, gid: string): void }
      const currentGroupId = c.getItemGroupId(item.id)
      if (currentGroupId !== data.groupId) {
        c.moveItemToGroup(item.id, data.groupId)
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
    if (!("moveItemToGroup" in connector)) return
    const c = connector as DataInterface & { getItemGroupId(id: string): string | null; moveItemToGroup(id: string, gid: string): void }
    const currentGroupId = c.getItemGroupId(itemId)
    if (currentGroupId !== targetGroupId) {
      c.moveItemToGroup(itemId, targetGroupId)
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
              groupId: "getItemGroupId" in connector
                ? (connector as DataInterface & { getItemGroupId(id: string): string | null }).getItemGroupId(panelState.item.id)
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

function ContactsView() {
  const { activeContacts, pendingContacts, addContact, removeContact, updateContactName } = useContacts()
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Kontakte</h2>
          <p className="text-sm text-muted-foreground">
            {activeContacts.length} verifiziert · {pendingContacts.length} ausstehend
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)} size="sm">
          <UserPlus className="h-4 w-4 mr-2" />
          Hinzufügen
        </Button>
      </div>

      {pendingContacts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Ausstehend</h3>
          <ContactList
            contacts={pendingContacts}
            onRemove={removeContact}
            onEditName={updateContactName}
          />
        </div>
      )}

      <div className="space-y-2">
        {activeContacts.length > 0 && pendingContacts.length > 0 && (
          <h3 className="text-sm font-medium text-muted-foreground">Verifiziert</h3>
        )}
        <ContactList
          contacts={activeContacts}
          onRemove={removeContact}
          onEditName={updateContactName}
          emptyMessage="Noch keine verifizierten Kontakte"
        />
      </div>

      <AddContactDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={addContact}
      />
    </div>
  )
}

function RelayStatusBadgeWrapper() {
  const { state, pendingCount } = useRelayStatus()
  return <RelayStatusBadge state={state} pendingCount={pendingCount} />
}

function Home({ activeConnectorId, onConnectorChange }: { activeConnectorId: string; onConnectorChange: (id: string) => void }) {
  const connector = useConnector()
  const { data: groups } = useGroups()
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const inviteMember = useInviteMember()
  const removeMember = useRemoveMember()
  const { data: currentUser } = useCurrentUser()

  // Profile dialog state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const profileData = useMemo(() => {
    const did = (connector as any).getDid?.() ?? currentUser?.id ?? ""
    return {
      did,
      name: currentUser?.displayName ?? "",
      bio: "",
      avatar: currentUser?.avatarUrl,
    }
  }, [connector, currentUser])

  const handleSaveProfile = useCallback(async (updates: { name: string; bio: string }) => {
    if (typeof (connector as any).updateProfile === "function") {
      await (connector as any).updateProfile(updates)
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

  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(() => {
    const savedId = localStorage.getItem(STORAGE_KEY_GROUP)
    if (savedId) {
      // Will be resolved once workspaces load
      return { id: savedId, name: "" }
    }
    return null
  })
  const [activeModule, setActiveModule] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_MODULE) ?? "feed"
  })
  const [isDark, setIsDark] = useState(false)

  // Resolve active workspace once workspaces are loaded
  useEffect(() => {
    if (workspaces.length === 0) return
    // If we have a saved workspace ID, try to find it in the loaded list
    if (activeWorkspace) {
      const found = workspaces.find((w) => w.id === activeWorkspace.id)
      if (found) {
        // Update name in case it was a placeholder from localStorage
        if (found.name !== activeWorkspace.name) {
          setActiveWorkspace(found)
        }
        if (hasGroups(connector)) {
          (connector as DataInterface & GroupManager).setCurrentGroup(found.id)
        }
        return
      }
    }
    // Fallback: select first workspace
    setActiveWorkspace(workspaces[0])
    localStorage.setItem(STORAGE_KEY_GROUP, workspaces[0].id)
    if (hasGroups(connector)) {
      (connector as DataInterface & GroupManager).setCurrentGroup(workspaces[0].id)
    }
  }, [workspaces, connector]) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive available modules from active group's data.modules
  const activeGroup = groups.find((g) => g.id === activeWorkspace?.id)
  const groupModuleIds = (activeGroup?.data?.modules as string[] | undefined) ?? ["feed", "kanban", "calendar", "map"]
  const supportsContacts = hasContacts(connector)
  const supportsMessaging = hasMessaging(connector)
  const modules: Module[] = useMemo(
    () => {
      const base = groupModuleIds
        .filter((id) => MODULE_ICONS[id])
        .map((id) => ({ id, label: MODULE_LABELS[id] ?? id, icon: MODULE_ICONS[id] }))
      if (supportsContacts) {
        base.push({ id: "contacts", label: MODULE_LABELS.contacts, icon: MODULE_ICONS.contacts })
      }
      return base
    },
    [groupModuleIds.join(","), supportsContacts]
  )

  // When switching workspace, update connector scope and reset module if needed
  const handleWorkspaceChange = useCallback((workspace: Workspace) => {
    setActiveWorkspace(workspace)
    localStorage.setItem(STORAGE_KEY_GROUP, workspace.id)
    if (hasGroups(connector)) {
      (connector as DataInterface & GroupManager).setCurrentGroup(workspace.id)
    }
    const group = groups.find((g) => g.id === workspace.id)
    const mods = (group?.data?.modules as string[] | undefined) ?? ["feed", "kanban", "calendar", "map"]
    if (!mods.includes(activeModule)) {
      const newModule = mods[0] ?? "feed"
      setActiveModule(newModule)
      localStorage.setItem(STORAGE_KEY_MODULE, newModule)
    }
  }, [connector, groups, activeModule])

  const handleModuleChange = (moduleId: string) => {
    setActiveModule(moduleId)
    localStorage.setItem(STORAGE_KEY_MODULE, moduleId)
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
          <ConnectorSwitcher
            connectors={CONNECTOR_OPTIONS}
            activeConnector={activeConnectorId}
            onConnectorChange={onConnectorChange}
          />
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
            onLogout={isAuthenticatable(connector) ? async () => {
              await connector.logout()
              window.location.reload()
            } : undefined}
          />
        </NavbarEnd>
      </Navbar>

      <AppShellMain withBottomNav>
        <div className={`container mx-auto px-4 pt-6 ${activeModule === "kanban" ? "max-w-5xl" : "max-w-2xl"}`}>
          {activeModule === "feed" && <FeedView />}
          {activeModule === "kanban" && <KanbanView activeWorkspaceId={activeWorkspace?.id ?? null} groups={groups} />}
          {activeModule === "map" && <MapView />}
          {activeModule === "calendar" && <CalendarViewWrapper />}
          {activeModule === "contacts" && <ContactsView />}
        </div>
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
              setActiveWorkspace(null)
              localStorage.removeItem(STORAGE_KEY_GROUP)
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
    createConnector(connectorId).then((c) => {
      setConnector(c)
      setLoading(false)
    })
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
      <AuthGate connector={connector}>
        <Routes>
          <Route path="/" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
        </Routes>
      </AuthGate>
    </ConnectorProvider>
  )
}
