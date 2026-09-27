"use client"

import { useEffect, useId, useMemo, useRef, useState, startTransition } from "react"
import { hasGroups, hasItemGroups, type DataInterface, type Item } from "@real-life-stack/data-interface"
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

/** Antwort auf einen Modul-Pick: übernommen, oder abgewiesen mit Grund (#530). */
export type ItemPickResult = { ok: true } | { ok: false; reason: string }

/**
 * Einsprung für den Modul-Pick (Edit-Regeln 7): das Modul ruft `onPick` mit
 * der Item-Id. Das Feld prüft das Ziel wie ein Suchergebnis (Typ der
 * Gegenstelle, Space des Formulars, nicht das Item selbst, nicht doppelt) und
 * antwortet; ein abgewiesenes Ziel übernimmt es nicht.
 */
export type RequestItemPick = (request: { predicate: string; targetType?: string }, onPick: (itemId: string) => ItemPickResult) => void

/**
 * Die Items der Gegenstelle, ohne Provider leer. Nur der Space des Formulars:
 * Ein `item:`-Target ist space-lokal (04), ein Item aus einem anderen Space
 * wäre dort ein anderes oder keins.
 */
function useCandidates(targetType: string | undefined, spaceId: string | undefined): { items: Item[]; all: readonly Item[]; needsSpace: boolean; otherSpace: boolean; spaceOf?: (id: string) => string | null } {
  const connector = useOptionalConnector()
  const filterKey = JSON.stringify(targetFilter(targetType))
  // #529: Items liest der Connector im geöffneten Space (Übersicht: alle).
  // Ist das ein anderer als der im Formularkopf, gibt es keine Kandidaten —
  // das Feld sagt es, statt still leer zu bleiben (DataInterface hat keinen
  // Lesezugriff auf einen anderen Space; offen, siehe PR #528).
  const openSpace = connector && hasGroups(connector) ? (connector.getCurrentGroup()?.id ?? null) : null
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
  return useMemo(
    () => ({ ...inSpace(connector, items, spaceId), all: items, otherSpace: !!spaceId && openSpace !== null && openSpace !== spaceId }),
    [connector, items, spaceId, openSpace],
  )
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
  const { items: candidates, all, needsSpace, otherSpace, spaceOf } = useCandidates(targetType, spaceId)
  const connector = useOptionalConnector()
  const groupName = useGroupName(connector, otherSpace ? spaceId : undefined)
  const spaceName = groupName ?? "diesem Space"
  const [pickError, setPickError] = useState<string | null>(null)
  // Gewählte Ziele gegen alle sichtbaren Items (ein space-qualifiziertes
  // bleibt nach einem Space-Wechsel gültig); gesucht wird nur im Formular-Space.
  const resolve = (target: string) => all.find((c) => targetPointsTo(target, c, spaceId ?? null, spaceOf))
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

  // Der Modul-Pick kommt asynchron: geprüft wird gegen den Stand beim Eintreffen.
  const latest = useRef({ candidates, value, excludeId, spaceId, spaceOf, full: false })
  latest.current = { candidates, value, excludeId, spaceId, spaceOf, full: !!single && value.length > 0 }
  const checkPick = (id: string): ItemPickResult => {
    const now = latest.current
    if (now.full) return { ok: false, reason: "Das Feld hat schon ein Ziel" }
    if (id === now.excludeId) return { ok: false, reason: "Ein Item verweist nicht auf sich selbst" }
    const target = now.candidates.find((c) => c.id === id)
    if (!target) {
      return { ok: false, reason: targetType ? "Das Ziel ist nicht vom passenden Typ oder liegt nicht in diesem Space" : "Das Ziel liegt nicht in diesem Space" }
    }
    if (now.value.some((t) => targetPointsTo(t, target, now.spaceId ?? null, now.spaceOf))) return { ok: false, reason: "Das Ziel ist schon gewählt" }
    return { ok: true }
  }
  const onPick = (id: string): ItemPickResult => {
    const result = checkPick(id)
    if (result.ok) {
      setPickError(null)
      add(id)
    } else setPickError(result.reason)
    return result
  }

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
          {!full && otherSpace && (
            <span data-other-space className="text-sm text-muted-foreground">Suche nur im geöffneten Space – zum Verknüpfen in „{spaceName}“ dorthin wechseln</span>
          )}
          {!full && !needsSpace && !otherSpace && (
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
          {requestItemPick && !full && !needsSpace && !otherSpace && (
            <button
              type="button"
              onClick={() => requestItemPick({ predicate, targetType }, onPick)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
              Im Modul wählen
            </button>
          )}
        </div>
        {pickError && (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {pickError}
          </p>
        )}
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
export function FixedItemRefField({ label, value, missing, spaceId }: { label: string; value: string; missing: string; spaceId?: string }) {
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
        {item && fitsSpace(connector, value, item, spaceId) ? <ItemRefChip item={item} inert /> : <MissingRefText text={missing} />}
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="nicht änderbar" />
      </div>
    </div>
  )
}

/** Das Ziel muss dort liegen, wohin das Target zeigt (04); ohne Spaces gibt es nur einen Bereich. */
function fitsSpace(connector: DataInterface | null, value: string, item: Item, spaceId: string | undefined): boolean {
  // Ohne Space-Auskunft: ein lokales Ziel nach Id, ein qualifiziertes nie (nicht prüfbar).
  if (!connector || !hasItemGroups(connector)) return targetPointsTo(value, item, null)
  // Ohne Space im Formular lässt sich ein lokales Ziel nicht gegenprüfen; es
  // stammt dann aus der Vorbelegung (Variante: Space des Ursprungs, fest).
  if (!spaceId && value.startsWith("item:")) return targetItemId(value) === item.id
  return targetPointsTo(value, item, spaceId ?? null, (id) => connector.getItemGroupId(id))
}

/** Name eines Space für den Hinweis; ohne Treffer undefined. */
function useGroupName(connector: DataInterface | null, spaceId: string | undefined): string | undefined {
  const [name, setName] = useState<string | undefined>()
  useEffect(() => {
    if (!connector || !spaceId || !hasGroups(connector)) return
    let alive = true
    void connector.getGroups().then((groups) => {
      if (alive) setName(groups.find((g) => g.id === spaceId)?.name)
    })
    return () => {
      alive = false
    }
  }, [connector, spaceId])
  return name
}
