import { useCallback, useMemo, useState } from "react"
import {
  CollectionView as ToolkitCollectionView,
  CollectionLayoutToggle,
  CreateFab,
  ModuleToolbar,
  ReactionBar,
  resolveTypePresentation,
  useModuleFilteredItems,
  useCurrentUser,
  useGroups,
  useItemGroupColorResolver,
  useItems,
  useMembers,
  useModulePanel,
  usePersonalGroupId,
  type CollectionLayout,
  type FilterTypeOption,
  type SelectionFocusVisibleArea,
} from "@real-life-stack/toolkit"
import { isAggregateVisibleItemType, type Item } from "@real-life-stack/data-interface"
import { useItemFocus } from "../hooks/use-item-focus"
import { useItemDetailEdit } from "../hooks/use-item-detail-edit"
import { ALL_CONTENT_TYPES } from "../content-types"
import { withGroupOptions } from "../composer-mapping"
import { useCreate, useRegisterCreate, type CreateConfig } from "../create-host"
import { useRegisterDetail, type DetailConfig } from "../detail-host"

/** Thin app boundary: collection data, URL focus, and the shared detail host. */
/**
 * Die Liste ist eine aggregierende Flaeche wie Feed und Suche und fragt
 * darum dieselbe Regel: `isAggregateVisibleItemType`, statt Typen aufzuzaehlen
 * (spec 06 → Modul-Konsequenzen). Ohne diesen Filter standen hier
 * Kommentare, Reaktionen und Relationen als eigene Eintraege — Dinge, die
 * ueber das Item gelesen werden, zu dem sie gehoeren.
 *
 * Anders als der Feed sortiert die Liste nicht um: Die Reihenfolge kommt
 * aus der Ansicht selbst.
 *
 * Als schlichte Funktion exportiert, damit die Regel ohne Mounten pruefbar
 * ist — wie `selectFeedItems`.
 */
export function selectCollectionItems(items: readonly Item[]): Item[] {
  return items.filter((item) => isAggregateVisibleItemType(item.type))
}

export function CollectionView({
  groupId,
  selectionFocusVisibleArea,
}: {
  groupId: string
  selectionFocusVisibleArea?: SelectionFocusVisibleArea
}) {
  const { data: allItems } = useItems()
  const alleEintraege = useMemo(() => selectCollectionItems(allItems), [allItems])
  // Die Liste filtert jetzt mit: Vorher zeigte sie alles, waehrend Feed und
  // Kanban daneben gefiltert waren — dieselbe Auswahl, zwei Ergebnisse.
  const items = useModuleFilteredItems(alleEintraege)
  const availableTags = useMemo(() => {
    const seen = new Set<string>()
    for (const item of alleEintraege) for (const tag of item.tags ?? []) seen.add(tag)
    return Array.from(seen).sort()
  }, [alleEintraege])
  const availableTypes = useMemo<FilterTypeOption[]>(() => {
    const present = new Set(alleEintraege.map(({ type }) => type))
    return Array.from(present)
      .map((id) => {
        const presentation = resolveTypePresentation(id)
        // Farbe mitgeben: Der Chip im Filter sieht damit aus wie das Abzeichen
        // auf der Karte, ohne dass die Filter-Schicht das Typ-Register kennt.
        return {
          id,
          label: presentation.label,
          icon: presentation.badge?.icon,
          badgeClassName: presentation.badge?.className,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, "de"))
  }, [alleEintraege])
  // Die Dichte gehoert dem Modul, ihr Umschalter aber in den Kopf der Flaeche
  // (Spec 01, Regel 2) — deshalb haelt sie hier und nicht in der Lens.
  const [layout, setLayout] = useState<CollectionLayout>("list")
  const { data: members } = useMembers(groupId === "__overview__" ? null : groupId)
  const { data: currentUser } = useCurrentUser()
  const { itemId: focusedId, focusItem } = useItemFocus()
  const modulePanel = useModulePanel()
  const resolveGroupColor = useItemGroupColorResolver(groupId === "__overview__" ? undefined : groupId)
  const editConfig = useItemDetailEdit(members)

  const detailConfig = useMemo<DetailConfig>(() => ({
    ...editConfig,
    renderCommentReactions: (id) => <ReactionBar itemId={id} />,
    onShare: () => void navigator.clipboard?.writeText(window.location.href),
  }), [currentUser, editConfig, members, resolveGroupColor])
  useRegisterDetail("collection", detailConfig)

  // The collection shows every item, so create offers the full type registry —
  // the composer's type picker chooses. Unlike the edit half (which pre-fills
  // the group from the item), create must default the group widget to the
  // CURRENT space; the overview falls back to the personal space.
  const { startCreate } = useCreate()
  const { data: groups } = useGroups()
  const personalGroupId = usePersonalGroupId()
  const createTypes = useMemo(
    () => withGroupOptions(ALL_CONTENT_TYPES, groups, groupId === "__overview__" ? undefined : groupId, personalGroupId),
    [groups, groupId, personalGroupId],
  )
  const createConfig = useMemo<CreateConfig>(
    () => ({
      contentTypes: createTypes,
      mapper: editConfig.mapper,
      composerProps: editConfig.composerProps,
      shell: "sheet",
    }),
    [createTypes, editConfig],
  )
  useRegisterCreate("collection", createConfig)
  const handleCreateItem = useCallback(() => startCreate(), [startCreate])

  return <>
    <ModuleToolbar
      availableTags={availableTags}
      availableTypes={availableTypes}
      trailingActions={<CollectionLayoutToggle layout={layout} onChange={setLayout} />}
    />
    <ToolkitCollectionView
      className="h-full"
      layout={layout}
      onLayoutChange={setLayout}
      items={items}
      activeItemId={modulePanel.current?.itemId ?? focusedId}
      selectionFocusVisibleArea={selectionFocusVisibleArea}
      onItemClick={(item) => focusItem(item.id)}
    />
    <CreateFab onClick={handleCreateItem} label="Eintrag erstellen" />
  </>
}
