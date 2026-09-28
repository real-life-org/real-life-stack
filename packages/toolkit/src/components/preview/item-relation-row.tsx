"use client"

import { useState, type ReactNode } from "react"
import type { Item } from "@real-life-stack/data-interface"

import { useItem } from "../../hooks/use-items"
import { cn } from "../../lib/utils"
import type { FieldEntry } from "./field-register"
import { ItemRefChip, MissingRefText } from "./item-ref-chip"
import { hasItemGroups } from "@real-life-stack/data-interface"
import { useConnector } from "../../hooks/connector-context"
import type { EdgeTarget } from "./use-item-edges"
import { targetItemId, targetPointsTo } from "../../lib/item-targets"
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
  // Mindestens ein Chip: Er kürzt seinen Titel, statt ganz hinter „+N" zu verschwinden.
  const shown = all ? targets.length : Math.min(Math.max(visible, 1), targets.length)
  const hidden = targets.length - shown
  return (
    // Gekappt in einer Zeile (der erste Chip kürzt seinen Titel); aufgeklappt umbrechend.
    <div ref={rowRef} className={cn("relative flex min-w-0 flex-1 items-center gap-1.5", all ? "flex-wrap" : "flex-nowrap")}>
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
          className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
  const value = (item.data as Record<string, unknown>)[field.key] as string
  return <ResolvedRef carrier={item} value={value} id={id} missing={field.ref?.missing ?? "nicht verfügbar"} />
}

function ResolvedRef({ carrier, value, id, missing }: { carrier: Item; value: string; id: string; missing: string }) {
  const connector = useConnector()
  const { data: target, isLoading } = useItem(id)
  // Space-lokal (04): Das Ziel muss dort liegen, wohin das Target zeigt.
  const spaceOf = hasItemGroups(connector) ? (x: string) => connector.getItemGroupId(x) : undefined
  if (target && targetPointsTo(value, target, { carrierSpace: spaceOf ? spaceOf(carrier.id) : null, spaceOf })) return <ItemRefChip item={target} />
  if (!target && isLoading) return null
  return <MissingRefText text={missing} />
}
