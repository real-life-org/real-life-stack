"use client"

import { useMemo } from "react"
import { isAggregateVisibleItemType, type Item } from "@real-life-stack/data-interface"

import { useModuleFilteredItems } from "../hooks/use-filterable-items"
import { useItemFocus } from "../hooks/use-item-focus"
import { CollectionView } from "../components/lens/collection-view"
import { useModulePanel } from "../components/module-panel/module-panel"
import type { ModuleViewProps } from "../lib/module-register"

/**
 * Die Liste ist eine aggregierende Flaeche wie Feed und Suche und fragt
 * darum dieselbe Regel: `isAggregateVisibleItemType`, statt Typen aufzuzaehlen
 * (Spec 06 → Modul-Konsequenzen). Ohne diesen Filter standen hier
 * Kommentare, Reaktionen und Relationen als eigene Eintraege — Dinge, die
 * ueber das Item gelesen werden, zu dem sie gehoeren.
 *
 * Anders als der Feed sortiert die Liste nicht um: Die Reihenfolge kommt
 * aus der Ansicht selbst. Als schlichte Funktion exportiert, damit die Regel
 * ohne Mounten pruefbar ist — wie `selectFeedItems`.
 */
export function selectCollectionItems(items: readonly Item[]): Item[] {
  return items.filter((item) => isAggregateVisibleItemType(item.type))
}

/**
 * Das Sammlungs-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host;
 * B2, 21.09.2026 — bis dahin `CollectionView` in der Referenz-App). Der Host
 * laedt ungefiltert (kein `presents`); die Ansicht filtert mit dem geteilten
 * Zustand mit und haelt die Dichte (Liste/Raster) selbst — ihr Umschalter
 * steht im Kopf der Flaeche (Spec 01, Regel 2). Detail, Erstellen und
 * Plusknopf stellt der Host.
 */
export function CollectionModule({ items = [], selectionFocusVisibleArea }: ModuleViewProps) {
  const alleEintraege = useMemo(() => selectCollectionItems(items), [items])
  // Die Liste filtert mit: Vorher zeigte sie alles, waehrend Feed und Kanban
  // daneben gefiltert waren — dieselbe Auswahl, zwei Ergebnisse.
  const gefiltert = useModuleFilteredItems(alleEintraege)
  const { itemId: focusedId, focusItem } = useItemFocus()
  const panel = useModulePanel()

  return (
    <CollectionView
      className="h-full"
      items={gefiltert}
      activeItemId={panel.current?.itemId ?? focusedId}
      selectionFocusVisibleArea={selectionFocusVisibleArea}
      onItemClick={(item) => focusItem(item.id)}
    />
  )
}
