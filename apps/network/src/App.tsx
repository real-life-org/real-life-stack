import { useCallback, useEffect, useMemo, useState } from "react"
import { Route, Routes, useNavigate } from "react-router-dom"
import { Moon, Sun } from "lucide-react"
import type { DataInterface, Item } from "@real-life-stack/data-interface"
import { moduleHintsFor } from "@real-life-stack/data-interface"
import {
  ActivityBell,
  ActivityPanelController,
  AdaptivePanel,
  AppShell,
  AppShellMain,
  BottomNav,
  Button,
  CommentNavigationProvider,
  ConnectorProvider,
  CreateHostProvider,
  CreateSheetController,
  DetailHostController,
  DetailHostProvider,
  DraftItemProvider,
  FieldNavigationProvider,
  FilterProvider,
  ModuleOutlet,
  ModulePanelProvider,
  ModuleTabs,
  Navbar,
  NavbarCenter,
  NavbarEnd,
  NavbarStart,
  NotificationBell,
  OpenProfileProvider,
  ProfilePanelContent,
  TagNavigationProvider,
  UnsavedChangesProvider,
  UserMenu,
  WorkspaceSwitcher,
  findModulePresenting,
  getModule,
  initialDarkMode,
  modulePresentsItem,
  useActivity,
  useItemFocus,
  useItems,
  useMembers,
  useNotifications,
  useOptionalCurrentUser,
  type NotificationCandidate,
} from "@real-life-stack/toolkit"
import { MapLibreAdapterProvider } from "@real-life-stack/toolkit/maplibre"
import { UrlFocusProvider as ItemFocusProvider, UnsavedChangesGuard, notificationRoute, useWorkspaceRouting } from "@real-life-stack/toolkit/router"

const THEME_KEY = "rls-network-theme"
/** Der Rückfall, wenn kein Feld ein Modul wählt: die Liste (Spec 01, Der Modul-Host). */
const FALLBACK_MODULE = "collection"

interface AppProps {
  connector: DataInterface
}

/**
 * Die Netzwerk-App ist eine Shell um den Modul-Host: Connector, Router,
 * Fokus in der URL, die zwei Host-Provider, das geteilte Panel — und das
 * Register sagt, welche Flächen es gibt (`module-register.tsx`). Keine Linse
 * wird hier gebaut; Detail, Erstellen, Suche, Filter und Auswahl stellt der
 * Host für jedes Modul gleich (Spec 01, Der Modul-Host, Regel 5).
 *
 * Bis zum 21.09.2026 stand hier eine zweite Fassung von alldem: sechs
 * handverdrahtete Linsen mit eigenem Detail, eigener Suche, eigenem
 * Typfilter und einer Auswahl ohne Adresse.
 */
function NetworkShell() {
  const navigate = useNavigate()
  const {
    groups,
    workspaces,
    activeWorkspace,
    activeModule,
    modules,
    urlSpaceId,
    handleWorkspaceChange,
    handleModuleChange,
  } = useWorkspaceRouting({ fallbackModule: FALLBACK_MODULE })
  const { data: currentUser } = useOptionalCurrentUser()
  const { data: allItems } = useItems()
  const { itemId: offenesItem, focusItem, commentOnItem } = useItemFocus()

  const [isDark, setIsDark] = useState(() => initialDarkMode(THEME_KEY))
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark)
    try {
      window.localStorage.setItem(THEME_KEY, isDark ? "dark" : "light")
    } catch {
      // Applying the in-memory theme must not depend on persistent storage.
    }
  }, [isDark])

  const [drawerHeight, setDrawerHeight] = useState(0)
  const [activityOpen, setActivityOpen] = useState(false)
  const closeActivity = useCallback(() => setActivityOpen(false), [])
  const activity = useActivity()
  const notifications = useNotifications()
  // Eine Benachrichtigung ist EINE Route: Space, Modul und Fokus zugleich.
  const openNotification = useCallback((notification: NotificationCandidate) => {
    navigate(notificationRoute(notification, groups, FALLBACK_MODULE))
    closeActivity()
  }, [closeActivity, groups, navigate])
  // Ein Ziel aus dem rohen Verlauf: Kann das aktive Modul es nicht zeigen,
  // wechselt die Route das Modul mit; sonst nur der Fokus.
  const openEntryTarget = useCallback((targetId: string) => {
    const item = allItems.find(({ id }) => id === targetId)
    const hints = item ? moduleHintsFor(item) : undefined
    if (item && activeWorkspace && !modulePresentsItem(activeModule, hints, item.type)) {
      navigate(notificationRoute({ groupId: activeWorkspace.id, subjectId: targetId, moduleHints: hints }, groups, FALLBACK_MODULE))
      return
    }
    focusItem(targetId)
  }, [activeModule, activeWorkspace, allItems, focusItem, groups, navigate])

  // Das Profil-Overlay: ein Klick auf einen Personen-Knoten im Graph oder
  // einen Avatar öffnet es (`useOpenProfile`), das Menü das eigene.
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const { data: knownUsers } = useMembers(null)
  const profileUser = useMemo(() => {
    if (!profileUserId) return null
    if (currentUser?.id === profileUserId) return currentUser
    return knownUsers.find((user) => user.id === profileUserId) ?? { id: profileUserId }
  }, [currentUser, knownUsers, profileUserId])
  const openProfile = useCallback((userId: string) => setProfileUserId(userId), [])
  const closeProfile = useCallback(() => setProfileUserId(null), [])

  // Der Kommentar-Hinweis einer Karte führt ins Kommentarfeld des Panels;
  // steht das Item schon offen, führt er nirgendwohin.
  const kommentarNavigation = useMemo(
    () => ({
      openComments: (item: Item) => (offenesItem === item.id ? null : () => commentOnItem(item.id)),
    }),
    [commentOnItem, offenesItem],
  )
  // Ein Feld führt zu der Sicht, die es darstellen kann (Spec 01): Register
  // sagt welches Modul, der Space ob er es führt, der Fokus wie man hinkommt.
  const feldNavigation = useMemo(
    () => ({
      openField: (field: string, item: Item) => {
        const ziel = findModulePresenting(field, modules.map(({ id }) => id))
        if (!ziel || ziel.id === activeModule) return null
        return () => focusItem(item.id, ziel.id)
      },
    }),
    [activeModule, focusItem, modules],
  )

  const selectionFocusVisibleArea = useMemo(
    () => (drawerHeight > 0 ? { bottomInset: drawerHeight } : undefined),
    [drawerHeight],
  )

  return (
    <CommentNavigationProvider value={kommentarNavigation}>
    <FieldNavigationProvider value={feldNavigation}>
    <OpenProfileProvider openProfile={openProfile}>
    <DraftItemProvider>
    <UnsavedChangesProvider>
    <DetailHostProvider>
    <MapLibreAdapterProvider>
    <CreateHostProvider>
    <FilterProvider>
    <TagNavigationProvider>
    <ModulePanelProvider
      allowedModes={["floating", "drawer"]}
      sidebarWidth="420px"
      sidebarMinWidth="300px"
      sidebarMaxWidth="70vw"
      onDrawerHeightChange={setDrawerHeight}
    >
      <ActivityPanelController
        open={activityOpen}
        onClose={closeActivity}
        onOpenNotification={openNotification}
        onOpenEntryTarget={openEntryTarget}
        onOpenGroup={(groupId) => {
          const workspace = workspaces.find(({ id }) => id === groupId)
          if (workspace) handleWorkspaceChange(workspace)
          closeActivity()
        }}
      />
      <CreateSheetController />
      <DetailHostController activeModule={activeModule} activeGroupId={activeWorkspace?.id ?? null} />
      <UnsavedChangesGuard />
      <AppShell>
        <Navbar>
          <NavbarStart>
            <WorkspaceSwitcher
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onWorkspaceChange={handleWorkspaceChange}
            />
          </NavbarStart>
          <NavbarCenter>
            <ModuleTabs modules={modules} activeModule={activeModule} onModuleChange={handleModuleChange} />
          </NavbarCenter>
          <NavbarEnd>
            {notifications.supported
              ? <NotificationBell open={activityOpen} count={notifications.badgeCount} onOpenChange={setActivityOpen} />
              : activity.supported && <ActivityBell open={activityOpen} onOpenChange={setActivityOpen} />}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isDark ? "Helles Design" : "Dunkles Design"}
              onClick={() => setIsDark((current) => !current)}
            >
              {isDark ? <Sun /> : <Moon />}
            </Button>
            {currentUser && <UserMenu user={currentUser} onProfile={() => openProfile(currentUser.id)} />}
          </NavbarEnd>
        </Navbar>

        <AppShellMain
          withBottomNav={activeModule !== "map"}
          // Aus dem Register, nicht aus einer Liste hier (Spec 01, Regel 1).
          inset={getModule(activeModule)?.panelFit !== "overlay"}
        >
          <ModuleOutlet
            activeWorkspace={activeWorkspace}
            activeModule={activeModule}
            groups={groups}
            urlSpaceId={urlSpaceId}
            selectionFocusVisibleArea={selectionFocusVisibleArea}
            noAccessContent={
              <div className="h-full overflow-y-auto container mx-auto px-4 pt-12 max-w-md text-center">
                <p className="text-lg font-medium text-foreground">Kein Zugang zu diesem Space</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Zurück</Button>
              </div>
            }
          />
        </AppShellMain>

        <BottomNav items={modules} activeItem={activeModule} onItemChange={handleModuleChange} />
      </AppShell>
    </ModulePanelProvider>
    </TagNavigationProvider>
    </FilterProvider>
    </CreateHostProvider>
    </MapLibreAdapterProvider>
    </DetailHostProvider>
    </UnsavedChangesProvider>
    </DraftItemProvider>

    <AdaptivePanel open={profileUser !== null} onClose={closeProfile} allowedModes={["modal"]} modalClassName="sm:max-w-sm">
      {profileUser && (
        <ProfilePanelContent
          key={profileUser.id}
          mode="view"
          profile={{
            did: profileUser.id,
            name: profileUser.displayName ?? profileUser.id,
            avatar: profileUser.avatarUrl,
          }}
          onClose={closeProfile}
        />
      )}
    </AdaptivePanel>
    </OpenProfileProvider>
    </FieldNavigationProvider>
    </CommentNavigationProvider>
  )
}

export default function App({ connector }: AppProps) {
  return (
    <ConnectorProvider connector={connector}>
      <ItemFocusProvider>
        <Routes>
          <Route path=":scope/:seg/:itemId" element={<NetworkShell />} />
          <Route path=":scope/:seg" element={<NetworkShell />} />
          <Route path=":scope" element={<NetworkShell />} />
          <Route path="*" element={<NetworkShell />} />
        </Routes>
      </ItemFocusProvider>
    </ConnectorProvider>
  )
}
