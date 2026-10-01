"use client"

import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { cn } from "../../lib/utils"

/** Bis zu zwei Anfangsbuchstaben des Namens, „?" ohne Namen. */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0]!)
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  )
}

/**
 * Der Avatar einer Person, wo sie neben ihrem Namen steht (Menschen-Zeile,
 * Personen-Feld): das Bild aus `User.avatarUrl`, sonst die Initialen. Der Name
 * steht daneben; das Bild ist Schmuck.
 */
export function PersonAvatar({ name, avatarUrl, className }: { name: string; avatarUrl?: string; className?: string }) {
  return (
    <Avatar data-avatar aria-hidden className={cn("h-[18px] w-[18px] shrink-0", className)}>
      <AvatarImage src={avatarUrl} alt="" />
      <AvatarFallback className="bg-muted text-[7px] font-bold">{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
