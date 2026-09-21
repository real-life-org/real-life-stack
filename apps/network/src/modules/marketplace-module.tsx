import { CollectionView, useItemFocus, useModuleHost, type ModuleViewProps } from "@real-life-stack/toolkit"

/**
 * Der Marktplatz: die Ressourcen des Space als Liste. Ein App-eigenes Modul
 * nach dem Muster der Toolkit-Liste — die Items kommen vom Host, gefiltert
 * und auf den Hinweis `resource` begrenzt; Detail, Erstellen (Vorschlag
 * „Ressource") und Plusknopf stellt der Host. Das Modul tut nur, was
 * Marktplatz ist: zeigen und den Blick auf ein Item richten.
 */
export function MarketplaceModule({ items = [], selectionFocusVisibleArea }: ModuleViewProps) {
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
