"use client"

import { useEffect, useId, useMemo, useState, startTransition } from "react"
import { hasGroups, hasGroupScope, hasItemGroups, isAuthenticatable, type DataInterface, type Item } from "@real-life-stack/data-interface"
import { Lock, MousePointerClick } from "lucide-react"

import { useOptionalConnector } from "../../../hooks/connector-context"
import type { FieldAccess, FieldWork } from "../../../lib/form-state"
import type { IncomingValue } from "../form-fields"
import { FieldNotice } from "./field-notice"
import { resolveItemPermissions } from "../../../hooks/use-item-permissions"
import { cn } from "../../../lib/utils"
import { ItemRefChip, MissingRefText } from "../../preview/item-ref-chip"
import { targetFilter } from "../../preview/use-item-edges"
import { resolveTarget, spaceScope, useResolvedTarget, type TargetScope } from "../../../lib/item-targets"
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
export function useCandidates(
  targetType: string | undefined,
  spaceId: string | undefined,
): { items: Item[]; all: readonly Item[]; needsSpace: boolean; otherSpace: boolean; scope: TargetScope } {
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
    // Der Kontext des Formulars baut der Auflöser (06, Verhältnis zu
    // Relations, Regel 6). Alles, was der Connector mit `group` liefert,
    // liegt in diesem Space — auch wenn `getItemGroupId` eine Id in mehreren
    // Spaces nicht auflöst.
    if (scoped) {
      const ids = new Set(inScope.map((item) => item.id))
      const others = items.filter((item) => !ids.has(item.id))
      const scope = spaceScope(connector, spaceId, { knownInSpace: ids, otherKind: targetType })
      return { items: [...inScope], all: [...inScope, ...others], needsSpace: false, otherSpace: false, scope }
    }
    const scope = spaceScope(connector, spaceId, { otherKind: targetType })
    return { ...inSpace(connector, items, spaceId, scope), all: items, otherSpace: !!spaceId && openSpace !== null && openSpace !== spaceId, scope }
  }, [connector, items, inScope, spaceId, openSpace, scoped])
}

/**
 * Mit Spaces nur die Items des Formular-Space; ohne gewählten Space keine —
 * ein `item:`-Target aus der Übersicht wäre in einem anderen Space falsch.
 */
function inSpace(connector: DataInterface | null, items: readonly Item[], spaceId: string | undefined, scope: TargetScope) {
  if (!connector || !hasItemGroups(connector)) return { items: [...items], needsSpace: false }
  if (!spaceId) return { items: [], needsSpace: true }
  // Im Formular-Space ist, worauf ein lokales Target von dort zeigen kann.
  return { items: items.filter((item) => resolveTarget(`item:${item.id}`, scope, [item]) === item), needsSpace: false }
}

/**
 * Der Prüfstand eines Verknüpfungsfelds beim Eintreffen eines Modul-Picks
 * (Formularzustand, Regel 3): die Kandidaten, Rechte und Grenzen JETZT.
 */
export interface RelationChecks {
  candidates: readonly Item[]
  allCandidates: readonly Item[]
  excludeId: string | undefined
  scope: TargetScope
  unavailable: string | undefined
}

export interface ItemRelationWidgetProps {
  label: string
  /**
   * Der Feldzugang (shared-components → Formularzustand): die Targets
   * (`item:<id>`) in Reihenfolge, der Schreibweg und die Arbeit
   * „Modul-Pick".
   */
  field: FieldAccess<string[], RelationChecks>
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
  field,
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
  const { items: allCandidates, all, needsSpace, otherSpace, scope } = useCandidates(targetType, spaceId)
  const candidates = canChoose ? allCandidates.filter(canChoose) : allCandidates
  const value = field.value
  const connector = useOptionalConnector()
  const groupName = useGroupName(connector, otherSpace ? spaceId : undefined)
  const spaceName = groupName ?? "diesem Space"
  // Gewählte Ziele gegen alle sichtbaren Items (ein space-qualifiziertes
  // bleibt nach einem Space-Wechsel gültig); gesucht wird nur im Formular-Space.
  const resolve = (target: string) => resolveTarget(target, scope, all)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const listId = useId()

  const isChosen = (c: Item) => value.some((t) => resolveTarget(t, scope, [c]) === c)
  const needle = query.replace(/^@/, "").trim().toLocaleLowerCase("de")
  const suggestions = open
    ? candidates
        .filter((c) => c.id !== excludeId && !isChosen(c))
        .filter((c) => needle === "" || itemTitle(c).toLocaleLowerCase("de").includes(needle))
        .slice(0, 6)
    : []

  const full = !!single && value.length > 0
  // Der Modul-Pick ist Nutzerarbeit (Formularzustand, Regeln 6 und 10): Er
  // prüft beim Eintreffen gegen den Stand JETZT — Wert, Kandidaten, Rechte.
  // Passt das Ziel nicht, steht der Grund am Feld und geht an das Modul.
  field.track({ candidates, allCandidates, excludeId, scope, unavailable })
  const checkPick = (id: string, current: readonly string[], now: RelationChecks | undefined): ItemPickResult => {
    if (!now) return { ok: false, reason: "Das Feld ist nicht mehr da" }
    if (now.unavailable) return { ok: false, reason: now.unavailable }
    if (single && current.length > 0) return { ok: false, reason: "Das Feld hat schon ein Ziel" }
    if (id === now.excludeId) return { ok: false, reason: "Ein Item verweist nicht auf sich selbst" }
    const target = now.candidates.find((c) => c.id === id)
    if (!target && now.allCandidates.some((c) => c.id === id)) return { ok: false, reason: "Keine Schreibrechte an diesem Item" }
    if (!target) {
      return { ok: false, reason: targetType ? "Das Ziel ist nicht vom passenden Typ oder liegt nicht in diesem Space" : "Das Ziel liegt nicht in diesem Space" }
    }
    if (current.some((t) => resolveTarget(t, now.scope, [target]) === target)) return { ok: false, reason: "Das Ziel ist schon gewählt" }
    return { ok: true }
  }
  const startPick = () => {
    const pick: FieldWork<string[], RelationChecks> = field.begin("pick", "user", "Verknüpfung")
    requestItemPick?.({ predicate, targetType }, (id) => {
      let result: ItemPickResult = { ok: false, reason: "Das Formular nimmt die Wahl nicht mehr an" }
      const ran = pick.apply((now) => {
        result = checkPick(id, now.value, now.checks)
        if (result.ok) now.set(added(now.value, id))
        else now.refuse(result.reason)
      })
      // Der Pick bleibt offen, bis ein neuer beginnt oder das Formular schließt:
      // Ein Modul darf mehrere Ziele nacheinander wählen.
      if (ran && result.ok) {
        setQuery("")
        setOpen(false)
      }
      return result
    })
  }

  // Ein Ziel dazu, gegen den Wert, auf den der Schreibweg trifft.
  const added = (current: readonly string[], id: string): string[] => {
    const target = `item:${id}`
    return single ? [target] : current.includes(target) ? [...current] : [...current, target]
  }
  const add = (id: string) => {
    field.set(added(value, id))
    setQuery("")
    setOpen(false)
  }
  const locked = (target: string) => !!lockedTargets?.includes(target)
  const remove = (target: string) => {
    if (!locked(target)) field.set(value.filter((t) => t !== target))
  }

  return (
    <div className="flex flex-col gap-1.5" data-item-relation-field={predicate}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
          {value.map((target) => {
            const item = resolve(target)
            return (
              <span key={target} data-relation-chip={item?.id ?? target} className="inline-flex">
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
              onClick={startPick}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
              Im Modul wählen
            </button>
          )}
        </div>
        {field.notice && (
          <div className="mt-1">
            <FieldNotice text={field.notice} onDismiss={field.dismissNotice} />
          </div>
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
  /**
   * Der Feldzugang (Formularzustand): die hinzugefügten und entfernten
   * Quellen (`item:<id>`) gegen die live gelesenen.
   */
  field: FieldAccess<IncomingValue, IncomingChecks>
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
  field,
  requestItemPick,
}: IncomingRelationFieldProps) {
  const connector = useOptionalConnector()
  const meId = useMeId(connector)
  const { all, scope } = useCandidates(targetType, spaceId)
  const openSpace = connector && hasGroups(connector) ? (connector.getCurrentGroup()?.id ?? null) : null
  const unavailable = connector && hasItemGroups(connector) && spaceId && openSpace !== spaceId ? INCOMING_OTHER_SPACE : undefined
  const canEdit = (item: Item) => !!connector && resolveItemPermissions(connector, item, meId).canEdit
  // Die Quellen: Items im Formular-Space, deren Kante auf dieses Item zeigt.
  const self = itemId ? ({ id: itemId, type: "" } as unknown as Item) : null
  // Das Item selbst liegt im Formular-Space; seine Typprüfung entfällt (es ist das Ziel, nicht die Gegenstelle).
  const selfScope = spaceScope(connector, spaceId, itemId ? { knownInSpace: new Set([itemId]) } : {})
  const sources = self
    ? all.filter(
        (c) =>
          c.id !== itemId &&
          // Die Quelle liegt im Formular-Space, ihre Kante zeigt von dort auf dieses Item (Auflöser).
          resolveTarget(`item:${c.id}`, scope, [c]) === c &&
          (c.relations ?? []).some((r) => r.predicate === predicate && resolveTarget(r.target, selfScope, [self]) === self),
      )
    : []
  const live = sources.map((c) => `item:${c.id}`)
  // Außerhalb des geöffneten Space ist keine Quelle schreibbar (Codex R1/4);
  // eigene, noch nicht gespeicherte Ergänzungen bleiben entfernbar.
  const lockedTargets = sources.filter((c) => unavailable || !canEdit(c)).map((c) => `item:${c.id}`)
  return (
    <ItemRelationWidget
      label={label}
      predicate={predicate}
      targetType={targetType}
      placeholder={placeholder}
      field={incomingAsTargets(field, live)}
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
export function FixedItemRefField({ label, value, missing, spaceId, targetType }: { label: string; value: string; missing: string; spaceId?: string; targetType?: string }) {
  const connector = useOptionalConnector()
  // Der Auflöser im Kontext des Formular-Space; ohne Space im Formular stammt
  // der Wert aus der Vorbelegung (Variante: Space des Ursprungs, fest) und
  // gilt im einen Bereich der Vorbelegung.
  const scope = spaceScope(connector, spaceId, { otherKind: targetType })
  const { item } = useResolvedTarget(value, scope)
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

/**
 * Name eines Space für den Hinweis; ohne Treffer undefined. Liest die
 * Gruppenliste des Connectors (beobachtet), keine eigene Anfrage.
 */
function useGroupName(connector: DataInterface | null, spaceId: string | undefined): string | undefined {
  const observable = useMemo(() => (connector && hasGroups(connector) ? connector.observeGroups() : null), [connector])
  const [groups, setGroups] = useState(observable?.current ?? [])
  useEffect(() => {
    if (!observable) return
    setGroups(observable.current)
    return observable.subscribe((next) => startTransition(() => setGroups(next)))
  }, [observable])
  return spaceId ? groups.find((g) => g.id === spaceId)?.name : undefined
}

/** Der Prüfstand einer eingehenden Kante: der des Verknüpfungsfelds und die live gelesenen Quellen. */
export type IncomingChecks = RelationChecks & { live: readonly string[] }

/** Die gezeigten Targets: die live gelesenen ohne die entfernten, dazu die hinzugefügten. */
function shownTargets(value: IncomingValue, live: readonly string[]): string[] {
  return [...live.filter((t) => !value.removed.includes(t)), ...value.added.filter((t) => !live.includes(t))]
}

/** Zurück in Änderungen: hinzugefügt ist, was nicht live ist; entfernt, was live fehlt. */
function asChanges(next: readonly string[], live: readonly string[]): IncomingValue {
  return { added: next.filter((t) => !live.includes(t)), removed: live.filter((t) => !next.includes(t)) }
}

/**
 * Der Feldzugang der eingehenden Kante, gesehen als Liste von Targets. Kein
 * eigener Zustand: Lesen und Schreiben gehen an den Zugang des Formulars;
 * beim Eintreffen eines Picks zählen die live gelesenen Quellen JETZT.
 */
function incomingAsTargets(field: FieldAccess<IncomingValue, IncomingChecks>, live: readonly string[]): FieldAccess<string[], RelationChecks> {
  return {
    value: shownTargets(field.value, live),
    locked: field.locked,
    notice: field.notice,
    set: (next) => field.set(asChanges(next, live)),
    begin: (channel, kind, what) => {
      const work = field.begin(channel, kind, what)
      return {
        signal: work.signal,
        valid: work.valid,
        finish: work.finish,
        apply: (fn) =>
          work.apply((now) => {
            const current = now.checks?.live ?? live
            fn({
              value: shownTargets(now.value, current),
              checks: now.checks,
              set: (next) => now.set(asChanges(next, current)),
              refuse: now.refuse,
            })
          }),
      }
    },
    cancel: field.cancel,
    busy: field.busy,
    track: (checks) => field.track({ ...checks, live }),
    dismissNotice: field.dismissNotice,
  }
}
