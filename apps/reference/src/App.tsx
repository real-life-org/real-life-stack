import { useState, useMemo } from "react"
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
  SimplePostWidget,
  PostCard,
  StatCard,
  ActionCard,
  KanbanBoard,
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
  type Workspace,
  type UserData,
  type Module,
  type Post,
} from "@real-life-stack/toolkit"
import type { Item, User, DataInterface } from "@real-life-stack/data-interface"
import { demoItems, demoGroups, demoUsers, demoGroupMembers } from "@real-life-stack/data-interface/demo-data"
import { MockConnector } from "@real-life-stack/mock-connector"
import { LocalConnector } from "@real-life-stack/local-connector"

const modules: Module[] = [
  { id: "feed", label: "Feed", icon: Newspaper },
  { id: "kanban", label: "Kanban", icon: Columns3 },
  { id: "map", label: "Karte", icon: Map },
  { id: "calendar", label: "Kalender", icon: Calendar },
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

function KanbanView() {
  const { data: tasks } = useItems({ type: "task" })
  const { data: members } = useMembers("group-1")
  const { mutate: updateItem } = useUpdateItem()

  const handleMoveItem = (itemId: string, newStatus: string) => {
    const item = tasks.find((t) => t.id === itemId)
    if (!item) return
    updateItem(itemId, { data: { ...item.data, status: newStatus } })
  }

  return (
    <div className="space-y-4">
      <KanbanBoard
        items={tasks}
        users={members}
        onMoveItem={handleMoveItem}
        onItemClick={(item) => console.log("Clicked:", item.id)}
      />
    </div>
  )
}

function Home() {
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

  // Set first workspace as active once loaded
  if (!activeWorkspace && workspaces.length > 0) {
    setActiveWorkspace(workspaces[0])
  }

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
              onWorkspaceChange={setActiveWorkspace}
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

      <AppShellMain withBottomNav className={`container mx-auto px-4 py-6 ${activeModule === "kanban" ? "max-w-5xl" : "max-w-2xl"}`}>
        {activeModule === "feed" && <FeedView />}
        {activeModule === "kanban" && <KanbanView />}
        {activeModule === "map" && <MapView />}
        {activeModule === "calendar" && <CalendarViewWrapper />}
      </AppShellMain>

      <BottomNav
        items={modules}
        activeItem={activeModule}
        onItemChange={handleModuleChange}
      />
    </AppShell>
  )
}

// Connector selection via URL parameter: ?connector=local or ?connector=mock (default)
function createConnector(): DataInterface {
  const params = new URLSearchParams(window.location.search)
  const type = params.get("connector")

  if (type === "local") {
    return new LocalConnector({
      items: demoItems,
      groups: demoGroups,
      users: demoUsers,
      groupMembers: demoGroupMembers,
    })
  }

  return new MockConnector()
}

// Preserve connector across HMR — avoid losing in-memory state
const connector: DataInterface = import.meta.hot?.data?.connector ?? createConnector()
if (import.meta.hot) {
  import.meta.hot.data.connector = connector
}

export default function App() {
  return (
    <ConnectorProvider connector={connector}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </ConnectorProvider>
  )
}
