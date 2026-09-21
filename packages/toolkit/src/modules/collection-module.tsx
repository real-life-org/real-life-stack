"use client"

import { useItemFocus } from "../hooks/use-item-focus"
import { useModuleHost } from "../components/host/module-host"
import { CollectionView } from "../components/lens/collection-view"
import type { ModuleViewProps } from "../lib/module-register"

/**
 * Das Sammlungs-Modul, vollstaendig aus dem Toolkit (Spec 01, Der Modul-Host;
 * B2, 21.09.2026 — bis dahin `CollectionView` in der Referenz-App). Der Host
 * liefert die Items gefiltert und — weil die Liste aggregiert (kein
 * `presents`) — auf das begrenzt, was als eigene Karte steht. Die Ansicht
 * haelt die Dichte (Liste/Raster) selbst, ihr Umschalter steht im Kopf der
 * Flaeche (Spec 01, Regel 2). Detail, Erstellen und Plusknopf stellt der Host.
 */
export function CollectionModule({ items = [], selectionFocusVisibleArea }: ModuleViewProps) {
  const { activeItemId } = useModuleHost()
  const { focusItem } = useItemFocus()

  return (
    <CollectionView
      className="h-full"
      items={items}
      activeItemId={activeItemId}
      selectionFocusVisibleArea={selectionFocusVisibleArea}
      onItemClick={(item) => focusItem(item.id)}
    />
  )
}
