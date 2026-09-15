"use client"

import { useState } from "react"
import { ChevronsUpDown, Home, Loader2, Plus, Settings } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/primitives/avatar"
import type { SpaceKind } from "@/lib/space-kinds"

export interface Workspace {
  id: string
  name: string
  avatar?: string
  scope?: string
  /** Cached accent color (`#rrggbb`); falls back to a deterministic id color. */
  primaryColor?: string
  /** Art des Space (`Group.data.kind`, Spec 04); fehlt bei Spaces ohne Art. */
  kind?: string
  /** Dieser Space ist ein Netzwerk (`Group.data.isNetwork`, Spec 04). */
  isNetwork?: boolean
  /** Netzwerk, zu dem dieser Space gehoert (`Group.data.network`, Spec 04). */
  network?: string
  /** Die Arten eines Netzwerk-Space (`Group.data.spaceKinds`); nur bei `isNetwork`. */
  kinds?: readonly SpaceKind[]
  /** Domain der Landingpage eines Netzwerks (`Group.data.domain`); nur bei `isNetwork`. */
  domain?: string
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
  /**
   * Null when no workspace is active — e.g. the URL points at a space
   * the user has no access to. The trigger renders a neutral state so
   * the user can still switch to one of their workspaces.
   */
  activeWorkspace: Workspace | null
  onWorkspaceChange: (workspace: Workspace) => void
  onCreateWorkspace?: () => void
  onEditWorkspace?: (workspace: Workspace) => void
  /**
   * Dieses Gerät empfängt gerade seinen ersten Datenbestand. Die Liste ist
   * dann unvollständig, nicht kurz — das muss man ihr ansehen (rls#265).
   */
  syncing?: boolean
  /** Erwartete Gruppen laut Mitgliedschaftsliste; `null`/undefined = unbekannt. */
  syncExpected?: number | null
  /**
   * Das aktive Netzwerk (Spec 01, „Space-Wechsel nach Netzwerk und Art"):
   * Die Gruppenliste zeigt dann nur seine Spaces, gegliedert nach seinen
   * Arten. Ohne aktives Netzwerk erscheinen alle Spaces ungegliedert.
   */
  activeNetworkId?: string | null
}

/** Ein Abschnitt der Gruppenliste: eine Art, oder zuletzt die Spaces ohne Art. */
export interface WorkspaceSection {
  /** Art-Id; leer fuer den neutralen Abschnitt. */
  id: string
  label: string
  color?: string
  workspaces: Workspace[]
}

/**
 * Die Spaces, die im Kontext eines Netzwerks in der Liste stehen.
 *
 * Mit aktivem Netzwerk: alles, was zu ihm gehoert — auch ein Space, der
 * selbst ein Netzwerk ist (die Lichtung ist ein Projekt in Real Life UND
 * ein Netzwerk mit eigener Domain; oben steht sie als Netzwerk, hier als
 * Projekt). Ohne aktives Netzwerk: alle Spaces, die keine Netzwerke sind —
 * die Netzwerke stehen ja schon im Abschnitt darueber.
 */
export function workspacesInNetwork(
  workspaces: readonly Workspace[],
  activeNetworkId: string | null | undefined,
): Workspace[] {
  const spaces = workspaces.filter((w) => w.scope !== "overview")
  if (!activeNetworkId) return spaces.filter((w) => !w.isNetwork)
  return spaces.filter((w) => w.network === activeNetworkId && w.id !== activeNetworkId)
}

/**
 * Gliedert Spaces nach Art (Spec 01, „Space-Wechsel nach Netzwerk und Art").
 *
 * Je Art des Netzwerks ein Abschnitt in dessen Reihenfolge, ein Abschnitt
 * ohne Spaces entfaellt. Spaces ohne Art oder mit einer Art, die das Netzwerk
 * nicht kennt, stehen zuletzt unter „Gruppen" — ein fremder Wert ist kein
 * Fehler, er stammt aus einer frueheren Liste. Ohne Arten bleibt genau der
 * eine Abschnitt „Gruppen", damit die Flaeche aussieht wie vorher.
 */
export function groupWorkspacesByKind(
  workspaces: readonly Workspace[],
  kinds: readonly SpaceKind[] = [],
): WorkspaceSection[] {
  const spaces = workspaces.filter((w) => w.scope !== "overview")
  const sections: WorkspaceSection[] = []
  const zugeordnet = new Set<string>()
  for (const kind of kinds) {
    const inKind = spaces.filter((w) => w.kind === kind.id)
    if (inKind.length === 0) continue
    for (const w of inKind) zugeordnet.add(w.id)
    sections.push({ id: kind.id, label: kind.labelPlural, color: kind.color, workspaces: inKind })
  }
  const rest = spaces.filter((w) => !zugeordnet.has(w.id))
  if (rest.length > 0 || sections.length === 0) {
    sections.push({ id: "", label: "Gruppen", workspaces: rest })
  }
  return sections
}

/**
 * Hinweiszeile in der Gruppenliste, solange dieses Gerät seinen ersten
 * Datenbestand empfängt.
 *
 * „x von y" steht nur da, wenn y GRÖSSER als x ist — also wenn die
 * Mitgliedschaftsliste aus dem persönlichen Dokument nachweislich mehr Gruppen
 * kennt, als schon da sind. Die Liste trifft selbst stückweise ein: „1 von 1"
 * wäre im Moment wahr und trotzdem irreführend, weil gleich die zweite Gruppe
 * kommt (rls#265).
 */
export function WorkspaceSyncNotice({ loaded, expected }: { loaded: number; expected: number | null }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>
        {expected !== null && expected > loaded
          ? `${loaded} von ${expected} ${expected === 1 ? "Gruppe" : "Gruppen"} geladen …`
          : loaded > 0
            ? `${loaded} ${loaded === 1 ? "Gruppe" : "Gruppen"} geladen, es kommen noch welche …`
            : "Deine Gruppen werden geladen …"}
      </span>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function WorkspaceAvatar({ workspace, size }: { workspace: Workspace; size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-8 w-8 rounded-lg" : "h-5 w-5 rounded-sm"
  const icon = size === "lg" ? "h-4 w-4" : "h-3 w-3"
  // Ein Netzwerk ohne Bild traegt das Haus — es ist der Ort, an dem man ankommt.
  if (workspace.isNetwork && !workspace.avatar) {
    return (
      <div className={`${box} bg-primary/10 flex items-center justify-center`}>
        <Home className={`${icon} text-primary`} />
      </div>
    )
  }
  return (
    <Avatar className={box}>
      <AvatarImage src={workspace.avatar} alt={workspace.name} className={`${box} object-contain`} />
      <AvatarFallback className={size === "lg" ? "text-sm font-semibold rounded-md" : "text-xs rounded-sm"}>
        {getInitials(workspace.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
  onCreateWorkspace,
  onEditWorkspace,
  syncing = false,
  syncExpected = null,
  activeNetworkId = null,
}: WorkspaceSwitcherProps) {
  // Controlled so the gear (edit) button can close the menu before opening the
  // group dialog — otherwise the menu stays open and overlaps the dialog.
  const [open, setOpen] = useState(false)

  const personalWorkspace = workspaces.find((w) => w.scope === "overview")
  const networks = workspaces.filter((w) => w.isNetwork)
  const activeNetwork = networks.find((w) => w.id === activeNetworkId) ?? null
  const groupWorkspaces = workspacesInNetwork(workspaces, activeNetwork?.id)
  const sections = groupWorkspacesByKind(groupWorkspaces, activeNetwork?.kinds ?? [])
  const isPersonalActive = activeWorkspace?.scope === "overview"
  // Der Sync-Hinweis gehoert zu den Spaces ohne Art — dort landen die, die
  // noch kommen. Gibt es den Abschnitt nicht, steht er ueber allen.
  const syncSectionId = sections.some((s) => s.id === "") ? "" : sections[0]?.id

  const gear = (workspace: Workspace) =>
    onEditWorkspace ? (
      <button
        type="button"
        aria-label={`${workspace.name} bearbeiten`}
        className="rounded p-0.5 opacity-50 hover:opacity-100! hover:bg-accent shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(false)
          onEditWorkspace(workspace)
        }}
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
    ) : null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent sm:gap-3 sm:px-3">
        {isPersonalActive ? (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Home className="h-4 w-4 text-primary" />
          </div>
        ) : activeWorkspace ? (
          <WorkspaceAvatar workspace={activeWorkspace} size="lg" />
        ) : (
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {/* Name now also shows on mobile, truncated so a long space name can't
            push the trailing nav actions off-screen (NavbarStart is shrink-0). */}
        <span className="truncate max-w-[34vw] text-base font-semibold sm:max-w-none sm:text-lg">
          {activeWorkspace ? activeWorkspace.name : "Space wählen"}
        </span>
        {syncing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Gruppen werden geladen" />
        ) : (
          <ChevronsUpDown className="h-4 w-4 opacity-50 hidden sm:block" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {networks.length > 0 && (
          <div role="group" aria-label="Netzwerke">
            <DropdownMenuLabel>Netzwerke</DropdownMenuLabel>
            {networks.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => onWorkspaceChange(workspace)}
                className="group/ws flex items-center gap-2"
                aria-current={workspace.id === activeNetwork?.id ? "true" : undefined}
              >
                <WorkspaceAvatar workspace={workspace} size="sm" />
                <span className={workspace.id === activeNetwork?.id ? "flex-1 font-medium" : "flex-1"}>{workspace.name}</span>
                {gear(workspace)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        )}
        {personalWorkspace && (
          <>
            <DropdownMenuItem
              onClick={() => onWorkspaceChange(personalWorkspace)}
              className="flex items-center gap-2"
            >
              <div className="h-5 w-5 rounded-sm bg-primary/10 flex items-center justify-center">
                {networks.length > 0 ? <ChevronsUpDown className="h-3 w-3 text-primary" /> : <Home className="h-3 w-3 text-primary" />}
              </div>
              <span className="flex-1 font-medium">{personalWorkspace.name}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {sections.map((section) => (
          <div key={section.id || "__rest__"} role="group" aria-label={section.label}>
            <DropdownMenuLabel className="flex items-center gap-2">
              {section.color && (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: section.color }}
                />
              )}
              {section.label}
            </DropdownMenuLabel>
            {syncing && section.id === syncSectionId && (
              <WorkspaceSyncNotice loaded={workspaces.filter((w) => w.scope !== "overview").length} expected={syncExpected ?? null} />
            )}
            {section.workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => onWorkspaceChange(workspace)}
                className="group/ws flex items-center gap-2"
              >
                <WorkspaceAvatar workspace={workspace} size="sm" />
                <span className="flex-1">{workspace.name}</span>
                {gear(workspace)}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        {onCreateWorkspace && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateWorkspace} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Neue Gruppe erstellen</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
