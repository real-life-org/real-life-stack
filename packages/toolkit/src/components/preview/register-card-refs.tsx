"use client"

import type { Item } from "@real-life-stack/data-interface"

import type { FieldEntry } from "./field-register"
import { ItemRefValue, itemRefId } from "./item-relation-row"

/**
 * Felder mit Item-Verweis auf der Karte (B15): „Variante von [Chip]", auf der
 * Karte immer, auch wenn eine Liste sie im Detail abdeckt (Spec 06, Regel 11;
 * shared-components, Detail-Anatomie Regel 9). `null` ohne Wert.
 */
export function RegisterCardRefs({ item, fields }: { item: Item; fields?: readonly FieldEntry[] }) {
  const refs = (fields ?? []).filter((f) => f.widget === "item-ref" && itemRefId(item, f) !== null)
  if (refs.length === 0) return null
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {refs.map((field) => (
        <div key={field.key} data-card-ref={field.key} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {field.label && <span className="shrink-0">{field.label}</span>}
          <ItemRefValue item={item} field={field} />
        </div>
      ))}
    </div>
  )
}
