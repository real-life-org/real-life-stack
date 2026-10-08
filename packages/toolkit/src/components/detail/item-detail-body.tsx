"use client"

import type { ReactNode } from "react"
import type { Item, User } from "@real-life/data-interface"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { RelativeTime } from "../primitives/relative-time"
import { ProfileLink } from "../profile/profile-link"
import { TagFilterChip } from "../tag/tag-filter-chip"
import { MarkdownText } from "../preview/markdown-text"
import { editedLabel, itemText } from "@/lib/item-text"
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
 * Die Ordnung sind die Slots der Detail-Anatomie (shared-components, „Item-
 * Detail aus dem Register"): `head` (Typ, Aktionen, Titel) → `meta` →
 * `actions` (Selbstaktion, hier `selfActions`) → `content` → `reverse` →
 * `tags` (mit Urheber) → `bar` (hier `footer`) → `comments` (liefert das
 * Panel darunter) → `note`. Ein Slot ohne Inhalt erzeugt nichts. Der Autor
 * rueckt nach unten, die harten Fakten (wann, wo, mit wem) stehen zusammen in
 * einer eigenen Flaeche.
 *
 * **Was NICHT hier entschieden wird:** was in der Meta-Box und der Fusszeile
 * steht. Das haengt am Item-TYP, nicht an der Flaeche (Spec 06), und kommt
 * darum als Slot herein — dieselben Slots, die auch die Vorschau fuellt.
 */
export interface ItemDetailBodyProps {
  item: Item
  /**
   * Urheber, schon aufgeloest. `undefined` → „Unbekannt" als Name, nie die
   * rohe Id (eine DID liest niemand, real-life-stack#562); das Profil oeffnet
   * weiter ueber `createdBy`.
   */
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
   * Die harten Fakten des Typs: Datum, Ort, Teilnehmer, Beziehungen. Landen in
   * der Meta-Box.
   *
   * Ohne Inhalt entfaellt die Box — eine leere graue Flaeche behauptet, es
   * gaebe etwas zu sehen. Das kann hier nicht per `if` entschieden werden: Was
   * hereinkommt, ist ein Element und damit immer „vorhanden", auch wenn es
   * `null` rendert. Die Box blendet sich darum selbst aus, wenn sie leer
   * bleibt. Ein Slot, der nichts zu sagen hat, MUSS `null` rendern, nicht eine
   * leere Huelle.
   */
  meta?: ReactNode
  /**
   * Slot `actions`: die Selbstaktion als Pill-Zeile direkt unter der Meta-Box
   * (C2, „Zusagen · Vielleicht · Absagen"). Heisst hier nicht `actions`, weil
   * der Prop schon das ⋮-Menue traegt. Jede Kante bringt ihre eigene Zeile
   * mit; die Stimme (C4) steht hier mit Pills und Balken.
   */
  selfActions?: ReactNode
  /** Slot `reverse`: Rückwärts-Listen aus dem Register (benannte Abfragen und eingehende Kanten, S3). */
  reverse?: ReactNode
  /**
   * Slot `bar`: Reaktionen und Kommentieren, ueber dem Divider. Die
   * Typ-Fusszeile steht hier nur noch fuer Typen ohne Feld- und Kantenliste
   * (Spec 06, Regel 17); Zusagen und Stimmen stehen in `selfActions`.
   */
  footer?: ReactNode
  /** Slot `note`: Nur-lesen-Hinweis oder Fehler-Banner, ganz unten. Gefuellt ab S5. */
  note?: ReactNode
  className?: string
}

/** Name eines Autors, den niemand aufloest (real-life-stack#562). */
const UNKNOWN_AUTHOR = "Unbekannt"

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
  selfActions,
  reverse,
  footer,
  note,
  className,
}: ItemDetailBodyProps) {
  const data = item.data as Record<string, unknown>
  const title = typeof data.title === "string" ? data.title : undefined
  const description = itemText(item) ?? ""
  const tags = useItemTags(item)

  const authorName = author?.displayName || UNKNOWN_AUTHOR
  const authorId = author?.id ?? item.createdBy
  const resolveName = useUserNameResolver()
  const editedTitle = editedLabel(item, resolveName)

  return (
    <article className={cn("flex flex-col gap-3 p-4", className)}>
      {/* Eine Kopfzeile fuer beides: Liegt ein Panel darueber, wandern die
          Aktionen in dessen Leiste und die Zeile traegt nur die Badges. Ohne
          Panel stehen sie hier rechts — nicht als eigene Zeile davor. Bleibt
          beides leer (Aktionen portiert, keine Badges), faellt die Zeile weg. */}
      {(headerAdornment || actions) && (
        <div className="flex items-start justify-between gap-2 empty:hidden">
          {headerAdornment && (
            <div className="flex min-w-0 flex-wrap items-center gap-2">{headerAdornment}</div>
          )}
          {actions && <PanelHeaderActions>{actions}</PanelHeaderActions>}
        </div>
      )}

      {title && <h2 className="text-xl font-semibold leading-snug text-foreground">{title}</h2>}

      {meta && (
        // Die Fakten stehen zusammen auf eigener Flaeche, statt als lose Zeilen
        // zwischen Titel und Text zu haengen. `empty:hidden`, weil ein
        // Typ-Slot, der nichts beizutragen hat, `null` rendert — die Box waere
        // sonst ein leerer grauer Kasten. Auch die Luecke davor faellt weg
        // (`empty:hidden` nimmt das Element aus dem Flex-Fluss).
        <div className="rounded-lg border bg-muted px-3 py-2.5 text-sm text-muted-foreground empty:hidden">
          {meta}
        </div>
      )}

      {selfActions && (
        // Slot `actions`: `empty:hidden` wie bei der Meta-Box — eine
        // Selbstaktion, die nichts anzubieten hat, rendert `null`.
        <div data-slot="actions" className="flex flex-col gap-2 empty:hidden">
          {selfActions}
        </div>
      )}

      {description && (
        // Der Composer schreibt Markdown, also wird ueberall Markdown
        // gerendert. Im Detail ungekuerzt — hier ist Platz.
        <MarkdownText className="text-sm text-foreground">{description}</MarkdownText>
      )}

      {reverse && (
        <div data-slot="reverse" className="flex flex-col gap-3 empty:hidden">
          {reverse}
        </div>
      )}

      {/* Tags und Urheber teilen eine Zeile: die Tags fliessen links, der
          Urheber bleibt rechts und bricht nicht um. Bei vielen Tags gewinnt
          der Urheber — wer etwas geschrieben hat, ist die wichtigere Auskunft
          als der fuenfte Tag. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {tags.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <TagFilterChip key={tag} tag={tag} />
            ))}
          </div>
        )}
        {/* Der Name kuerzt, das Datum nicht: Ein langer Anzeigename — oder die
            rohe Id, wenn niemand ihn aufloesen kann — wuerde die Zeile sonst
            aus der Karte schieben. Was rechts steht, ist die kuerzere und
            verlaesslichere Auskunft. */}
        <div className="ml-auto flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ProfileLink userId={authorId} label={`Profil von ${authorName} öffnen`}>
            <Avatar className="h-5 w-5 shrink-0">
              <AvatarImage src={author?.avatarUrl} alt={authorName} />
              <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
                {getInitials(authorName)}
              </AvatarFallback>
            </Avatar>
          </ProfileLink>
          <span className="truncate" title={authorName}>
            Erstellt von <span className="text-foreground">{authorName}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <span aria-hidden>·</span>
            <RelativeTime date={item.createdAt} className="text-xs" />
            {/* Mitglieder duerfen fremde Items aendern; ohne diesen Hinweis
                waere eine fremde Aenderung unsichtbar. Bewusst knapp: WAS sich
                geaendert hat, braucht eine Versionshistorie (rls#263). */}
            {item.updatedAt && <span title={editedTitle}>· bearbeitet</span>}
          </span>
        </div>
      </div>

      {footer && (
        // Der einzige Trenner der Ansicht — er scheidet das Item von dem, was
        // andere dazu tun (reagieren, zusagen, kommentieren).
        <div className="-mx-4 mt-1 border-t px-4 pt-3">{footer}</div>
      )}

      {note && (
        <div data-slot="note" className="text-xs text-muted-foreground empty:hidden">
          {note}
        </div>
      )}
    </article>
  )
}
