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

/**
 * Der helle Ring um jeden Avatar trennt die ueberlappenden Kreise; ohne ihn
 * verschwimmen zwei gleichfarbige zu einer Flaeche.
 */
const TRENNRING = "0 0 0 1.5px var(--background)"

/** Wieviele Gesichter ein Stapel traegt, bevor er unleserlich wird. */
const MAX_SICHTBARE_AVATARE = 5

/**
 * Eine zugewiesene Person, optional mit dem Anzeigetext ihres Qualifiers an
 * der Kante („lernt" für `assignedTo.role: learns`). Er steht klein hinter
 * dem Namen, wie in der Menschen-Zeile (shared-components, Detail-Anatomie
 * Regel 5); ein fehlender Qualifier (default) steht nicht da.
 *
 * `variant` ist die Form ihres Avatars: `solid` (Default) oder `outline`.
 * Zwei Formen ohne Bedeutung — die App entscheidet, ob „umrandet" heisst
 * „will lernen", „vielleicht" oder etwas Drittes.
 */
export type ItemAssigneeUser = User & { qualifier?: string; variant?: "solid" | "outline" }

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

  // „Timo lernt": der Qualifier klein hinter dem Namen.
  const named = (u: ItemAssigneeUser) => `${u.displayName ?? u.id}${u.qualifier ? ` ${u.qualifier}` : ""}`
  const summary =
    users.length === 1
      ? named(users[0])
      : users.length === 2
        ? `${named(users[0])}, ${named(users[1])}`
        : `${named(users[0])} + ${users.length - 1} weitere`

  const fullList = users.map(named).join(", ")
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
              const ring = 1.5
              const abstand = winzig ? 1 : 1.5
              return (
                <ProfileLink
                  key={user.id}
                  userId={user.id}
                  // Der Qualifier gehoert zur Person: Wer per Tastatur auf den
                  // Avatar faellt, hoert „Lena Berg (lernt)", auch ohne Tooltip.
                  label={`Profil von ${name}${user.qualifier ? ` (${user.qualifier})` : ""} öffnen`}
                >
                  <Avatar
                    data-variant={umrandet ? "outline" : "solid"}
                    className={winzig ? "h-3.5 w-3.5" : "h-5 w-5"}
                    style={
                      umrandet
                        ? {
                            // Die Form haengt am Avatar selbst, nicht am
                            // Fallback: Sobald das Foto geladen ist, entfernt
                            // Radix den Fallback, und mit ihm verschwand die
                            // Unterscheidung (Loop-Review rls#360). Ring in der
                            // Personenfarbe, darin ein Innenabstand im
                            // Hintergrund-Token, darin Foto oder Initialen.
                            // Der Ring liegt innen, sonst waechst der Kreis
                            // gegenueber dem gefuellten.
                            backgroundColor: "var(--background)",
                            padding: `${ring + abstand}px`,
                            boxShadow: `inset 0 0 0 ${ring}px ${farbe}, ${TRENNRING}`,
                          }
                        : { boxShadow: TRENNRING }
                    }
                  >
                    <AvatarImage
                      src={user.avatarUrl}
                      alt={name}
                      // Umrandet tritt das Foto zurueck: kleiner und blasser.
                      // So traegt die Helligkeit die Unterscheidung mit, nicht
                      // die Farbe allein.
                      className={umrandet ? "rounded-full opacity-50" : undefined}
                    />
                    <AvatarFallback
                      className={cn("font-bold", winzig ? "text-[6.5px]" : "text-[8px]")}
                      style={
                        umrandet
                          ? {
                              // Die Initialen nutzen die volle Flaeche bis an
                              // den Ring; nur das Foto rueckt nach innen. Sonst
                              // stuenden zwei Buchstaben in 14 px auf dem Ring.
                              backgroundColor: "transparent",
                              color: farbe,
                              margin: `-${ring + abstand}px`,
                              width: `calc(100% + ${2 * (ring + abstand)}px)`,
                              height: `calc(100% + ${2 * (ring + abstand)}px)`,
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
          {!winzig && (
            <span aria-hidden className="text-[10px] text-muted-foreground">
              {summary}
            </span>
          )}
          {/* Der Tooltip erscheint nur beim Ueberfahren; die vollstaendige
              Liste (auch Person sechs und folgende, mit Qualifier) steht
              darum als Text im Baum. Das sichtbare Resuemee ist dafuer
              ausgeblendet, sonst hoerte man die ersten Namen doppelt. */}
          <span className="sr-only">{fullList}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{fullList}</TooltipContent>
    </Tooltip>
  )
}
