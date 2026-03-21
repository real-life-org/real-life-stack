"use client"

import { ChevronsUpDown, Home, Plus, Settings } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/primitives/avatar"

export interface Workspace {
  id: string
  name: string
  avatar?: string
  scope?: string
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[]
  activeWorkspace: Workspace
  onWorkspaceChange: (workspace: Workspace) => void
  onCreateWorkspace?: () => void
  onEditWorkspace?: (workspace: Workspace) => void
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onWorkspaceChange,
  onCreateWorkspace,
  onEditWorkspace,
}: WorkspaceSwitcherProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const personalWorkspace = workspaces.find((w) => w.scope === "personal")
  const groupWorkspaces = workspaces.filter((w) => w.scope !== "personal")
  const isPersonalActive = activeWorkspace.scope === "personal"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent">
        {isPersonalActive ? (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Home className="h-4 w-4 text-primary" />
          </div>
        ) : (
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={activeWorkspace.avatar} alt={activeWorkspace.name} className="rounded-lg" />
            <AvatarFallback className="text-sm font-semibold rounded-md">
              {getInitials(activeWorkspace.name)}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="hidden sm:inline-block text-lg font-semibold">{activeWorkspace.name}</span>
        <ChevronsUpDown className="h-4 w-4 opacity-50 hidden sm:block" />
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
