"use client"

import type { User } from "@real-life-stack/data-interface"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { Tooltip, TooltipTrigger, TooltipContent } from "../primitives/tooltip"
import { ProfileLink } from "../profile/profile-link"
import { cn, getReadableTextColor, getUserColor } from "../../lib/utils"

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
 * - Avatars overlap, at most five; the rest stays in the tooltip
 * - Initials carry the person's deterministic colour (`getUserColor`),
 *   so the same person looks the same wherever she appears
 * - Two styles per entry: `solid` (filled, default) and `outline`
 *   (ring and glyph in the person colour). What they MEAN is the app's
 *   business — the toolkit only supplies the two styles.
 * - Short name summary on the right: single name, "A, B" for two,
 *   "A + N weitere" for three or more; `size="xs"` drops it and shrinks
 *   the avatars for the dense card
 * - Hover-tooltip with the full comma-separated list
 */
/** Wieviele Gesichter ein Stapel traegt, bevor er unleserlich wird. */
const MAX_SICHTBARE_AVATARE = 5

/**
 * Ein Zugewiesener plus, optional, der Stil seines Avatars. `solid` ist der
 * Default. Zwei Stile ohne Bedeutung: Die App entscheidet, ob „umrandet"
 * heisst „will lernen", „vielleicht" oder etwas Drittes.
 */
export type ItemAssigneeUser = User & { variant?: "solid" | "outline" }

export interface ItemAssigneesProps {
  users: readonly ItemAssigneeUser[]
  /**
   * Groesse des Stapels.
   * - `sm` (Default): Avatare 5×5 plus Namens-Resuemee daneben.
   * - `xs`: Avatare 3.5×3.5 (14 px), enger gestapelt, ohne Namen — fuer die
   *   dichte Karte (`ItemPreview density="dense"`), wo eine Matrix-Zelle
   *   keine Textzeile mehr traegt. Die Namen bleiben im Tooltip erreichbar.
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
  // Mehr als fuenf Gesichter nebeneinander sind kein Stapel mehr, sondern ein
  // Band. Die uebrigen Namen stehen im Tooltip, gehen also nicht verloren.
  const sichtbare = users.slice(0, MAX_SICHTBARE_AVATARE)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1", className)}>
          <div className={winzig ? "flex -space-x-1" : "flex -space-x-1.5"}>
            {sichtbare.map((user) => {
              const name = user.displayName ?? user.id
              const farbe = getUserColor(user.id)
              const umrandet = user.variant === "outline"
              return (
                <ProfileLink key={user.id} userId={user.id} label={`Profil von ${name} öffnen`}>
                  <Avatar
                    className={cn(
                      // Der helle Ring trennt die ueberlappenden Kreise; ohne
                      // ihn verschwimmen zwei gleichfarbige zu einer Flaeche.
                      "ring-[1.5px] ring-background",
                      winzig ? "h-3.5 w-3.5" : "h-5 w-5",
                    )}
                  >
                    <AvatarImage src={user.avatarUrl} alt={name} />
                    <AvatarFallback
                      className={cn("font-bold", winzig ? "text-[6.5px]" : "text-[8px]")}
                      style={
                        umrandet
                          ? {
                              // Umrandet: heller Grund, Rand und Schrift in der
                              // Personenfarbe. Der Rand liegt innen, sonst
                              // waechst der Kreis gegenueber dem gefuellten.
                              backgroundColor: "var(--background)",
                              color: farbe,
                              boxShadow: `inset 0 0 0 1.5px ${farbe}`,
                            }
                          : { backgroundColor: farbe, color: getReadableTextColor(farbe) }
                      }
                    >
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                </ProfileLink>
              )
            })}
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
