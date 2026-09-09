import { useState } from "react"
import { Grid2X2, List } from "lucide-react"
import type { Item } from "@real-life-stack/data-interface"

import type { SelectionFocusVisibleArea } from "../../lib/selection-focus"
import { cn } from "../../lib/utils"
import { Button } from "../primitives/button"
import { GridView } from "./grid-view"
import { ListView } from "./list-view"

export type CollectionLayout = "list" | "grid"

/** A density change is a new projection pass for the same selected item. */
export function collectionFocusGateKey(layout: CollectionLayout, activeItemId?: string): string | undefined {
  return activeItemId ? `${layout}:${activeItemId}` : undefined
}

export interface CollectionLayoutToggleProps {
  layout: CollectionLayout
  onChange: (next: CollectionLayout) => void
}

/**
 * Liste oder Raster — als eigene Komponente, damit der Umschalter dort stehen
 * kann, wo die Steuerung eines Moduls hingehoert: im Kopf der Modulflaeche
 * (Spec 01, Regel 2). Die Lens selbst zeigt ihn nur, solange sie ihre Dichte
 * selbst verwaltet.
 */
export function CollectionLayoutToggle({ layout, onChange }: CollectionLayoutToggleProps) {
  return (
    <div role="group" aria-label="Darstellung" className="flex gap-1">
      <Button
        type="button"
        variant={layout === "list" ? "secondary" : "ghost"}
        size="icon"
        aria-label="Listenansicht"
        aria-pressed={layout === "list"}
        onClick={() => onChange("list")}
      >
        <List className="size-4" />
      </Button>
      <Button
        type="button"
        variant={layout === "grid" ? "secondary" : "ghost"}
        size="icon"
        aria-label="Rasteransicht"
        aria-pressed={layout === "grid"}
        onClick={() => onChange("grid")}
      >
        <Grid2X2 className="size-4" />
      </Button>
    </div>
  )
}

export interface CollectionViewProps {
  items: readonly Item[]
  activeItemId?: string
  onItemClick?: (item: Item) => void
  defaultLayout?: CollectionLayout
  /**
   * Gesteuerte Dichte. Gesetzt heisst: Der Aufrufer haelt sie (und zeigt den
   * Umschalter selbst, z.B. im Kopf der Modulflaeche); ohne sie verwaltet die
   * Lens sie wie bisher und zeigt ihre eigene Umschaltzeile.
   */
  layout?: CollectionLayout
  onLayoutChange?: (next: CollectionLayout) => void
  /** Lets an app give this self-scrolling lens the remaining available height. */
  className?: string
  /** Shell-owned obstruction below the scrollable lens, e.g. a mobile drawer. */
  selectionFocusVisibleArea?: SelectionFocusVisibleArea
}

/**
 * List and grid are densities of the same collection projection. The keyed
 * composition intentionally remounts the selected density, re-arming its
 * one-time active-item focus gate after a layout change.
 */
export function CollectionView({
  items,
  activeItemId,
  onItemClick,
  defaultLayout = "list",
  layout: layoutProp,
  onLayoutChange,
  selectionFocusVisibleArea,
  className,
}: CollectionViewProps) {
  const [eigenes, setEigenes] = useState<CollectionLayout>(defaultLayout)
  const gesteuert = layoutProp !== undefined
  const layout = layoutProp ?? eigenes
  const setLayout = (next: CollectionLayout) => {
    if (!gesteuert) setEigenes(next)
    onLayoutChange?.(next)
  }

  return (
    <section aria-label="Sammlungsansicht" className={cn("flex h-full min-h-0 flex-col gap-4", className)}>
      {!gesteuert && (
        <div className="mx-auto flex w-full max-w-6xl justify-end px-4 pt-4 sm:px-6 sm:pt-6">
          <CollectionLayoutToggle layout={layout} onChange={setLayout} />
        </div>
      )}
      <div className="min-h-0 flex-1">
        {layout === "list" ? (
          <ListView
            key={layout}
            items={items}
            activeItemId={activeItemId}
            selectionFocusVisibleArea={selectionFocusVisibleArea}
            selectionFocusGateKey={layout}
            onItemClick={onItemClick}
          />
        ) : (
          <GridView
            key={layout}
            items={items}
            activeItemId={activeItemId}
            selectionFocusVisibleArea={selectionFocusVisibleArea}
            selectionFocusGateKey={layout}
            onItemClick={onItemClick}
          />
        )}
      </div>
    </section>
  )
}
