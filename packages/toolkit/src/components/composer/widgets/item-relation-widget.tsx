"use client"

import { useEffect, useId, useMemo, useState, startTransition } from "react"
import { hasItemGroups, type DataInterface, type Item } from "@real-life-stack/data-interface"
import { Lock, MousePointerClick } from "lucide-react"

import { useOptionalConnector } from "../../../hooks/connector-context"
import { cn } from "../../../lib/utils"
import { ItemRefChip, MissingRefText } from "../../preview/item-ref-chip"
import { targetFilter, targetItemId, targetPointsTo } from "../../preview/use-item-edges"
import { itemTitle } from "../item-relations"

/**
 * Schreibform einer Item-Kante (C3): Chips mit ✕ und eine Suche
 * „@ … suchen" über die Items des Space vom Typ der Gegenstelle.
 *
 * Spec: shared-components → „Item-Detail aus dem Register", Widget-Paare C3,
 * Edit-Regeln 7. Der zweite Weg, der Modul-Pick (Brett-Klick, Marker-Klick),
 * liefert das Modul über `requestItemPick`; ohne ihn gibt es keinen Knopf.
 */

/** Einsprung für den Modul-Pick (Edit-Regeln 7): das Modul ruft `onPick` mit der Item-Id. */
export type RequestItemPick = (request: { predicate: string; targetType?: string }, onPick: (itemId: string) => void) => void

/**
 * Die Items der Gegenstelle, ohne Provider leer. Nur der Space des Formulars:
 * Ein `item:`-Target ist space-lokal (04), ein Item aus einem anderen Space
 * wäre dort ein anderes oder keins.
 */
function useCandidates(targetType: string | undefined, spaceId: string | undefined): { items: Item[]; needsSpace: boolean; spaceOf?: (id: string) => string | null } {
  const connector = useOptionalConnector()
  const filterKey = JSON.stringify(targetFilter(targetType))
  const observable = useMemo(
    () => (connector ? connector.observe(JSON.parse(filterKey)) : null),
    [connector, filterKey],
  )
  const [items, setItems] = useState<readonly Item[]>(observable?.current ?? [])
  useEffect(() => {
    if (!observable) return
    setItems(observable.current)
    return observable.subscribe((next) => startTransition(() => setItems(next)))
  }, [observable])
  return useMemo(() => inSpace(connector, items, spaceId), [connector, items, spaceId])
}

/**
 * Mit Spaces nur die Items des Formular-Space; ohne gewählten Space keine —
 * ein `item:`-Target aus der Übersicht wäre in einem anderen Space falsch.
 */
function inSpace(connector: DataInterface | null, items: readonly Item[], spaceId: string | undefined) {
  if (!connector || !hasItemGroups(connector)) return { items: [...items], needsSpace: false }
  const spaceOf = (id: string) => connector.getItemGroupId(id)
  if (!spaceId) return { items: [], needsSpace: true, spaceOf }
  return { items: items.filter((item) => spaceOf(item.id) === spaceId), needsSpace: false, spaceOf }
}

export interface ItemRelationWidgetProps {
  label: string
  /** Targets (`item:<id>`), in Reihenfolge. */
  value: readonly string[]
  onChange: (next: string[]) => void
  predicate: string
  targetType?: string
  placeholder?: string
  /** Das bearbeitete Item: nie sein eigenes Ziel. */
  excludeId?: string
  /** Space des Formulars (Kopf). */
  spaceId?: string
  /** Höchstens ein Ziel (Feld mit Item-Verweis). */
  single?: boolean
  requestItemPick?: RequestItemPick
}

export function ItemRelationWidget({
  label,
  value,
  onChange,
  predicate,
  targetType,
  placeholder,
  excludeId,
  spaceId,
  single,
  requestItemPick,
}: ItemRelationWidgetProps) {
  const { items: candidates, needsSpace, spaceOf } = useCandidates(targetType, spaceId)
  const resolve = (target: string) => candidates.find((c) => targetPointsTo(target, c, spaceId ?? null, spaceOf))
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const listId = useId()

  const isChosen = (c: Item) => value.some((t) => targetPointsTo(t, c, spaceId ?? null, spaceOf))
  const needle = query.replace(/^@/, "").trim().toLocaleLowerCase("de")
  const suggestions = open
    ? candidates
        .filter((c) => c.id !== excludeId && !isChosen(c))
        .filter((c) => needle === "" || itemTitle(c).toLocaleLowerCase("de").includes(needle))
        .slice(0, 6)
    : []

  const add = (id: string) => {
    const target = `item:${id}`
    onChange(single ? [target] : value.includes(target) ? [...value] : [...value, target])
    setQuery("")
    setOpen(false)
  }
  const remove = (target: string) => onChange(value.filter((t) => t !== target))
  const full = single && value.length > 0

  return (
    <div className="flex flex-col gap-1.5" data-item-relation-field={predicate}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
          {value.map((target) => {
            const id = targetItemId(target)
            const item = resolve(target)
            return (
              <span key={target} data-relation-chip={id ?? target} className="inline-flex">
                {item ? (
                  <ItemRefChip item={item} inert onRemove={() => remove(target)} />
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5">
                    <MissingRefText text="nicht verfügbar" />
                    <button type="button" aria-label="Nicht verfügbares Ziel entfernen" onClick={() => remove(target)} className="text-xs text-muted-foreground hover:text-foreground">
                      ✕
                    </button>
                  </span>
                )}
              </span>
            )
          })}
          {!full && needsSpace && (
            <span data-needs-space className="text-sm text-muted-foreground">Erst einen Space wählen</span>
          )}
          {!full && !needsSpace && (
            <input
              type="text"
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls={listId}
              aria-label={label}
              value={query}
              placeholder={placeholder ?? "@ suchen…"}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onChange={(event) => {
                setQuery(event.target.value)
                setOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  if (suggestions[0]) add(suggestions[0].id)
                } else if (event.key === "Escape") {
                  setQuery("")
                  setOpen(false)
                } else if (event.key === "Backspace" && query === "" && value.length > 0) {
                  remove(value[value.length - 1]!)
                }
              }}
              className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
          {requestItemPick && !full && !needsSpace && (
            <button
              type="button"
              onClick={() => requestItemPick({ predicate, targetType }, add)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
              Im Modul wählen
            </button>
          )}
        </div>
        {suggestions.length > 0 && (
          <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border bg-popover p-1 shadow-md">
            {suggestions.map((c) => (
              <li key={c.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  // mousedown statt click: Der Blur des Felds schlösse die Liste sonst vorher.
                  onMouseDown={(event) => {
                    event.preventDefault()
                    add(c.id)
                  }}
                  onClick={() => add(c.id)}
                  className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <ItemRefChip item={c} inert />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * Feste Anzeige eines Felds mit Item-Verweis im Formular (06, Regel 14;
 * Edit-Regeln 9): sichtbar, nicht bearbeitbar, mit Schloss.
 */
export function FixedItemRefField({ label, value, missing }: { label: string; value: string; missing: string }) {
  const connector = useOptionalConnector()
  const id = targetItemId(value)
  const [item, setItem] = useState<Item | null>(null)
  useEffect(() => {
    if (!connector || !id) return
    const observable = connector.observeItem(id)
    setItem(observable.current)
    return observable.subscribe((next) => setItem(next))
  }, [connector, id])
  return (
    <div className="flex flex-col gap-1.5" data-fixed-ref>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className={cn("flex min-h-10 items-center justify-between gap-2 rounded-md border bg-muted/50 px-2 py-1.5")}>
        {item ? <ItemRefChip item={item} inert /> : <MissingRefText text={missing} />}
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="nicht änderbar" />
      </div>
    </div>
  )
}
