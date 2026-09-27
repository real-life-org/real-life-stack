"use client"

import type { Item } from "@real-life-stack/data-interface"
import { X } from "lucide-react"

import { useOptionalItemFocus } from "../../hooks/use-item-focus"
import { cn } from "../../lib/utils"
import { doneValue } from "./field-register"
import { GENERIC_BADGE, resolveTypePresentation } from "./type-presentation"

/**
 * Chip für ein Item-Ziel (C3 `item-relation`, B15 `item-ref`).
 *
 * Spec: shared-components → „Item-Detail aus dem Register", Detail-Anatomie
 * Regel 4 (Chip in der Farbe seines Typs, Klick öffnet das Ziel in derselben
 * Panel-Instanz), Widget-Paare C3 (erledigte Ziele durchgestrichen) und B15.
 *
 * Farbe und Icon kommen aus dem Typ-Badge des ZIELS; ob es erledigt ist, sagt
 * der Erledigt-Wert seines Status-Felds (06, Regel 18) — keine Verzweigung
 * über den Typ.
 */

const titleOf = (item: Item): string => {
  const data = (item.data ?? {}) as Record<string, unknown>
  const title = data.title ?? data.displayName ?? data.content
  return typeof title === "string" && title.trim() !== "" ? title : "Ohne Titel"
}

/** Ist das Item erledigt? Der Erledigt-Wert seines Status-Felds aus dem Register. */
export function isItemDone(item: Item): boolean {
  const presentation = resolveTypePresentation(item.type)
  for (const field of presentation.fields ?? []) {
    if (field.widget !== "status") continue
    const done = doneValue(field)
    if (done !== undefined && (item.data as Record<string, unknown> | undefined)?.[field.key] === done) return true
  }
  return false
}

const CHIP = "inline-flex max-w-[16rem] min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"

export interface ItemRefChipProps {
  item: Item
  /** Qualifier klein hinter dem Chip (08, Qualifier an Kanten, Regel 6). */
  qualifier?: string
  /** Schreibform: ✕ zum Entfernen. */
  onRemove?: () => void
  /** Nicht klickbar (feste Anzeige im Formular, Messzeile). */
  inert?: boolean
  className?: string
}

export function ItemRefChip({ item, qualifier, onRemove, inert, className }: ItemRefChipProps) {
  const focus = useOptionalItemFocus()
  const presentation = resolveTypePresentation(item.type)
  const badge = presentation.badge ?? GENERIC_BADGE
  const Icon = badge.icon
  const done = isItemDone(item)
  const title = titleOf(item)
  const body = (
    <>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      <span className={cn("truncate", done && "line-through")}>{title}</span>
      {done && <span className="sr-only"> (erledigt)</span>}
    </>
  )
  const open = !inert && focus ? () => focus.focusItem(item.id) : null
  return (
    <span data-item-ref={inert ? undefined : item.id} className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      {open ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            open()
          }}
          title={title}
          className={cn(CHIP, badge.className, done && "opacity-60", "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40")}
        >
          {body}
        </button>
      ) : (
        <span title={title} className={cn(CHIP, badge.className, done && "opacity-60")}>
          {body}
          {onRemove && (
            <button
              type="button"
              aria-label={`${title} entfernen`}
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
              className="-mr-0.5 ml-0.5 rounded-full p-0.5 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </span>
      )}
      {qualifier && <span className="text-[11px] text-muted-foreground">{qualifier}</span>}
    </span>
  )
}

/** Ein Ziel, das sich nicht auflösen lässt: Text, nie ein Fehler (06, Regel 11). */
export function MissingRefText({ text }: { text: string }) {
  return (
    <span data-item-ref-missing className="text-xs italic text-muted-foreground">
      {text}
    </span>
  )
}
