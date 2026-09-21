import { useMemo, useState } from "react"
import {
  CollectionView as ToolkitCollectionView,
  CollectionLayoutToggle,
  ModuleToolbar,
  useModuleFilteredItems,
  useItemFocus,
  useModulePanel,
  type CollectionLayout,
  type ModuleViewProps,
} from "@real-life-stack/toolkit"
import { isAggregateVisibleItemType, type Item } from "@real-life-stack/data-interface"

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
  items: allItems = [],
  selectionFocusVisibleArea,
}: Pick<ModuleViewProps, "items" | "selectionFocusVisibleArea">) {
  // Die Liste aggregiert: der Host laedt ungefiltert (kein `presents`).
  const alleEintraege = useMemo(() => selectCollectionItems(allItems), [allItems])
  // Die Liste filtert jetzt mit: Vorher zeigte sie alles, waehrend Feed und
  // Kanban daneben gefiltert waren — dieselbe Auswahl, zwei Ergebnisse.
  const items = useModuleFilteredItems(alleEintraege)
  // Die Dichte gehoert dem Modul, ihr Umschalter aber in den Kopf der Flaeche
  // (Spec 01, Regel 2) — deshalb haelt sie hier und nicht in der Lens.
  const [layout, setLayout] = useState<CollectionLayout>("list")
  const { itemId: focusedId, focusItem } = useItemFocus()
  const modulePanel = useModulePanel()

  return <>
    <ModuleToolbar
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
  </>
}
