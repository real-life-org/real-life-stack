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
import type { Group } from "@real-life-stack/data-interface"
import { readGray, readRadius, readSurfaces, type GrayChoice, type RadiusStep, type Surfaces } from "../../lib/space-theme"

export interface Workspace {
  id: string
  name: string
  avatar?: string
  scope?: string
  /** Cached accent color (`#rrggbb`); falls back to a deterministic id color. */
  primaryColor?: string
  /** Tönung der Flächen, 0–1 (`data.tint`); fehlt sie, bleiben sie neutral. */
  tint?: number
  /** Neutrale Skala oder "auto" (`data.gray`); fehlt sie, erbt der Space von der Instanz. */
  gray?: GrayChoice
  /** Rundung (`data.radius`), fünf Stufen; fehlt sie, erbt der Space von der Instanz. */
  radius?: RadiusStep
  /** Flächen der App-Hülle (`data.surfaces`): translucent | solid. */
  surfaces?: Surfaces
}

/**
 * Was der Space-Wechsler von einer Gruppe zeigt (Spec 04): Name, Bild aus
 * `data.image`, Farbe und Theme-Achsen aus `data`. Die eine Ableitung fuer
 * Rahmen, Stories und Handbuch — wer sie nachbaut, vergisst ein Feld.
 * Ungeprueft durchgereicht, was `scalesForColor` spaeter kappt und verwirft.
 */
export function workspaceOf(g: Group): Workspace {
  return {
    id: g.id,
    name: g.name,
    avatar: typeof g.data?.image === "string" ? g.data.image : undefined,
    scope: typeof g.data?.scope === "string" ? g.data.scope : undefined,
    primaryColor: typeof g.data?.primaryColor === "string" ? g.data.primaryColor : undefined,
    tint: typeof g.data?.tint === "number" ? g.data.tint : undefined,
    gray: readGray(g.data?.gray) ?? undefined,
    radius: readRadius(g.data?.radius) ?? undefined,
    surfaces: readSurfaces(g.data?.surfaces) ?? undefined,
  }
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

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
  onCreateWorkspace,
  onEditWorkspace,
  syncing = false,
  syncExpected = null,
}: WorkspaceSwitcherProps) {
  // Controlled so the gear (edit) button can close the menu before opening the
  // group dialog — otherwise the menu stays open and overlaps the dialog.
  const [open, setOpen] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const personalWorkspace = workspaces.find((w) => w.scope === "overview")
  const groupWorkspaces = workspaces.filter((w) => w.scope !== "overview")
  const isPersonalActive = activeWorkspace?.scope === "overview"

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent sm:gap-3 sm:px-3">
        {isPersonalActive ? (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Home className="h-4 w-4 text-primary" />
          </div>
        ) : activeWorkspace ? (
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={activeWorkspace.avatar} alt={activeWorkspace.name} className="rounded-lg" />
            <AvatarFallback className="text-sm font-semibold rounded-md">
              {getInitials(activeWorkspace.name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        {/* Der Name kuerzt sich nur, wenn der Platz wirklich fehlt: NavbarStart
            ist min-w-0, NavbarEnd shrink-0 — ein fester Deckel (34vw) schnitt
            „Gemeinschaftsgarten" auf dem Telefon ab, obwohl Platz war. */}
        <span className="min-w-0 truncate text-base font-semibold sm:text-lg">
          {activeWorkspace ? activeWorkspace.name : "Space wählen"}
        </span>
        {syncing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Gruppen werden geladen" />
        ) : (
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {personalWorkspace && (
          <>
            <DropdownMenuItem
              onClick={() => onWorkspaceChange(personalWorkspace)}
              className="flex items-center gap-2"
            >
              <div className="h-5 w-5 rounded-sm bg-primary/10 flex items-center justify-center">
                <Home className="h-3 w-3 text-primary" />
              </div>
              <span className="flex-1 font-medium">{personalWorkspace.name}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>Gruppen</DropdownMenuLabel>
        {syncing && <WorkspaceSyncNotice loaded={groupWorkspaces.length} expected={syncExpected ?? null} />}
        {groupWorkspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => onWorkspaceChange(workspace)}
            className="group/ws flex items-center gap-2"
          >
            <Avatar className="h-5 w-5 rounded-sm">
              <AvatarImage src={workspace.avatar} alt={workspace.name} className="rounded-sm object-contain" />
              <AvatarFallback className="text-xs rounded-sm">
                {getInitials(workspace.name)}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1">{workspace.name}</span>
            {onEditWorkspace && (
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
            )}
          </DropdownMenuItem>
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
