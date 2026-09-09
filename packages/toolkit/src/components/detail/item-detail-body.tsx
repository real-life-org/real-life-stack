"use client"

import type { ReactNode } from "react"
import type { Item, User } from "@real-life-stack/data-interface"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { RelativeTime } from "../primitives/relative-time"
import { ProfileLink } from "../profile/profile-link"
import { TagChip } from "../tag/tag-chip"
import { MarkdownText } from "../preview/markdown-text"
import { cn } from "../../lib/utils"
import { useItemTags } from "../../hooks/use-item-tags"
import { useUserNameResolver } from "../../hooks/use-user-names"
import { PanelHeaderActions } from "../layout/panel-header-actions"

/**
 * `ItemDetailBody` — die Leseansicht eines Items im Detail-Panel.
 *
 * Spec: `docs/spec/modules/shared-components.md` → `ItemDetail`.
 *
 * **Warum das keine `ItemPreview` ist.** Bis hierher zeigte das Panel dieselbe
 * Card wie der Feed, nur breiter. In der schwebenden Karte ergab das eine Card
 * in einer Card: zwei Rahmen, zwei Schatten, zwei Radien um denselben Inhalt.
 * Und die Reihenfolge stimmte nicht mehr — eine Vorschau fuehrt mit dem Autor,
 * weil man in einer Liste zuerst wissen will, von wem etwas kommt. Wer ein Item
 * geoeffnet hat, will zuerst wissen, WAS es ist.
 *
 * Die Ordnung hier: Typ und Aktionen → Titel → Meta-Box → Beschreibung →
 * Tags und Urheber → Aktionszeile. Der Autor rueckt nach unten, die harten
 * Fakten (wann, wo, mit wem) stehen zusammen in einer eigenen Flaeche.
 *
 * **Was NICHT hier entschieden wird:** was in der Meta-Box und der Fusszeile
 * steht. Das haengt am Item-TYP, nicht an der Flaeche (Spec 06), und kommt
 * darum als Slot herein — dieselben Slots, die auch die Vorschau fuellt.
 */
export interface ItemDetailBodyProps {
  item: Item
  /** Urheber, schon aufgeloest. `undefined` → nur die rohe Id als Name. */
  author?: User
  /** Typ-Badge, Scope-Badge — steht ganz oben, links neben den Aktionen. */
  headerAdornment?: ReactNode
  /**
   * Das ⋮-Menue (Bearbeiten, Loeschen, Teilen). Wandert in die Knopfleiste des
   * umgebenden Panels, neben Modus- und Schliessen-Knopf — dort erwartet man
   * es, und dort kollidiert es nicht mit ihnen. Ohne Panel darueber bleibt es
   * in der Kopfzeile dieser Ansicht.
   */
  actions?: ReactNode
  /**
   * Die harten Fakten des Typs: Datum, Ort, Teilnehmer. Landen in der
   * Meta-Box. Ohne Inhalt entfaellt die Box ganz — eine leere graue Flaeche
   * behauptet, es gaebe etwas zu sehen.
   */
  meta?: ReactNode
  /** Typ-Fusszeile (Zusagen, Stimmen) und Reaktionen, ueber dem Divider. */
  footer?: ReactNode
  className?: string
}

function getInitials(name: string): string {
  if (!name) return "?"
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((wort) => wort[0]!)
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function ItemDetailBody({
  item,
  author,
  headerAdornment,
  actions,
  meta,
  footer,
  className,
}: ItemDetailBodyProps) {
  const data = item.data as Record<string, unknown>
  const title = typeof data.title === "string" ? data.title : undefined
  const description =
    (typeof data.content === "string" && data.content) ||
    (typeof data.description === "string" && data.description) ||
    ""
  const tags = useItemTags(item)

  const authorName = author?.displayName ?? item.createdBy
  const authorId = author?.id ?? item.createdBy
  const resolveName = useUserNameResolver()
  const editedTitle = item.updatedAt
    ? `Bearbeitet von ${resolveName(item.updatedBy ?? item.createdBy)} am ${new Date(item.updatedAt).toLocaleString("de-DE")}`
    : undefined

  return (
    <article className={cn("flex flex-col gap-3 p-4", className)}>
      {actions && <PanelHeaderActions>{actions}</PanelHeaderActions>}

      {headerAdornment && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">{headerAdornment}</div>
      )}

      {title && <h2 className="text-xl font-semibold leading-snug text-foreground">{title}</h2>}

      {meta && (
        // Die Fakten stehen zusammen auf eigener Flaeche, statt als lose
        // Zeilen zwischen Titel und Text zu haengen.
        <div className="rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          {meta}
        </div>
      )}

      {description && (
        // Der Composer schreibt Markdown, also wird ueberall Markdown
        // gerendert. Im Detail ungekuerzt — hier ist Platz.
        <MarkdownText className="text-sm text-foreground">{description}</MarkdownText>
      )}

      {/* Tags und Urheber teilen eine Zeile: die Tags fliessen links, der
          Urheber bleibt rechts und bricht nicht um. Bei vielen Tags gewinnt
          der Urheber — wer etwas geschrieben hat, ist die wichtigere Auskunft
          als der fuenfte Tag. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {tags.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <ProfileLink userId={authorId} label={`Profil von ${authorName} öffnen`}>
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={author?.avatarUrl} alt={authorName} />
              <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
                {getInitials(authorName)}
              </AvatarFallback>
            </Avatar>
          </ProfileLink>
          <span>
            Erstellt von <span className="text-foreground">{authorName}</span>
          </span>
          <span aria-hidden>·</span>
          <RelativeTime date={item.createdAt} className="text-xs" />
          {/* Mitglieder duerfen fremde Items aendern; ohne diesen Hinweis
              waere eine fremde Aenderung unsichtbar. Bewusst knapp: WAS sich
              geaendert hat, braucht eine Versionshistorie (rls#263). */}
          {item.updatedAt && <span title={editedTitle}>· bearbeitet</span>}
        </div>
      </div>

      {footer && (
        // Der einzige Trenner der Ansicht — er scheidet das Item von dem, was
        // andere dazu tun (reagieren, zusagen, kommentieren).
        <div className="-mx-4 mt-1 border-t px-4 pt-3">{footer}</div>
      )}
    </article>
  )
}
