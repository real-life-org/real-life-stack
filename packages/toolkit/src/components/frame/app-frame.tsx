"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Moon, Plus, Sun } from "lucide-react"
import type { Group, Item } from "@real-life-stack/data-interface"
import { hasEncounterVerification, isAuthenticatable, moduleHintsFor } from "@real-life-stack/data-interface"

import { useConnector } from "../../hooks/connector-context"
import { useActivity } from "../../hooks/use-activity"
import { useOptionalCurrentUser } from "../../hooks/use-auth"
import { useContacts } from "../../hooks/use-contacts"
import { DraftItemProvider } from "../../hooks/use-draft-item"
import { useCreateGroup, useCurrentGroup, useDeleteGroup, useInviteMember, useRemoveMember, useUpdateGroup } from "../../hooks/use-groups"
import { useInitialSync } from "../../hooks/use-initial-sync"
import { useItemFocus } from "../../hooks/use-item-focus"
import { useItems } from "../../hooks/use-items"
import { useNotifications } from "../../hooks/use-notifications"
import { OpenProfileProvider } from "../../hooks/use-open-profile"
import { UnsavedChangesProvider } from "../../hooks/use-unsaved-changes"
import { useVerification } from "../../hooks/use-verification"
import { initialDarkMode, rememberColorScheme } from "../../lib/color-scheme"
import { findModulePresenting, getModule, modulePresentsItem } from "../../lib/module-register"
import { notificationTarget } from "../../lib/notification-target"
import { ActivityBell } from "../activity/activity-bell"
import { ActivityPanelController } from "../activity/activity-panel-controller"
import { NotificationBell, type NotificationCandidate } from "../activity/notification-center"
import { AddContactDialog } from "../contacts/add-contact-dialog"
import { ContactsDialog } from "../contacts/contacts-dialog"
import { VerificationDialog } from "../contacts/verification-dialog"
import { FilterProvider } from "../filter/filter-store"
import { CreateHostProvider, CreateSheetController } from "../host/create-host"
import { DetailHostController, DetailHostProvider } from "../host/detail-host"
import { ModuleOutlet } from "../host/module-outlet"
import { AppShell, AppShellMain } from "../layout/app-shell"
import { BottomNav } from "../layout/bottom-nav"
import { GroupDialog, type GroupDialogMode } from "../layout/group-dialog"
import { ModuleTabs, type Module } from "../layout/module-tabs"
import { Navbar, NavbarCenter, NavbarEnd, NavbarStart } from "../layout/navbar"
import { SpaceThemeCard } from "../layout/space-theme-panel"
import { UserMenu } from "../layout/user-menu"
import type { BuildInfo } from "../../lib/build-info"
import { WorkspaceSwitcher, type Workspace } from "../layout/workspace-switcher"
import { LocationPickProvider, useLocationPick } from "../map/location-pick"
import { ModulePanelProvider, useModulePanel } from "../module-panel/module-panel"
import { CommentNavigationProvider } from "../navigation/comment-navigation"
import { FieldNavigationProvider } from "../navigation/field-navigation"
import { TagNavigationProvider } from "../navigation/tag-navigation"
import { Button } from "../primitives/button"

/** Die Overlay-Ebenen, die der Rahmen selbst kennt (Kontakte, Verifizieren). */
export type FrameOverlayId = "contacts" | "verify"

/**
 * Was der Rahmen vom Routing braucht — nicht mehr. Mit Router liefert es
 * `useWorkspaceRouting` (`@real-life-stack/toolkit/router`, `RoutedAppFrame`);
 * ohne Router haelt eine Story oder ein Test es im Speicher (`HostWorld`).
 */
export interface FrameRouting {
  groups: readonly Group[]
  workspaces: Workspace[]
  /** `null`, wenn die URL einen Space ohne Zugang nennt. */
  activeWorkspace: Workspace | null
  activeModule: string
  /** Die Module, die der aktive Space fuehrt — Tabs und Navigationsziele. */
  modules: Module[]
  /** Nennt die URL einen Space? Zusammen mit `activeWorkspace === null` ergibt das „kein Zugang". */
  urlSpaceId?: string
  handleWorkspaceChange: (workspace: Workspace) => void
  handleModuleChange: (moduleId: string, opts?: { replace?: boolean }) => void
  /** Space, Modul und Item in EINEM Schritt — Benachrichtigung, Verlauf. */
  goTo: (target: { groupId: string; module: string; itemId: string }) => void
  /** Wohin ohne Zugang und nach dem Loeschen des letzten Space. */
  goHome: () => void
  /**
   * Die Overlay-Ebenen als Back-Stack (Spec 01, Overlay-Flaechen, Regel 5).
   * Mit Router liegt er in der URL (`?dialog=`); ohne Angabe haelt der Rahmen
   * ihn im Speicher.
   */
  overlay?: { top: FrameOverlayId | null; open: (id: FrameOverlayId) => void; pop: () => void }
}

export interface AppFrameProps {
  routing: FrameRouting
  /** Das Modul, wenn kein Feld eines waehlt (Spec 01, Der Modul-Host: die App waehlt den Rueckfall). */
  fallbackModule?: string
  /** Profil einer Person oeffnen — bis das Profil ein Item ist (Spec 09). */
  openProfile?: (userId: string) => void
  /** App-Eigenes rechts in der Kopfzeile, vor Glocke und Menue (z. B. Relay-Status). */
  navbarEnd?: ReactNode
  /** Was ohne Zugang steht. Standard: Hinweis mit Knopf nach Hause. */
  noAccessContent?: ReactNode
  /** App-Eigenes im Shell-Baum: eigene Dialoge, Dev-Knoepfe. Steht unter allen Providern. */
  children?: ReactNode
  /** Welcher Stand laeuft (Version, Commit, Kanal) — stille Zeile im Nutzer-Menue. */
  build?: BuildInfo
}

/**
 * Accepts either a raw user id or a shared profile URL (…?profile=<id>) in
 * the add-contact input — people paste what they got.
 */
export function extractProfileId(input: string): string {
  const trimmed = input.trim()
  try {
    const url = new URL(trimmed)
    const fromParam = url.searchParams.get("profile")
    if (fromParam) return fromParam
  } catch {
    // not a URL — treat as raw id
  }
  return trimmed
}

/**
 * Links ODER rechts, nie beide. Die Feineinstellung (links) und das
 * Modul-Panel (rechts: Details, Composer, Debug) schliessen einander aus:
 * oeffnet das eine, geht das andere zu.
 */
function PanelExclusivity({ themeOpen, onCloseTheme }: { themeOpen: boolean; onCloseTheme: () => void }) {
  const panel = useModulePanel()
  const rightOpen = panel.current !== null
  const rightKey = panel.current ? `${panel.current.kind}:${panel.current.itemId ?? ""}` : null
  const prevRightKey = useRef(rightKey)
  const prevThemeOpen = useRef(themeOpen)
  useEffect(() => {
    if (themeOpen && !prevThemeOpen.current && rightOpen) panel.close()
    if (rightKey !== null && rightKey !== prevRightKey.current && themeOpen) onCloseTheme()
    prevThemeOpen.current = themeOpen
    prevRightKey.current = rightKey
  }, [themeOpen, rightOpen, rightKey, panel, onCloseTheme])
  return null
}

/**
 * Das eine Modul-Panel der App, versteckt (nicht abgebaut), waehrend jemand
 * auf der Karte einen Ort waehlt — so tritt der Drawer auf dem Handy beiseite.
 */
function FramePanel({ children, onDrawerHeightChange }: { children: ReactNode; onDrawerHeightChange: (height: number) => void }) {
  const { isPicking } = useLocationPick()
  return (
    <ModulePanelProvider
      allowedModes={["floating", "drawer"]}
      sidebarWidth="420px"
      sidebarMinWidth="300px"
      sidebarMaxWidth="70vw"
      suspended={isPicking}
      onDrawerHeightChange={onDrawerHeightChange}
    >
      {children}
    </ModulePanelProvider>
  )
}

/** Ohne Angabe der App: der Overlay-Stack im Speicher. */
function useMemoryOverlay(): NonNullable<FrameRouting["overlay"]> {
  const [stack, setStack] = useState<FrameOverlayId[]>([])
  return useMemo(() => ({
    top: stack[stack.length - 1] ?? null,
    open: (id: FrameOverlayId) => setStack((s) => [...s.filter((x) => x !== id), id]),
    pop: () => setStack((s) => s.slice(0, -1)),
  }), [stack])
}

/**
 * Der Rahmen einer App (Spec 01, „Was bei der App bleibt"): alles, was jede
 * App mit demselben Register gleich tut, EINMAL — Provider, das geteilte
 * Panel, Kopfzeile mit Space-Verwaltung, die vier Controller, die drei
 * Navigationsregeln, der Outlet. Eine App stellt Connector, Fokus-Provider,
 * Register, Routing und ihre Extras; eine Story dasselbe im Speicher.
 *
 * Bis zum 21.09.2026 zaehlten Referenz-App, Netzwerk-App und die Story-Huelle
 * diesen Stapel je von Hand auf — zehn Provider, vier Controller, in drei
 * Fassungen. Was in einer fehlte, fiel nicht auf, bis es fehlte (rls#429: der
 * Guard vor Entwurfsverlust).
 *
 * Nicht hier: die Karten-Engine (`MapLibreAdapterProvider` aus `/maplibre`,
 * die eine Zeile der App fuer die Karte) und alles, was einen Router braucht
 * (`RoutedAppFrame` in `/router` legt es um diesen Rahmen).
 */
export function AppFrame({ routing, fallbackModule, openProfile, navbarEnd, noAccessContent, children, build }: AppFrameProps) {
  const { groups, workspaces, activeWorkspace, activeModule, modules, urlSpaceId, handleWorkspaceChange, handleModuleChange, goTo, goHome } = routing
  const connector = useConnector()
  const { data: currentUser } = useOptionalCurrentUser()
  const memoryOverlay = useMemoryOverlay()
  const overlay = routing.overlay ?? memoryOverlay

  // --- Space-Verwaltung ---------------------------------------------------
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const inviteMember = useInviteMember()
  const removeMember = useRemoveMember()
  const initialSync = useInitialSync()
  const { activeContacts, pendingContacts, contacts: allContacts, isLoading: contactsLoading, addContact, activateContact, removeContact, updateContactName, supportsContacts } = useContacts()
  const verification = useVerification()
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [groupDialogMode, setGroupDialogMode] = useState<GroupDialogMode>({ type: "create" })
  const openCreateDialog = useCallback(() => { setGroupDialogMode({ type: "create" }); setGroupDialogOpen(true) }, [])
  const openEditDialog = useCallback((workspace: Workspace) => {
    if (workspace.scope === "overview") return
    const group = groups.find((g) => g.id === workspace.id)
    if (!group) return
    setGroupDialogMode({ type: "edit", group })
    setGroupDialogOpen(true)
  }, [groups])
  // Die Feineinstellung des Aussehens regelt immer den AKTIVEN Space; der
  // Wechsel dorthin laeuft ueber das Routing und kommt erst im Effekt an —
  // gerendert wird, sobald beide uebereinstimmen.
  const [themeCardOpen, setThemeCardOpen] = useState(false)
  const [themeGroupId, setThemeGroupId] = useState<string | null>(null)
  const currentGroup = useCurrentGroup()
  const themeGroup = currentGroup && currentGroup.id === themeGroupId ? currentGroup : null
  const [addContactOpen, setAddContactOpen] = useState(false)
  const ensureVerificationChallenge = useCallback(async () => {
    const restored = await verification.restoreChallenge()
    if (restored) return restored
    return verification.createChallenge()
  }, [verification.restoreChallenge, verification.createChallenge]) // eslint-disable-line react-hooks/exhaustive-deps

  // Radix-Dialoge koennen `body { pointer-events: none }` haengen lassen;
  // sobald kein Dialog mehr offen ist, den Body sicher wieder freigeben.
  useEffect(() => {
    if (overlay.top !== null) return
    const t = setTimeout(() => {
      if (document.body.style.pointerEvents === "none") document.body.style.pointerEvents = ""
    }, 0)
    return () => clearTimeout(t)
  }, [overlay.top])

  // --- Erscheinungsbild ---------------------------------------------------
  const [isDark, setIsDark] = useState(initialDarkMode)
  useEffect(() => { document.documentElement.classList.toggle("dark", isDark) }, [isDark])
  const toggleTheme = () => { const naechster = !isDark; setIsDark(naechster); rememberColorScheme(naechster) }

  // --- Verlauf und Benachrichtigungen --------------------------------------
  const [drawerHeight, setDrawerHeight] = useState(0)
  const [activityOpen, setActivityOpen] = useState(false)
  const closeActivity = useCallback(() => setActivityOpen(false), [])
  const activity = useActivity()
  const notifications = useNotifications()
  const { data: allItems } = useItems()
  const { itemId: offenesItem, focusItem, commentOnItem } = useItemFocus()
  const routeFor = useCallback(
    (groupId: string, subjectId: string, hints: NotificationCandidate["moduleHints"]) =>
      notificationTarget({ groupId, subjectId, moduleHints: hints }, groups, fallbackModule),
    [fallbackModule, groups],
  )
  const openNotification = useCallback((notification: NotificationCandidate) => {
    goTo(routeFor(notification.groupId, notification.subjectId, notification.moduleHints))
    closeActivity()
  }, [closeActivity, goTo, routeFor])
  // Ein Ziel aus dem rohen Verlauf: Kann das aktive Modul es nicht zeigen,
  // wechselt der Sprung das Modul mit; sonst nur der Fokus.
  const openEntryTarget = useCallback((targetId: string) => {
    const item = allItems.find(({ id }) => id === targetId)
    const hints = item ? moduleHintsFor(item) : undefined
    if (item && activeWorkspace && !modulePresentsItem(activeModule, hints, item.type)) {
      goTo(routeFor(activeWorkspace.id, targetId, hints))
      return
    }
    focusItem(targetId)
  }, [activeModule, activeWorkspace, allItems, focusItem, goTo, routeFor])

  // --- Die drei Navigationsregeln -----------------------------------------
  // Der Kommentar-Hinweis einer Karte fuehrt ins Kommentarfeld; steht das
  // Item schon offen, fuehrt er nirgendwohin.
  const kommentarNavigation = useMemo(() => ({
    openComments: (item: Item) => (offenesItem === item.id ? null : () => commentOnItem(item.id)),
  }), [commentOnItem, offenesItem])
  // Ein Feld fuehrt zu der Sicht, die es darstellen kann (Spec 01): das
  // Register sagt welches Modul, der Space ob er es fuehrt, der Fokus wie.
  const feldNavigation = useMemo(() => ({
    openField: (field: string, item: Item) => {
      const ziel = findModulePresenting(field, modules.map(({ id }) => id))
      if (!ziel || ziel.id === activeModule) return null
      return () => focusItem(item.id, ziel.id)
    },
  }), [activeModule, focusItem, modules])
  const openProfileStable = useCallback((userId: string) => openProfile?.(userId), [openProfile])

  const entry = getModule(activeModule)

  return (
    <CommentNavigationProvider value={kommentarNavigation}>
    <FieldNavigationProvider value={feldNavigation}>
    <OpenProfileProvider openProfile={openProfileStable}>
    <DraftItemProvider>
    <UnsavedChangesProvider>
    <DetailHostProvider>
    <LocationPickProvider
      navigateToModule={handleModuleChange}
      currentModule={activeModule}
      canOpenMap={modules.some((m) => m.id === "map")}
    >
    <CreateHostProvider>
    <FilterProvider>
    <TagNavigationProvider>
    <FramePanel onDrawerHeightChange={setDrawerHeight}>
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
      <AppShell>
        <Navbar>
          <NavbarStart>
            {workspaces.length > 0 ? (
              // Auch ohne aktiven Space (kein Zugang) bleibt der Umschalter da.
              <WorkspaceSwitcher
                workspaces={workspaces}
                activeWorkspace={activeWorkspace}
                onWorkspaceChange={handleWorkspaceChange}
                onCreateWorkspace={openCreateDialog}
                onEditWorkspace={openEditDialog}
                syncing={initialSync.active}
                syncExpected={initialSync.expectedGroups}
              />
            ) : (
              <Button variant="outline" size="sm" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Neue Gruppe
              </Button>
            )}
          </NavbarStart>
          <NavbarCenter>
            <ModuleTabs modules={modules} activeModule={activeModule} onModuleChange={handleModuleChange} />
          </NavbarCenter>
          <NavbarEnd>
            {navbarEnd}
            {notifications.supported
              ? <NotificationBell open={activityOpen} count={notifications.badgeCount} onOpenChange={setActivityOpen} />
              : activity.supported && <ActivityBell open={activityOpen} onOpenChange={setActivityOpen} />}
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" aria-label={isDark ? "Helles Design" : "Dunkles Design"}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {currentUser && (
              // Die Eintraege folgen den Faehigkeiten des Connectors, nicht der App.
              <UserMenu
                user={currentUser}
                onProfile={openProfile ? () => openProfile(currentUser.id) : undefined}
                onContacts={supportsContacts ? () => overlay.open("contacts") : undefined}
                contactCount={activeContacts.length}
                onVerify={hasEncounterVerification(connector) ? () => overlay.open("verify") : undefined}
                onLogout={isAuthenticatable(connector) ? async () => { await connector.logout(); window.location.reload() } : undefined}
                build={build}
              />
            )}
          </NavbarEnd>
        </Navbar>

        <AppShellMain
          // Aus dem Register, nicht aus einer Liste hier (Spec 01, Regel 1):
          // Eine dauerhaft montierte Flaeche (die Karte) fuellt bis hinter die
          // BottomNav; scrollende Module halten Abstand zu ihr.
          withBottomNav={!entry?.keepMounted}
          inset={entry?.panelFit !== "overlay"}
        >
          <ModuleOutlet
            activeWorkspace={activeWorkspace}
            activeModule={activeModule}
            groups={groups}
            urlSpaceId={urlSpaceId}
            selectionFocusVisibleArea={drawerHeight > 0 ? { bottomInset: drawerHeight } : undefined}
            noAccessContent={noAccessContent ?? (
              <div className="h-full overflow-y-auto container mx-auto px-4 pt-12 max-w-md text-center">
                <p className="text-lg font-medium text-foreground">Du bist kein Mitglied dieses Spaces</p>
                <p className="text-sm text-muted-foreground mt-2">Der Space existiert nicht oder du hast keinen Zugang.</p>
                <Button variant="outline" className="mt-4" onClick={goHome}>Zurück zur Übersicht</Button>
              </div>
            )}
          />
        </AppShellMain>

        <BottomNav items={modules} activeItem={activeModule} onItemChange={handleModuleChange} />

        <GroupDialog
          key={groupDialogMode.type === "edit" ? `edit-${groupDialogMode.group.id}` : "create"}
          open={groupDialogOpen}
          onOpenChange={setGroupDialogOpen}
          mode={groupDialogMode}
          currentUserId={currentUser?.id}
          contacts={allContacts}
          onCreateGroup={async (name) => {
            const group = await createGroup(name)
            handleWorkspaceChange({ id: group.id, name: group.name })
          }}
          onUpdateGroup={async (id, updates) => { await updateGroup(id, updates) }}
          onOpenThemePanel={(group) => {
            // Die Tokens gehoeren dem AKTIVEN Space — also erst hinspringen.
            if (activeWorkspace?.id !== group.id) handleWorkspaceChange({ id: group.id, name: group.name })
            setThemeGroupId(group.id)
            setThemeCardOpen(true)
          }}
          onDeleteGroup={async (id) => {
            await deleteGroup(id)
            if (activeWorkspace?.id === id) {
              const remaining = workspaces.filter((w) => w.id !== id)
              if (remaining.length > 0) handleWorkspaceChange(remaining[0])
              else goHome()
            }
          }}
          onInviteMember={async (groupId, userId) => { await inviteMember(groupId, userId) }}
          onRemoveMember={async (groupId, userId) => { await removeMember(groupId, userId) }}
        />
        <PanelExclusivity themeOpen={themeCardOpen} onCloseTheme={() => setThemeCardOpen(false)} />
        {themeCardOpen && themeGroup && (
          <SpaceThemeCard
            key={themeGroup.id}
            group={themeGroup}
            onUpdateGroup={async (id, updates) => { await updateGroup(id, updates) }}
            onClose={() => setThemeCardOpen(false)}
          />
        )}

        <ContactsDialog
          open={overlay.top === "contacts"}
          onOpenChange={(open) => { if (!open) overlay.pop() }}
          activeContacts={activeContacts}
          pendingContacts={pendingContacts}
          isLoading={contactsLoading}
          onRemove={removeContact}
          onEditName={updateContactName}
          onVerify={hasEncounterVerification(connector) ? () => overlay.open("verify") : undefined}
          onAdd={supportsContacts && !hasEncounterVerification(connector) ? () => setAddContactOpen(true) : undefined}
          onActivate={activateContact}
          activeLabel={hasEncounterVerification(connector) ? "Verifiziert" : "Aktiv"}
        />
        <AddContactDialog
          open={addContactOpen}
          onOpenChange={setAddContactOpen}
          onAdd={(id, name) => addContact(extractProfileId(id), name)}
        />
        {verification.supported && (
          <VerificationDialog
            open={overlay.top === "verify"}
            onOpenChange={(open) => { if (!open) overlay.pop() }}
            challenge={verification.challenge}
            peerInfo={verification.peerInfo}
            isProcessing={verification.isProcessing}
            error={verification.error}
            onCreateChallenge={verification.createChallenge}
            onEnsureChallenge={ensureVerificationChallenge}
            onScanChallenge={verification.scanChallenge}
            onConfirmVerification={verification.confirmVerification}
            onReset={verification.reset}
          />
        )}

        {children}
      </AppShell>
    </FramePanel>
    </TagNavigationProvider>
    </FilterProvider>
    </CreateHostProvider>
    </LocationPickProvider>
    </DetailHostProvider>
    </UnsavedChangesProvider>
    </DraftItemProvider>
    </OpenProfileProvider>
    </FieldNavigationProvider>
    </CommentNavigationProvider>
  )
}
