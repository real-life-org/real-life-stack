"use client"

import { useMemo, useState } from "react"
import { ArrowUpDown, MessageSquareQuote } from "lucide-react"
import { VOTE_PREDICATE } from "@real-life-stack/data-interface"

import { useItemFocus } from "../hooks/use-item-focus"
import { useRelationRecords } from "../hooks/use-relation-records"
import { useVerifiedRelationRecords } from "../hooks/use-votes"
import { useModuleHost } from "../components/host/module-host"
import { ModuleToolbar } from "../components/layout/module-toolbar"
import { ItemMetaRow } from "../components/preview/item-meta-row"
import { ItemPreview } from "../components/preview/item-preview"
import { ItemPreviewSkeleton } from "../components/preview/item-preview-skeleton"
import { ItemTypeBadge } from "../components/preview/item-type-badge"
import { renderTypeFooter } from "../components/preview/type-presentation"
import { Button } from "../components/primitives/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../components/primitives/dropdown-menu"
import { EmptyState } from "../components/primitives/empty-state"
import { aggregateVoteStats, sortStatements, type ResonanceSortMode } from "../lib/resonance-sort"
import type { ModuleViewProps } from "../lib/module-register"

const SORT_LABELS: Record<ResonanceSortMode, string> = {
  newest: "Neueste",
  votes: "Stimmen",
  approval: "Zustimmung",
  activity: "Aktivität",
}

const SORT_MODES: readonly ResonanceSortMode[] = ["newest", "votes", "approval", "activity"]

/**
 * Das Resonanz-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host;
 * B4, 21.09.2026 — bis dahin `ResonanceView` in der Referenz-App): Aussagen,
 * zu denen sich die Gruppe mit gruen, gelb oder rot stellt. Spec:
 * docs/spec/modules/resonance.md.
 *
 * Die Aussagen laedt der Host aus `presents: ["statement"]` — Klassen mit der
 * Affordanz `votesOn` (Spec 06) —, gefiltert nach Suche, Tags und Typen.
 * Dem Modul gehoert die Sortierung; ihr Umschalter steht im Kopf neben der
 * Suche. Autor, aktives Item, leerer Zustand und Scrollen zur fokussierten
 * Karte kommen vom Host; Detail, Erstellen und Plusknopf stellt er.
 */
export function ResonanceModule({ items: statements = [], itemsLoading: isLoading = false }: ModuleViewProps) {
  // Alle Stimmen des Space in einer Abfrage — die Sortierschluessel je
  // Aussage (Anzahl, Zustimmung, letzte Aktivitaet) brauchen das ganze Bild.
  const { data: voteRecords } = useRelationRecords({ predicate: VOTE_PREDICATE })
  // Spec 08 L1: Zaehlen nur Records, fuer die der Connector buergt — fail
  // closed, auch fuer die Sortierung.
  const verifiedVoteRecords = useVerifiedRelationRecords(voteRecords)
  const { resolveAuthor, resolveItemGroupColor, activeItemId, filterActive, registerItemElement } = useModuleHost()
  const { focusItem } = useItemFocus()

  const [sortMode, setSortMode] = useState<ResonanceSortMode>("newest")
  const voteStats = useMemo(() => aggregateVoteStats(verifiedVoteRecords), [verifiedVoteRecords])
  const sortedStatements = useMemo(
    () => sortStatements(statements, voteStats, sortMode),
    [statements, voteStats, sortMode],
  )

  return (
    <div className="space-y-4">
      {/* Die Sortierung steht rechts neben der Suche, die alle Module teilen. */}
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
            <div key={item.id} ref={(el) => registerItemElement(item.id, el)}>
              <ItemPreview
                item={item}
                author={resolveAuthor(item.createdBy)}
                active={activeItemId === item.id}
                activeColor={resolveItemGroupColor(item)}
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
