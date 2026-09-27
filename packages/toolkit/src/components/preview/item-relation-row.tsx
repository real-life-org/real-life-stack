"use client"

import { useState, type ReactNode } from "react"
import type { Item } from "@real-life-stack/data-interface"

import { useItem } from "../../hooks/use-items"
import type { FieldEntry } from "./field-register"
import { ItemRefChip, MissingRefText } from "./item-ref-chip"
import { targetItemId, type EdgeTarget } from "./use-item-edges"
import { useFittingTags } from "./use-fitting-tags"

/**
 * Leseform einer Item-Kante (C3): Label aus dem Register, Chips in Typfarbe,
 * gekappt „+N" nach Platz (wie die Tags der Karte, S1). „+N" ist ein Knopf,
 * der alle zeigt.
 *
 * Spec: shared-components → „Item-Detail aus dem Register", Widget-Paare C3;
 * Detail-Anatomie, Regel 4.
 */
export function ItemRelationChips({ targets }: { targets: readonly EdgeTarget[] }) {
  const [all, setAll] = useState(false)
  const keys = targets.map((t) => t.item.id)
  // Ohne Messung (Server, jsdom) drei, dann „+N".
  const { visible, measuring, rowRef, measureRef } = useFittingTags(keys, 3, 0)
  const shown = all ? targets.length : Math.min(visible, targets.length)
  const hidden = targets.length - shown
  return (
    <div ref={rowRef} className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {targets.slice(0, shown).map((t) => (
        <ItemRefChip key={t.item.id} item={t.item} qualifier={t.qualifier} />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          data-more={hidden}
          aria-label={`${hidden} weitere zeigen`}
          onClick={(event) => {
            event.stopPropagation()
            setAll(true)
          }}
          className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          +{hidden}
        </button>
      )}
      {measuring && !all && (
        // Unsichtbare Messzeile: alle Chips und ein „+N"-Muster (use-fitting-tags).
        <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-1.5 whitespace-nowrap">
          {targets.map((t) => (
            <span key={t.item.id} data-measure="tag-chip">
              <ItemRefChip item={t.item} qualifier={t.qualifier} inert />
            </span>
          ))}
          <span data-measure="tag-plus" className="rounded-full border px-2 py-0.5 text-xs">+{targets.length}</span>
        </div>
      )}
    </div>
  )
}

/** Eine Meta-Zeile mit Label vor den Chips (Design: „Ermöglicht  [Beetplan …]"). */
export function LabeledChips({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {label && <span className="shrink-0 text-xs text-muted-foreground">{label}</span>}
      {children}
    </div>
  )
}

/** Der Wert eines item-ref-Felds als Item-Id, oder null. */
export function itemRefId(item: Item, field: FieldEntry): string | null {
  const value = (item.data as Record<string, unknown> | undefined)?.[field.key]
  return typeof value === "string" && value !== "" ? targetItemId(value) ?? null : null
}

/**
 * Leseform eines Felds mit Item-Verweis (B15): Chip in der Farbe des Ziels
 * oder, wenn es sich nicht auflösen lässt, `ref.missing` als Text (06,
 * Regel 11). `null` ohne Wert.
 */
export function ItemRefValue({ item, field }: { item: Item; field: FieldEntry }) {
  const id = itemRefId(item, field)
  if (!id) return null
  return <ResolvedRef id={id} missing={field.ref?.missing ?? "nicht verfügbar"} />
}

function ResolvedRef({ id, missing }: { id: string; missing: string }) {
  const { data: target, isLoading } = useItem(id)
  if (target) return <ItemRefChip item={target} />
  if (isLoading) return null
  return <MissingRefText text={missing} />
}
