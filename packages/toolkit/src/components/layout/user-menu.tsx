"use client"

import { LogOut, QrCode, Settings, User, Users } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/primitives/avatar"

export interface UserData {
  id: string
  name: string
  email?: string
  avatar?: string
}

interface UserMenuProps {
  user: UserData
  onProfile?: () => void
  onContacts?: () => void
  contactCount?: number
  onVerify?: () => void
  onSettings?: () => void
  onLogout?: () => void
}

export function UserMenu({
  user,
  onProfile,
  onContacts,
  contactCount,
  onVerify,
  onSettings,
  onLogout,
}: UserMenuProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full" data-testid="user-menu-trigger">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            {user.email && (
              <p className="text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onProfile && (
          <DropdownMenuItem onClick={onProfile} className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Profil</span>
          </DropdownMenuItem>
        )}
        {onContacts && (
          <DropdownMenuItem onClick={onContacts} className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Kontakte</span>
            {contactCount != null && contactCount > 0 && (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{contactCount}</span>
            )}
          </DropdownMenuItem>
        )}
        {onVerify && (
          <DropdownMenuItem onClick={onVerify} className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            <span>Verifizieren</span>
          </DropdownMenuItem>
        )}
        {onSettings && (
          <DropdownMenuItem onClick={onSettings} className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Einstellungen</span>
          </DropdownMenuItem>
        )}
        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="flex items-center gap-2 text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Abmelden</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
