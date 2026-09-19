"use client"

import { memo, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"
import type { Item, User } from "@real-life-stack/data-interface"
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar"
import { RelativeTime } from "../primitives/relative-time"
import { ProfileLink } from "../profile/profile-link"
import { TagFilterChip } from "../tag/tag-filter-chip"
import { MarkdownText } from "./markdown-text"
import { cn } from "../../lib/utils"
import { useItemTags } from "../../hooks/use-item-tags"
import { useUserNameResolver } from "../../hooks/use-user-names"
import { useCommentCount } from "../../hooks/use-comment-count"
import { useCommentLink } from "../navigation/comment-navigation"
import { MessageSquare } from "lucide-react"

/**
 * `ItemPreview` — shared item-card surface for list/board/feed contexts.
 *
 * Spec: `docs/spec/modules/shared-components.md` → `ItemPreview`.
 *
 * Renders only the generic, type-agnostic part of an item (author row,
 * title, description, tags). Module-specific cues — type badges, date
 * hints, status chips, assignees, marker colors, comment counts — flow
 * in through three Adornment slots, so each module decorates the same
 * card without forking the layout.
 *
 * Three slots, each renders independently of the data blocks so a card
 * with only some sections still places its adornments correctly:
 * - `headerAdornment`: next to the author name when the author row is
 *   rendered, otherwise its own top row above the title (e.g.
 *   `<TypeBadge>`).
 * - `metaAdornment`: its own row below the title block, also rendered
 *   when there is no title (e.g. a card with only date+address).
 * - `footerAdornment`: bordered footer row below tags (e.g. assignees,
 *   status chip, comment count).
 *
 * Caller owns the click handler (open detail, etc.). Adornments that
 * carry their own buttons should `event.stopPropagation()` so a button
 * click doesn't double-fire the card click. When `onClick` is set the
 * card also becomes keyboard-activatable (Enter / Space) and exposes
 * `role="button"` plus `tabIndex={0}` so assistive tech can reach it.
 *
 * Reads `data.title` / `data.content` / `data.description` via plain
 * field access. Tags come from `item.tags` (top-level, spec 07-tags.md).
 * Anything time- or place-shaped (date hint, address, distance) is the
 * caller's job and flows through `metaAdornment`. Author resolution
 * stays with the caller — pass a resolved `User` (e.g. via
 * `useItemAuthor`) or rely on the `createdBy` fallback.
 */
/**
 * Layout density. `comfortable` is the feed-card sized default (avatar
 * 10×10, font-base title, p-4 spacing, description shown). `compact`
 * is tuned for kanban boards and dense list views: no description in
 * the body, smaller padding/font/avatar so multiple cards fit a
 * column without bleeding off-screen. `dense` is the matrix tile: a
 * title of at most three lines plus the footer the caller supplies,
 * nothing else, so twelve columns fit one screen. Masse aus „RLS System
 * Design → Dragon Dreaming.dc.html", Variante 1a: 112 px breit, rund
 * 62 px hoch.
 */
export type ItemPreviewDensity = "comfortable" | "compact" | "dense"
export type ItemPreviewSurface = "card" | "panel"

/** Neutral toolkit default; apps may supply an origin-group colour instead. */
/** Rand der aktiven Karte, wenn kein Space eine Farbe beisteuert. */
/** Tags, die eine Karte zeigt, bevor sie den Rest zu „+N" zusammenfasst. */
const MAX_SICHTBARE_TAGS = 3

export const DEFAULT_ACTIVE_ITEM_COLOR = "#64748b"
/** @deprecated Frueherer Name von {@link DEFAULT_ACTIVE_ITEM_COLOR}. */
export const DEFAULT_ACTIVE_ITEM_GLOW_COLOR = DEFAULT_ACTIVE_ITEM_COLOR

export interface ItemPreviewProps {
  item: Item
  /**
   * Resolved item author.
   * - `undefined` (or omitted): the card renders the author row with
   *   `item.createdBy` as the display name and an initials-only avatar.
   * - `User`: render with the resolved name/avatar.
   * - `null`: suppress the entire author row (useful when the
   *   surrounding view already shows the author context).
   */
  author?: User | null
  /** Card click — typically opens a detail view. */
  onClick?: () => void
  /** Slot next to the author name. */
  headerAdornment?: ReactNode
  /** Right-aligned actions at the end of the header row (e.g. the detail ⋮
   *  menu). Detail views pass it; list cards leave it empty so cards stay
   *  action-free. */
  actions?: ReactNode
  /** Slot between title and description. */
  metaAdornment?: ReactNode
  /** Slot below the tag chips. */
  footerAdornment?: ReactNode
  /**
   * Layout density. Default `comfortable` matches the feed card.
   * `compact` shrinks paddings and avatar, drops the description
   * block — fits kanban / dense list contexts. `dense` is the tile for
   * grids and matrices (12+ columns): title (max 3 lines) plus the
   * `footerAdornment` the caller supplies — no body, no meta row, no
   * tags, no author, no comment count.
   * Spec: `docs/spec/modules/shared-components.md`.
   */
  density?: ItemPreviewDensity
  /**
   * Which SURFACE renders this preview (the density axis' sibling: density
   * tunes spacing, surface decides what belongs at all).
   *
   * - `card` (default): one of many. Clamps the body to four lines so a long
   *   text cannot push its neighbours off screen, and hints at comments the
   *   reader cannot see.
   * - `panel`: **ueberholt.** Die Detailansicht ist keine Vorschau mehr,
   *   sondern `ItemDetailBody` mit eigener Anatomie — die wiederverwendete
   *   Card ergab im schwebenden Panel eine Card in der Card, und die
   *   Reihenfolge (Autor zuerst) gehoert einer Liste, nicht einer geoeffneten
   *   Ansicht. Bleibt erhalten, damit bestehende Einbindungen weiterlaufen;
   *   fuer neue Detailflaechen `ItemDetailBody` nehmen.
   */
  surface?: ItemPreviewSurface
  /**
   * Hebt die ausgewaehlte Karte hervor: derselbe Schatten, den das schwebende
   * Panel traegt (`shadow-xl`), plus ein duenner Rand in der Space-Farbe.
   *
   * Frueher lag darunter zusaetzlich ein breiter farbiger Schein. Neben einer
   * schwebenden Karte auf getoentem Grund trug der zu dick auf — der Schatten
   * sagt „gehoert zu dem, was rechts offen ist", der Rand sagt, zu welchem
   * Space. Zwei Aussagen, nicht drei.
   */
  active?: boolean
  /**
   * Die Sache ist erledigt: Haekchen vor dem Titel, die ganze Karte gedimmt.
   * Was „erledigt" heisst, entscheidet die Flaeche — eine Kanban-Spalte, ein
   * Feld, ein Haken in der App. Das Toolkit zeigt es nur an.
   */
  completed?: boolean
  /** Farbe des Rands der aktiven Karte (`#rrggbb`), meist die Space-Farbe. */
  activeColor?: string
  /** @deprecated Frueherer Name von {@link activeColor}. */
  activeGlowColor?: string
  className?: string
  /** Inline style on the card root — e.g. the active-item glow (box-shadow). */
  style?: CSSProperties
}

/**
 * Der Hinweis auf die Diskussion — und, wo es einen Weg gibt, zugleich der Weg
 * hinein. Die Zahl erscheint nur, wenn es etwas zu zaehlen gibt: „0
 * Kommentare" sagt dasselbe wie nichts und kostet eine Zeile.
 */
function KommentarHinweis({
  anzahl,
  kompakt,
  dicht = false,
  onClick,
}: {
  anzahl: number
  kompakt: boolean
  /** Matrix-Zelle: kleineres Symbol, kleinere Zahl. */
  dicht?: boolean
  onClick: (() => void) | null
}) {
  const inhalt = (
    <>
      <MessageSquare className={dicht ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {anzahl > 0 && <span className="tabular-nums">{anzahl}</span>}
      {/* In einer Kanban-Spalte ist fuer das Wort kein Platz. */}
      {!kompakt && <span>Kommentieren</span>}
    </>
  )
  // Was hier steht, ist in der dichten Ansicht eine nackte Zahl neben einem
  // Symbol — vorgelesen ergibt das „2", sonst gar nichts. Die Bedeutung muss
  // also ausgesprochen werden, und zwar in beiden Ansichten: Auch „💬 2
  // Kommentieren" liest sich vorgelesen holprig.
  const beschriftung =
    anzahl === 0
      ? "Kommentieren"
      : `${anzahl} ${anzahl === 1 ? "Kommentar" : "Kommentare"}, kommentieren`
  const klassen = cn(
    "flex shrink-0 items-center text-muted-foreground",
    dicht ? "gap-0.5 text-[10px]" : "gap-1.5 text-xs",
  )
  if (!onClick) {
    // Ohne Weg ist es eine Auskunft, kein Bedienelement — der Name gehoert
    // trotzdem dazu, sonst bleibt die Zahl unerklaert.
    return (
      <span className={klassen} aria-label={beschriftung} title={beschriftung}>
        {inhalt}
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-label={beschriftung}
      // Der Klick gehoert dem Hinweis, nicht der Karte darunter: Beides oeffnet
      // dasselbe Item, aber nur dieser Weg setzt den Cursor ins Feld.
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(klassen, "rounded-full px-2 py-0.5 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40")}
    >
      {inhalt}
    </button>
  )
}

function getInitials(name: string): string {
  if (!name) return "?"
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!)
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/**
 * A card in a list of cards.
 *
 * Memoised, because a card re-renders for reasons that have nothing to do with
 * it: while someone writes in the composer the draft is republished, and every
 * module showing items renders again — with 60 cards on screen that was 60
 * cards of work per update. The memo only bites where the surface hands over
 * stable props; a freshly built `headerAdornment` or an inline `onClick`
 * defeats it, so a surface builds its row in a component of its own (see
 * `FeedCard` in feed-view.tsx, `KanbanCard` here in the toolkit).
 */
export const ItemPreview = memo(function ItemPreview({
  item,
  author,
  onClick,
  headerAdornment,
  actions,
  metaAdornment,
  footerAdornment,
  density = "comfortable",
  surface = "card",
  active = false,
  completed = false,
  activeColor,
  activeGlowColor,
  className,
  style,
}: ItemPreviewProps) {
  const data = item.data as Record<string, unknown>
  const title = typeof data.title === "string" ? data.title : undefined
  const description =
    density === "compact" || density === "dense"
      ? ""
      : (typeof data.content === "string" && data.content) ||
        (typeof data.description === "string" && data.description) ||
        ""
  const tags = useItemTags(item)
  const isPanel = surface === "panel"
  // `dense` ist die Matrix-Karte: Sie teilt mit `compact` die engen Masse,
  // laesst aber alles weg, was eine Zelle von 120×60 px nicht traegt.
  const isDense = density === "dense"
  const isCompact = density === "compact" || isDense
  // A card should reveal that a discussion exists — otherwise comments are
  // invisible until the item is opened. The panel lists them anyway.
  const commentCount = useCommentCount(item.id)
  // Fuehrt der Hinweis irgendwohin? Das weiss die App (Route, Panel,
  // Eingabefeld), nicht diese Karte.
  const zumKommentieren = useCommentLink(item)
  // Ohne Kommentare steht dort keine Null, sondern eine Einladung — aber nur,
  // wenn man ihr auch folgen kann. Sonst bliebe „Kommentieren" ein Versprechen
  // ohne Deckung.
  // In der Matrix-Zelle steht der Zaehler nur, wenn es etwas zu zaehlen gibt:
  // Ein Symbol ohne Zahl waere dort eine Einladung, fuer die kein Platz ist.
  // In der Matrix-Kachel steht ueberhaupt kein Zaehler: Sie zeigt genau zwei
  // Dinge, den Titel und wer dranhaengt.
  const showCommentHint =
    !isPanel && !isDense && (commentCount > 0 || zumKommentieren !== null)

  const authorName = author?.displayName ?? item.createdBy
  const authorAvatar = author?.avatarUrl
  const authorId = author?.id ?? item.createdBy
  // Who edited it, resolved like any other user id; falls back to the raw id.
  const resolveName = useUserNameResolver()
  const editedTitle = item.updatedAt
    ? `Bearbeitet von ${resolveName(item.updatedBy ?? item.createdBy)} am ${new Date(item.updatedAt).toLocaleString("de-DE")}`
    : undefined

  // Keyboard activation: when the card is interactive, treat Enter and
  // Space like a button. We don't render a real <button> because the
  // card carries nested interactive content (adornment buttons, links)
  // which would be invalid inside a button; <article> + button-role is
  // the standard pattern for clickable cards with nested actions.
  const interactive = !!onClick
  const handleKeyDown = interactive
    ? (e: KeyboardEvent<HTMLElement>) => {
        if (e.target !== e.currentTarget) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
      }
    : undefined

  // Wieviele Tags die Zeile traegt, ohne den Urheber zu verdraengen. Fest
  // statt gemessen: Eine Messung waere erst nach dem ersten Bild da und
  // liesse die Karte sichtbar springen. In der dichten Ansicht bleibt einer.
  const sichtbareTags = tags.slice(0, isCompact ? 1 : MAX_SICHTBARE_TAGS)
  const verborgeneTags = tags.length - sichtbareTags.length

  // Alter Prop-Name gilt weiter: das Toolkit ist veroeffentlicht.
  const aktivFarbe = activeColor ?? activeGlowColor ?? DEFAULT_ACTIVE_ITEM_COLOR
  // Dieselbe Zurueckhaltung wie beim Ueberfahren (`hover:border-primary/30`):
  // Der Rand soll den Space andeuten, nicht die Karte umranden. Bei voller
  // Deckkraft traegt er sichtbar dicker auf, obwohl er gleich breit ist.
  const aktivRand = /^#[0-9a-f]{6}$/i.test(aktivFarbe) ? `${aktivFarbe}4d` : aktivFarbe

  return (
    <article
      data-preview-density={density}
      data-active-preview={active ? "true" : undefined}
      data-completed={completed ? "true" : undefined}
      className={cn(
        "flex flex-col border bg-card transition-all",
        // Die Kachel traegt den kleineren Radius: 8 px runden an einer
        // 112-px-Flaeche sichtbar mehr ab als an einer Feed-Karte.
        isDense ? "gap-1 rounded-md p-[7px]" : "rounded-lg",
        isDense ? "" : isCompact ? "gap-1.5 p-3" : "gap-2 p-4",
        interactive &&
          "cursor-pointer hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        // Derselbe Schatten wie die schwebende Karte: die ausgewaehlte Karte
        // hebt sich vom Grund ab. Die Farbe steckt nur noch im Rand.
        active && "shadow-xl",
        className,
      )}
      style={{
        ...(active ? { borderColor: aktivRand } : {}),
        // Erledigtes verschwindet nicht, es tritt zurueck.
        ...(completed ? { opacity: 0.55 } : {}),
        ...style,
      }}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {/* Kopfzeile: Was ist das, und was kann ich damit tun. Der Titel fuehrt,
          der Typ steht daneben. Ohne Titel entfaellt die Zeile — ein Badge
          allein ueber einer kurzen Notiz waere eine leere Behauptung; die
          Verzierungen ruecken dann zum Inhalt. */}
      {(title || actions) && (
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
            {title && (
              <h3
                // Deutsche Komposita sind lang und eine Kachel ist 112 px
                // breit: ohne Trennung stuende „Gemeinschaftsgarten" ueber den
                // Rand hinaus. `lang` macht die Silbentrennung erst moeglich.
                lang={isDense ? "de" : undefined}
                className={cn(
                  "min-w-0 flex-1 font-semibold text-foreground",
                  // Drei Zeilen, dann Auslassung: In einer Matrix ist die
                  // Zeilenhoehe die Rasterhoehe — ein langer Titel darf die
                  // Zeile darunter nicht verschieben.
                  isDense
                    ? "line-clamp-3 text-[10.5px] leading-[1.3]"
                    : "text-base leading-snug",
                )}
                style={
                  isDense ? { overflowWrap: "anywhere", hyphens: "auto" } : undefined
                }
              >
                {/* Erledigtes traegt das Haekchen im Titel: In der Kachel gibt
                    es keine zweite Zeile, die es tragen koennte. */}
                {completed && (
                  <>
                    <span aria-hidden>✓ </span>
                    <span className="sr-only">Erledigt: </span>
                  </>
                )}
                {title}
              </h3>
            )}
            {headerAdornment && <div className="flex shrink-0 items-center gap-1.5">{headerAdornment}</div>}
          </div>
          {actions && <div className="-mr-1 -mt-1 shrink-0">{actions}</div>}
        </div>
      )}

      {!title && headerAdornment && !actions && (
        <div className="flex flex-wrap items-center gap-1.5">{headerAdornment}</div>
      )}

      {/* Die harten Fakten des Typs: wann, wo, mit wem. */}
      {metaAdornment && !isDense && (
        <div className="text-xs text-muted-foreground">{metaAdornment}</div>
      )}

      {description && (
        // Der Composer schreibt Markdown, also wird ueberall Markdown
        // gerendert. Auf einer Karte gekuerzt, damit ein langer Text die
        // Nachbarn nicht vom Schirm schiebt.
        <MarkdownText className={cn("text-sm text-foreground", !isPanel && "line-clamp-4")}>
          {description}
        </MarkdownText>
      )}

      {/* Tags und Urheber teilen eine Zeile. Die Tags kappen, der Urheber
          bleibt: Wer etwas geschrieben hat, ist die verlaesslichere Auskunft
          als der fuenfte Tag. Umbrechen darf hier nichts — sonst waechst die
          Karte je nach Anzahl der Tags unterschiedlich hoch. */}
      {!isDense && (sichtbareTags.length > 0 || author !== null) && (
        <div className="flex items-center gap-x-3 overflow-hidden">
          {sichtbareTags.length > 0 && (
            <div className="flex min-w-0 shrink items-center gap-1.5 overflow-hidden">
              {sichtbareTags.map((tag) => (
                <TagFilterChip key={tag} tag={tag} />
              ))}
              {verborgeneTags > 0 && (
                <span
                  className="shrink-0 rounded-full border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  // „+2" allein sagt nicht, wovon — vorgelesen wie im
                  // Tooltip. Die verborgenen Tags stehen im Titel, damit man
                  // nicht erst das Item oeffnen muss.
                  aria-label={
                    verborgeneTags === 1 ? "1 weiterer Tag" : `${verborgeneTags} weitere Tags`
                  }
                  title={tags.slice(sichtbareTags.length).join(", ")}
                >
                  +{verborgeneTags}
                </span>
              )}
            </div>
          )}
          {author !== null && (
            /* Der Name kuerzt, das Datum nicht: Ein langer Anzeigename — oder
               die rohe Id, wenn niemand ihn aufloest — schoebe die Tags sonst
               ganz aus der Zeile, und Datum und Bearbeitungshinweis
               verschwaenden im `overflow-hidden` darum herum. Derselbe Fehler
               stand schon einmal in ItemDetailBody (#307). */
            <div className="ml-auto flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <ProfileLink userId={authorId} label={`Profil von ${authorName} öffnen`}>
                {/* In der dichten Ansicht traegt das Bild den Namen: In einer
                    Kanban-Spalte ist fuer beides kein Platz. */}
                <Avatar className="h-5 w-5 shrink-0" title={isCompact ? authorName : undefined}>
                  <AvatarImage src={authorAvatar} alt={authorName} />
                  <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
                    {getInitials(authorName)}
                  </AvatarFallback>
                </Avatar>
              </ProfileLink>
              {!isCompact && (
                <>
                  <span className="truncate" title={authorName}>{authorName}</span>
                  <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                    <span aria-hidden>·</span>
                    <RelativeTime date={item.createdAt} className="text-xs" />
                    {/* Mitglieder duerfen fremde Items aendern; ohne diesen
                        Hinweis waere eine fremde Aenderung unsichtbar. */}
                    {item.updatedAt && <span title={editedTitle}>· bearbeitet</span>}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Aktionszeile: der einzige Trenner der Karte. Links, was die Flaeche
          beitraegt (Reaktionen, Typ-Fusszeile), rechts der Hinweis auf die
          Diskussion. Ohne Kommentare steht dort keine Null — sie sagte
          dasselbe wie nichts und kostete eine Zeile. */}
      {(footerAdornment || showCommentHint) && (
        <div
          className={cn(
            "flex items-center justify-between",
            // Die Matrix-Zelle hat fuer einen Trenner keine Hoehe uebrig; die
            // Fusszeile sitzt direkt unter dem Titel.
            isDense
              ? "mt-auto gap-1"
              : cn("gap-3 border-t", isCompact ? "-mx-3 mt-0.5 px-3 pt-1.5" : "-mx-4 mt-1 px-4 pt-2"),
          )}
        >
          <div className={cn("flex min-w-0 items-center", isDense ? "gap-1" : "gap-3")}>
            {footerAdornment}
          </div>
          {showCommentHint && <KommentarHinweis
            anzahl={commentCount}
            kompakt={isCompact}
            dicht={isDense}
            onClick={zumKommentieren}
          />}
        </div>
      )}
    </article>
  )
})
