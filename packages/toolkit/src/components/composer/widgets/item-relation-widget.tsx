"use client"

import { useEffect, useId, useMemo, useRef, useState, startTransition } from "react"
import { hasGroups, hasGroupScope, hasItemGroups, isAuthenticatable, type DataInterface, type Item } from "@real-life/data-interface"
import { Lock, MousePointerClick } from "lucide-react"

import { useOptionalConnector } from "../../../hooks/connector-context"
import { resolveItemPermissions } from "../../../hooks/use-item-permissions"
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
 *
 * #529: Mit `hasGroupScope()` liest das Feld den Formular-Space direkt
 * (`ItemFilter.group`, 02) — in jedem Space, ohne ihn zu öffnen. Ohne die
 * Zusage liest der Connector im geöffneten Space (Übersicht: alle); ist das
 * ein anderer als der im Formularkopf, sagt das Feld es, statt still leer
 * zu bleiben (Space des Formulars, Regel 7).
 */
export function useCandidates(targetType: string | undefined, spaceId: string | undefined): { items: Item[]; all: readonly Item[]; needsSpace: boolean; otherSpace: boolean; spaceOf?: (id: string) => string | null } {
  const connector = useOptionalConnector()
  const scoped = !!connector && !!spaceId && hasGroupScope(connector)
  const filterKey = JSON.stringify(targetFilter(targetType))
  const scopedKey = scoped ? JSON.stringify({ ...targetFilter(targetType), group: spaceId }) : null
  const openSpace = connector && hasGroups(connector) ? (connector.getCurrentGroup()?.id ?? null) : null
  // Die sichtbaren Items: für gewählte Ziele, die schon anderswohin zeigen
  // (`space:{id}/item:`), und ohne die Zusage für die Suche.
  const observable = useMemo(
    () => (connector ? connector.observe(JSON.parse(filterKey)) : null),
    [connector, filterKey],
  )
  const scopedObservable = useMemo(
    () => (connector && scopedKey ? connector.observe(JSON.parse(scopedKey)) : null),
    [connector, scopedKey],
  )
  const [inScope, setInScope] = useState<readonly Item[]>(scopedObservable?.current ?? [])
  useEffect(() => {
    if (!scopedObservable) {
      setInScope([])
      return
    }
    setInScope(scopedObservable.current)
    return scopedObservable.subscribe((next) => startTransition(() => setInScope(next)))
  }, [scopedObservable])
  const [items, setItems] = useState<readonly Item[]>(observable?.current ?? [])
  useEffect(() => {
    if (!observable) return
    setItems(observable.current)
    return observable.subscribe((next) => startTransition(() => setItems(next)))
  }, [observable])
  return useMemo(() => {
    if (scoped) {
      // Alles, was der Connector mit `group` liefert, liegt in diesem Space —
      // auch wenn `getItemGroupId` eine Id in mehreren Spaces nicht auflöst.
      const ids = new Set(inScope.map((item) => item.id))
      const others = items.filter((item) => !ids.has(item.id))
      const spaceOf = (id: string) => (ids.has(id) ? spaceId ?? null : connector && hasItemGroups(connector) ? connector.getItemGroupId(id) : null)
      return { items: [...inScope], all: [...inScope, ...others], needsSpace: false, otherSpace: false, spaceOf }
    }
    return { ...inSpace(connector, items, spaceId), all: items, otherSpace: !!spaceId && openSpace !== null && openSpace !== spaceId }
  }, [connector, items, inScope, spaceId, openSpace, scoped])
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
  /** Gewählte Ziele, die hier nicht entfernt werden können (ohne ✕). */
  lockedTargets?: readonly string[]
  /** Nur Items, für die das gilt, werden angeboten (Suche und Modul-Pick). */
  canChoose?: (item: Item) => boolean
  /** Grund, warum das Feld nichts anbietet — steht statt der Suche. */
  unavailable?: string
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
  lockedTargets,
  canChoose,
  unavailable,
}: ItemRelationWidgetProps) {
  const { items: allCandidates, all, needsSpace, otherSpace, spaceOf } = useCandidates(targetType, spaceId)
  const candidates = canChoose ? allCandidates.filter(canChoose) : allCandidates
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
  const latest = useRef({ candidates, allCandidates, value, excludeId, spaceId, spaceOf, full: false, unavailable, onChange })
  latest.current = { candidates, allCandidates, value, excludeId, spaceId, spaceOf, full: !!single && value.length > 0, unavailable, onChange }
  const checkPick = (id: string): ItemPickResult => {
    const now = latest.current
    if (now.unavailable) return { ok: false, reason: now.unavailable }
    if (now.full) return { ok: false, reason: "Das Feld hat schon ein Ziel" }
    if (id === now.excludeId) return { ok: false, reason: "Ein Item verweist nicht auf sich selbst" }
    const target = now.candidates.find((c) => c.id === id)
    if (!target && now.allCandidates.some((c) => c.id === id)) return { ok: false, reason: "Keine Schreibrechte an diesem Item" }
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

  // Gegen den aktuellen Stand: Ein asynchroner Pick darf zwischenzeitliche
  // Änderungen nicht überschreiben.
  const add = (id: string) => {
    const target = `item:${id}`
    const { value: now, onChange: change } = latest.current
    change(single ? [target] : now.includes(target) ? [...now] : [...now, target])
    setQuery("")
    setOpen(false)
  }
  const locked = (target: string) => !!lockedTargets?.includes(target)
  const remove = (target: string) => {
    if (!locked(target)) onChange(value.filter((t) => t !== target))
  }
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
                  <ItemRefChip item={item} inert onRemove={locked(target) ? undefined : () => remove(target)} />
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
          {!full && unavailable && (
            <span data-incoming-unavailable className="text-sm text-muted-foreground">{unavailable}</span>
          )}
          {!full && !unavailable && needsSpace && (
            <span data-needs-space className="text-sm text-muted-foreground">Erst einen Space wählen</span>
          )}
          {!full && !unavailable && otherSpace && (
            <span data-other-space className="text-sm text-muted-foreground">Dieser Speicher sucht nur im geöffneten Space – zum Verknüpfen in „{spaceName}“ dorthin wechseln</span>
          )}
          {!full && !unavailable && !needsSpace && !otherSpace && (
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
                  const last = [...value].reverse().find((t) => !locked(t))
                  if (last) remove(last)
                }
              }}
              className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          )}
          {requestItemPick && !full && !unavailable && !needsSpace && !otherSpace && (
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

export interface IncomingRelationFieldProps {
  label: string
  predicate: string
  targetType?: string
  placeholder?: string
  /** Das bearbeitete Item; beim Anlegen fehlt es (dann gibt es keine Quellen). */
  itemId?: string
  /** Space des Formulars (Kopf). */
  spaceId?: string
  /** Hinzugefügte Quellen (`item:<id>`). */
  added: readonly string[]
  /** Entfernte Quellen (`item:<id>`). */
  removed: readonly string[]
  onChange: (added: string[], removed: string[]) => void
  requestItemPick?: RequestItemPick
}

/** Grund, wenn der Formular-Space nicht der geöffnete ist (Space des Formulars, Regel 7). */
export const INCOMING_OTHER_SPACE = "„Braucht“ lässt sich nur im geöffneten Space setzen – die andere Aufgabe wird dort geschrieben"

/**
 * Schreibform einer EINGEHENDEN Item-Kante („Braucht", C3; S3b): Die Kante
 * liegt am anderen Item. Das Feld zeigt die Quellen live — jedes Item im
 * Formular-Space, das die Kante auf dieses Item trägt — und führt nur die
 * Änderungen (hinzugefügt, entfernt); geschrieben wird nach dem Speichern an
 * den Quellen (useItemEditor). Angeboten werden nur Items, die ich bearbeiten
 * darf; eine Quelle ohne Schreibrecht steht fest, ohne ✕.
 *
 * Geschrieben wird über `updateItem` an der Quelle, und der erreicht nur
 * Items im geöffneten Space: Mit Spaces ist das Feld darum nur dort
 * bedienbar und sagt sonst, warum (kein Vortäuschen, Regel 7).
 */
export function IncomingRelationField({
  label,
  predicate,
  targetType,
  placeholder,
  itemId,
  spaceId,
  added,
  removed,
  onChange,
  requestItemPick,
}: IncomingRelationFieldProps) {
  const connector = useOptionalConnector()
  const meId = useMeId(connector)
  const { all, spaceOf } = useCandidates(targetType, spaceId)
  const openSpace = connector && hasGroups(connector) ? (connector.getCurrentGroup()?.id ?? null) : null
  const unavailable = connector && hasItemGroups(connector) && spaceId && openSpace !== spaceId ? INCOMING_OTHER_SPACE : undefined
  const canEdit = (item: Item) => !!connector && resolveItemPermissions(connector, item, meId).canEdit
  // Die Quellen: Items im Formular-Space, deren Kante auf dieses Item zeigt.
  const self = itemId ? ({ id: itemId } as Item) : null
  const sources = self
    ? all.filter(
        (c) =>
          c.id !== itemId &&
          (!spaceOf || spaceOf(c.id) === (spaceId ?? null)) &&
          (c.relations ?? []).some((r) => r.predicate === predicate && targetPointsTo(r.target, self, spaceOf ? spaceOf(c.id) : null, spaceOf)),
      )
    : []
  const live = sources.map((c) => `item:${c.id}`)
  const value = [...live.filter((t) => !removed.includes(t)), ...added.filter((t) => !live.includes(t))]
  // Außerhalb des geöffneten Space ist keine Quelle schreibbar (Codex R1/4);
  // eigene, noch nicht gespeicherte Ergänzungen bleiben entfernbar.
  const lockedTargets = sources.filter((c) => unavailable || !canEdit(c)).map((c) => `item:${c.id}`)
  return (
    <ItemRelationWidget
      label={label}
      predicate={predicate}
      targetType={targetType}
      placeholder={placeholder}
      value={value}
      onChange={(next) => onChange(next.filter((t) => !live.includes(t)), live.filter((t) => !next.includes(t)))}
      excludeId={itemId}
      spaceId={spaceId}
      lockedTargets={lockedTargets}
      canChoose={canEdit}
      unavailable={unavailable}
      requestItemPick={requestItemPick}
    />
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

/** Die angemeldete Person, auch ohne Provider (dann keine). */
function useMeId(connector: DataInterface | null): string | undefined {
  const observable = useMemo(() => (connector && isAuthenticatable(connector) ? connector.observeCurrentUser() : null), [connector])
  const [me, setMe] = useState(observable?.current ?? null)
  useEffect(() => {
    if (!observable) {
      setMe(null)
      return
    }
    setMe(observable.current)
    return observable.subscribe(setMe)
  }, [observable])
  return me?.id
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
