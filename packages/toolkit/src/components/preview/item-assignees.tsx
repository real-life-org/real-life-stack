"use client"

import type { User } from "@real-life-stack/data-interface"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { Tooltip, TooltipTrigger, TooltipContent } from "../primitives/tooltip"
import { ProfileLink } from "../profile/profile-link"
import { cn } from "../../lib/utils"

/**
 * `ItemAssignees` — overlapping avatar stack with a compact name
 * summary, used by `footerAdornment` to show who an item is assigned
 * to. Spec: `docs/spec/modules/shared-components.md` → `ItemAssignees`.
 *
 * Caller resolves the user objects (typically by reading
 * `assignedTo`-style relations and looking them up in a member list).
 * The component is purely presentational.
 *
 * Renders nothing when `users` is empty so callers can drop it in
 * unconditionally.
 *
 * UX:
 * - Avatars overlap with a 1.5-unit negative gap
 * - Short name summary on the right: single name, "A, B" for two,
 *   "A + N weitere" for three or more; `size="xs"` drops it and shrinks
 *   the avatars for the dense card
 * - Hover-tooltip with the full comma-separated list
 */
export interface ItemAssigneesProps {
  users: readonly User[]
  /**
   * Groesse des Stapels.
   * - `sm` (Default): Avatare 5×5 plus Namens-Resuemee daneben.
   * - `xs`: nur die Bilder, enger gestapelt, ohne Namen — fuer die dichte
   *   Karte (`ItemPreview density="dense"`), wo eine Matrix-Zelle keine
   *   Textzeile mehr traegt. Die Namen bleiben im Tooltip erreichbar.
   */
  size?: "sm" | "xs"
  className?: string
}

function getInitials(name: string): string {
  if (!name) return "?"
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]!).join("").toUpperCase().slice(0, 2)
}

export function ItemAssignees({ users, size = "sm", className }: ItemAssigneesProps) {
  if (users.length === 0) return null

  const winzig = size === "xs"

  const summary =
    users.length === 1
      ? users[0].displayName ?? users[0].id
      : users.length === 2
        ? `${users[0].displayName ?? users[0].id}, ${users[1].displayName ?? users[1].id}`
        : `${users[0].displayName ?? users[0].id} + ${users.length - 1} weitere`

  const fullList = users.map((u) => u.displayName ?? u.id).join(", ")

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1", className)}>
          <div className={winzig ? "flex -space-x-1" : "flex -space-x-1.5"}>
            {users.map((user) => (
              <ProfileLink
                key={user.id}
                userId={user.id}
                label={`Profil von ${user.displayName ?? user.id} öffnen`}
              >
                <Avatar className={cn("border border-background", winzig ? "h-4 w-4" : "h-5 w-5")}>
                  <AvatarImage src={user.avatarUrl} alt={user.displayName ?? user.id} />
                  <AvatarFallback className={cn("bg-muted", winzig ? "text-[7px]" : "text-[8px]")}>
                    {getInitials(user.displayName ?? user.id)}
                  </AvatarFallback>
                </Avatar>
              </ProfileLink>
            ))}
          </div>
          {/* In der Matrix-Zelle traegt das Bild den Namen — die Zeile
              darunter gaebe es nicht her. */}
          {!winzig && <span className="text-[10px] text-muted-foreground">{summary}</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{fullList}</TooltipContent>
    </Tooltip>
  )
}
