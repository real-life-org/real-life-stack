"use client"

import { useMemo, useState } from "react"
import { ArrowUpDown, MessageSquareQuote } from "lucide-react"
import { VOTE_PREDICATE } from "@real-life-stack/data-interface"

import { useItemFocus } from "../hooks/use-item-focus"
import { useRelationRecords } from "../hooks/use-relation-records"
import { useVerifiedRelationRecords } from "../hooks/use-votes"
import { useCountingContentHashes } from "../hooks/use-item-standing"
import { ResonancePopulationProvider } from "../hooks/use-resonance-population"
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
import { FilterChip, FilterMultiSelect, FilterSection, FilterToggle } from "../components/filter/filter-building-blocks"
import {
  ALL_PEOPLE,
  aggregateVoteStats,
  sortStatements,
  type ResonancePopulation,
  type ResonanceSortMode,
} from "../lib/resonance-sort"
import type { ModuleViewProps } from "../lib/module-register"

const SORT_LABELS: Record<ResonanceSortMode, string> = {
  newest: "Neueste",
  votes: "Stimmen",
  approval: "Zustimmung",
  concerns: "Bedenken",
  rejection: "Ablehnung",
  participation: "Beteiligung",
  activity: "Aktivität",
}

const SORT_MODES: readonly ResonanceSortMode[] = ["newest", "votes", "approval", "concerns", "rejection", "participation", "activity"]

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
  const { resolveAuthor, resolveItemGroupColor, activeItemId, filterActive, registerItemElement, members, isOverview } = useModuleHost()
  const { focusItem } = useItemFocus()

  const [sortMode, setSortMode] = useState<ResonanceSortMode>("newest")
  // Auswertung (resonance.md): Personenmenge und Personen-Filter. Nur lokal —
  // nichts davon wird geschrieben oder geteilt.
  const [chosenPeople, setChosenPeople] = useState<string[]>([])
  const [votersOnly, setVotersOnly] = useState(false)
  const [greenBy, setGreenBy] = useState<string[]>([])

  // Resonanz-Vote-Regel 5: eine Stimme zaehlt nur fuer den aktuellen Wortlaut
  // eines belegten Statements.
  const contentHashes = useCountingContentHashes(statements)
  // Ungefiltert: wer wie gestimmt hat — Grundlage fuer „nur wer abgestimmt
  // hat" und „was traegt X gruen".
  const allStats = useMemo(() => aggregateVoteStats(verifiedVoteRecords, contentHashes), [verifiedVoteRecords, contentHashes])

  // „Was traegt X gruen": nur Aussagen, die alle gewaehlten Personen gruen tragen.
  const shownStatements = useMemo(
    () => greenBy.length === 0
      ? statements
      : statements.filter((item) => greenBy.every((id) => allStats.get(item.id)?.voters?.get(id) === "green")),
    [statements, greenBy, allStats],
  )

  // Personenmenge: Standard alle Mitglieder des Space, bearbeitbar ueber
  // Einzelauswahl und „nur wer abgestimmt hat". In der Uebersicht gibt es
  // keinen Space, dessen Mitglieder die Menge waeren (die Mitgliederliste ist
  // dort die Vereinigung aller Spaces) — ohne eigene Auswahl also keine
  // Einschraenkung und kein „ohne Stimme". Ebenso ohne Mitgliederliste.
  const population = useMemo<ResonancePopulation>(() => {
    const base = chosenPeople.length > 0
      ? chosenPeople
      : isOverview || members.length === 0 ? null : members.map((member) => member.id)
    if (!votersOnly) return base === null ? ALL_PEOPLE : { people: new Set(base), size: base.length }
    const voted = new Set<string>()
    for (const item of shownStatements) for (const id of allStats.get(item.id)?.voters?.keys() ?? []) voted.add(id)
    const people = base === null ? voted : new Set(base.filter((id) => voted.has(id)))
    return { people, size: people.size }
  }, [chosenPeople, isOverview, members, votersOnly, shownStatements, allStats])

  const voteStats = useMemo(
    () => aggregateVoteStats(verifiedVoteRecords, contentHashes, population.people),
    [verifiedVoteRecords, contentHashes, population],
  )
  const sortedStatements = useMemo(
    () => sortStatements(shownStatements, voteStats, sortMode, population),
    [shownStatements, voteStats, sortMode, population],
  )

  const memberOptions = useMemo(
    () => members.map((member) => ({ id: member.id, label: member.displayName ?? member.id })),
    [members],
  )
  const nameOf = (id: string) => memberOptions.find((option) => option.id === id)?.label ?? id
  const moduleFilterActive = chosenPeople.length > 0 || votersOnly || greenBy.length > 0
  const chips = moduleFilterActive ? (
    <>
      {chosenPeople.length > 0 && (
        <FilterChip
          label={chosenPeople.length === 1 ? `Person: ${nameOf(chosenPeople[0]!)}` : `${chosenPeople.length} Personen`}
          onRemove={() => setChosenPeople([])}
        />
      )}
      {votersOnly && <FilterChip label="Nur wer abgestimmt hat" onRemove={() => setVotersOnly(false)} />}
      {greenBy.length > 0 && (
        <FilterChip label={`Trägt grün: ${greenBy.map(nameOf).join(", ")}`} onRemove={() => setGreenBy([])} />
      )}
    </>
  ) : undefined

  return (
    <div className="space-y-4">
      {/* Die Sortierung steht rechts neben der Suche, die alle Module teilen. */}
      <ModuleToolbar
        drawerExtra={
          <>
            {memberOptions.length > 0 && (
              <FilterSection label="Personen">
                <FilterMultiSelect options={memberOptions} value={chosenPeople} onChange={setChosenPeople} />
                <FilterToggle label="Nur wer abgestimmt hat" value={votersOnly} onChange={setVotersOnly} />
              </FilterSection>
            )}
            {memberOptions.length > 0 && (
              <FilterSection label="Trägt grün">
                <FilterMultiSelect options={memberOptions} value={greenBy} onChange={setGreenBy} />
              </FilterSection>
            )}
          </>
        }
        chipsExtra={chips}
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

      <ResonancePopulationProvider value={population}>
      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <ItemPreviewSkeleton key={`skeleton-${i}`} />)
        ) : sortedStatements.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title={filterActive || moduleFilterActive ? "Keine Treffer" : "Noch keine Aussagen"}
            description={
              filterActive || moduleFilterActive
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
      </ResonancePopulationProvider>
    </div>
  )
}
