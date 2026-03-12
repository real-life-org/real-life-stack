import { useState, useMemo, useCallback, useEffect } from "react"
import { Routes, Route } from "react-router-dom"
import {
  Newspaper,
  Map,
  Calendar,
  Users,
  MessageCircle,
  Plus,
  UserPlus,
  MapPin,
  Sun,
  Moon,
  Columns3,
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
  ConnectorProvider,
  useItems,
  useUpdateItem,
  useMembers,
  useGroups,
  useCurrentUser,
  useCreateItem,
  useConnector,
  type Workspace,
  type UserData,
  type Module,
  type Post,
  type KanbanFilter,
  type ConnectorOption,
} from "@real-life-stack/toolkit"
import type { Item, User, Relation, Group, DataInterface, GroupManager } from "@real-life-stack/data-interface"
import { hasGroups } from "@real-life-stack/data-interface"
import { demoItems, demoGroups, demoUsers, demoGroupMembers, demoGroupItems } from "@real-life-stack/data-interface/demo-data"
import { MockConnector } from "@real-life-stack/mock-connector"
import { LocalConnector } from "@real-life-stack/local-connector"

const MODULE_ICONS: Record<string, typeof Newspaper> = {
  feed: Newspaper,
  map: Map,
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
  const [filter, setFilter] = useState<KanbanFilter>({
    searchText: "",
    assignedTo: null,
    myTasksOnly: false,
    tags: [],
  })
  const [panelState, setPanelState] = useState<KanbanPanelState>({ mode: "closed" })
  const [panelPinned, setPanelPinned] = useState(false)

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

  return (
    <div className="space-y-4">
      <KanbanToolbar
        items={tasks}
        users={members}
        currentUserId={currentUser?.id}
        onFilterChange={setFilter}
        onCreateItem={handleCreateItem}
        onEditColumns={() => console.log("Edit columns")}
      />
      <KanbanBoard
        items={filteredTasks}
        users={members}
        onMoveItem={handleMoveItem}
        onItemClick={handleItemClick}
      />
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

function Home({ activeConnectorId, onConnectorChange }: { activeConnectorId: string; onConnectorChange: (id: string) => void }) {
  const connector = useConnector()
  const { data: groups } = useGroups()
  const { data: currentUser } = useCurrentUser()

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

  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
  const [activeModule, setActiveModule] = useState("feed")
  const [isDark, setIsDark] = useState(false)

  // Set first workspace as active once loaded and sync with connector
  useEffect(() => {
    if (!activeWorkspace && workspaces.length > 0) {
      setActiveWorkspace(workspaces[0])
      if (hasGroups(connector)) {
        (connector as DataInterface & GroupManager).setCurrentGroup(workspaces[0].id)
      }
    }
  }, [activeWorkspace, workspaces, connector])

  // Derive available modules from active group's data.modules
  const activeGroup = groups.find((g) => g.id === activeWorkspace?.id)
  const groupModuleIds = (activeGroup?.data?.modules as string[] | undefined) ?? ["feed", "kanban", "calendar", "map"]
  const modules: Module[] = useMemo(
    () => groupModuleIds
      .filter((id) => MODULE_ICONS[id])
      .map((id) => ({ id, label: MODULE_LABELS[id] ?? id, icon: MODULE_ICONS[id] })),
    [groupModuleIds.join(",")]
  )

  // When switching workspace, update connector scope and reset module if needed
  const handleWorkspaceChange = useCallback((workspace: Workspace) => {
    setActiveWorkspace(workspace)
    if (hasGroups(connector)) {
      (connector as DataInterface & GroupManager).setCurrentGroup(workspace.id)
    }
    const group = groups.find((g) => g.id === workspace.id)
    const mods = (group?.data?.modules as string[] | undefined) ?? ["feed", "kanban", "calendar", "map"]
    if (!mods.includes(activeModule)) {
      setActiveModule(mods[0] ?? "feed")
    }
  }, [connector, groups, activeModule])

  const handleModuleChange = (moduleId: string) => {
    setActiveModule(moduleId)
  }

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle("dark")
  }

  return (
    <AppShell>
      <Navbar>
        <NavbarStart>
          {activeWorkspace && (
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onWorkspaceChange={handleWorkspaceChange}
              onCreateWorkspace={() => console.log("Create workspace")}
            />
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
            onProfile={() => console.log("Profile")}
            onSettings={() => console.log("Settings")}
            onLogout={() => console.log("Logout")}
          />
        </NavbarEnd>
      </Navbar>

      <AppShellMain withBottomNav>
        <div className={`container mx-auto px-4 pt-6 ${activeModule === "kanban" ? "max-w-5xl" : "max-w-2xl"}`}>
          {activeModule === "feed" && <FeedView />}
          {activeModule === "kanban" && <KanbanView activeWorkspaceId={activeWorkspace?.id ?? null} groups={groups} />}
          {activeModule === "map" && <MapView />}
          {activeModule === "calendar" && <CalendarViewWrapper />}
        </div>
      </AppShellMain>

      <BottomNav
        items={modules}
        activeItem={activeModule}
        onItemChange={handleModuleChange}
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

function createConnector(type: string): DataInterface {
  if (type === "local") {
    return new LocalConnector(demoData)
  }
  return new MockConnector()
}

function getInitialConnectorId(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get("connector") ?? "mock"
}

export default function App() {
  const [connectorId, setConnectorId] = useState(getInitialConnectorId)
  const connector = useMemo(() => createConnector(connectorId), [connectorId])

  return (
    <ConnectorProvider connector={connector} key={connectorId}>
      <Routes>
        <Route path="/" element={<Home activeConnectorId={connectorId} onConnectorChange={setConnectorId} />} />
      </Routes>
    </ConnectorProvider>
  )
}
