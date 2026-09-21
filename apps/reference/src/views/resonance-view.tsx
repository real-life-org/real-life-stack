import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { aggregateVoteStats,
  sortStatements,
  type ResonanceSortMode,
  EmptyState,
  ModuleToolbar,
  ItemMetaRow,
  ItemPreview,
  ItemPreviewSkeleton,
  ItemTypeBadge,
  renderTypeFooter,
  useCurrentUser,
  useItemGroupColorResolver,
  useSharedFilter,
  useMembers,
  useModulePanel,
  useRelationRecords,
  useItemFocus,
  type ModuleViewProps,
  useResolvedUsers,
  useVerifiedRelationRecords,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@real-life-stack/toolkit"
import { ArrowUpDown, MessageSquareQuote } from "lucide-react"
import { VOTE_PREDICATE, type User } from "@real-life-stack/data-interface"


const SORT_LABELS: Record<ResonanceSortMode, string> = {
  newest: "Neueste",
  votes: "Stimmen",
  approval: "Zustimmung",
  activity: "Aktivität",
}

const SORT_MODES: readonly ResonanceSortMode[] = ["newest", "votes", "approval", "activity"]

/**
 * Resonance module: statements the group positions itself on with a
 * green/yellow/red vote. Spec: docs/spec/modules/resonance.md.
 */
export function ResonanceView({ groupId, items: statements = [], itemsLoading: isLoading = false }: Pick<ModuleViewProps, "groupId" | "items" | "itemsLoading">) {
  // Die Aussagen laedt der Host aus `presents: ["statement"]`: Klassen mit
  // der Affordanz `votesOn` (Spec 06, „Klassen haben IRIs"; Spec 01, Der
  // Ladevertrag) — nicht mehr ueber das Schema im `@context`.
  // All votes of the scope in one query — the per-statement sort keys (count,
  // approval, last activity) need the full picture, not per-card subscriptions.
  const { data: voteRecords } = useRelationRecords({ predicate: VOTE_PREDICATE })
  // Spec 08 L1: authorial aggregates count only records the connector vouches
  // for — fail closed, also for the sort keys.
  const verifiedVoteRecords = useVerifiedRelationRecords(voteRecords)
  const { data: members } = useMembers(groupId === "__overview__" ? null : groupId)
  const { data: currentUser } = useCurrentUser()
  const modulePanel = useModulePanel()
  const resolveGroupColor = useItemGroupColorResolver(groupId === "__overview__" ? undefined : groupId)
  const { itemId: focusedId, focusItem } = useItemFocus()

  // Author resolution: members first, then the connector cascade (contacts),
  // never a raw DID if avoidable — same approach as the feed.
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const unknownAuthorIds = useMemo(
    () => [...new Set(statements.map(({ createdBy }) => createdBy))].filter((id) => !memberMap.has(id) && id !== currentUser?.id),
    [statements, memberMap, currentUser],
  )
  const resolvedAuthors = useResolvedUsers(unknownAuthorIds)
  const resolveAuthor = useCallback(
    (createdBy: string): User | undefined =>
      memberMap.get(createdBy) ?? (currentUser?.id === createdBy ? currentUser : undefined) ?? resolvedAuthors.get(createdBy),
    [memberMap, currentUser, resolvedAuthors],
  )

  // Filter und Suche kommen aus dem Kopf der Modulflaeche (geteilt), die
  // Sortierung gehoert diesem Modul.
  const { value: filterBarValue, searchText } = useSharedFilter()
  const [sortMode, setSortMode] = useState<ResonanceSortMode>("newest")
  // Suche, Tags und Typen hat der Host schon angewendet.
  const filteredStatements = statements
  const voteStats = useMemo(() => aggregateVoteStats(verifiedVoteRecords), [verifiedVoteRecords])
  const sortedStatements = useMemo(
    () => sortStatements(filteredStatements, voteStats, sortMode),
    [filteredStatements, voteStats, sortMode],
  )
  const filterActive =
    searchText.trim() !== "" || filterBarValue.tags.length > 0 || filterBarValue.types.length > 0

  // Reveal: scroll the focused card into view (same pattern as the feed).
  const revealedIdRef = useRef<string | null>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  useEffect(() => {
    if (!focusedId) {
      revealedIdRef.current = null
      return
    }
    if (revealedIdRef.current === focusedId) return
    const el = itemRefs.current.get(focusedId)
    if (!el) return
    revealedIdRef.current = focusedId
    el.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [focusedId, sortedStatements])

  return (
    <div className="space-y-4">
      {/* Die Sortierung steht rechts: Links neben dem Filter-Knopf sitzt die
          Suche, die alle Module teilen. */}
      <ModuleToolbar
        trailingActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <ArrowUpDown className="h-3.5 w-3.5" />
                {SORT_LABELS[sortMode]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={sortMode} onValueChange={(value) => setSortMode(value as ResonanceSortMode)}>
                {SORT_MODES.map((mode) => (
                  <DropdownMenuRadioItem key={mode} value={mode}>
                    {SORT_LABELS[mode]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ItemPreviewSkeleton key={`skeleton-${i}`} />)
        ) : sortedStatements.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={filterActive ? "Keine Treffer" : "Noch keine Aussagen"}
            description={
              filterActive
                ? "Passe die Filter an."
                : "Bring die erste Aussage ein und finde heraus, was in der Gruppe Resonanz findet."
            }
          />
        ) : (
          sortedStatements.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el)
                else itemRefs.current.delete(item.id)
              }}
            >
              <ItemPreview
                item={item}
                author={resolveAuthor(item.createdBy)}
                active={modulePanel.current?.itemId === item.id}
                activeColor={resolveGroupColor(item)}
                onClick={() => focusItem(item.id)}
                headerAdornment={<ItemTypeBadge type={item.type} />}
                metaAdornment={<ItemMetaRow item={item} />}
                footerAdornment={renderTypeFooter(item)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
