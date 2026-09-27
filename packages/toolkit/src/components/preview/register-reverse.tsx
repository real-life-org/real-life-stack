"use client"

import type { ReactNode } from "react"
import { Lock } from "lucide-react"
import type { Item } from "@real-life-stack/data-interface"

import { useOptionalItemFocus } from "../../hooks/use-item-focus"
import { cn } from "../../lib/utils"
import type { EdgeEntry, ListEntry } from "./field-register"
import { isItemDone } from "./item-ref-chip"
import { ItemPreview } from "./item-preview"
import { resolveListQuery, type ListRowDecoration } from "./list-queries"
import { GENERIC_BADGE, resolveTypePresentation } from "./type-presentation"
import { isItemEdge, useItemEdges } from "./use-item-edges"

/**
 * Slot `reverse`: die Rückwärts-Listen eines Items aus dem Register seines
 * Typs — benannte Abfragen (`lists`) und eingehende Kanten mit `pos: "list"`.
 *
 * Spec: shared-components → „Item-Detail aus dem Register", Detail-Anatomie
 * Regel 8; 06 → Feld- und Kantenregister, Regeln 10 und 12; Entscheidung 15:
 * alle Einträge, jeder einmal, keine Kappung. Trägt eine Liste eine Aktion,
 * steht sie im Kopf; hat die Liste keinen Eintrag außer dem Item selbst,
 * steht die Aktion allein an ihrer Stelle. Ein Hinweis (Modi, Regel 4) ist
 * eine kompakte Zeile mit Schloss; die Aktion steht dann in ihr, nicht im
 * Kopf (Claude Design, Detail-Simulator „Eingefroren").
 *
 * Verzweigt über den Namen der Abfrage und das Widget der Kante, nie über
 * den Typ. Rendert `null`, wenn es nichts zu zeigen gibt.
 */
export function RegisterReverse({ item, lists, edges }: { item: Item; lists?: readonly ListEntry[]; edges?: readonly EdgeEntry[] }) {
  const listEdges = (edges ?? []).filter((e) => e.pos === "list" && e.itemRole === "to" && isItemEdge(e))
  return (
    <>
      {(lists ?? []).map((entry) => {
        const query = resolveListQuery(entry.query)
        return query ? <QueryList key={entry.query} item={item} entry={entry} /> : null
      })}
      {listEdges.length > 0 && <EdgeLists item={item} edges={listEdges} />}
    </>
  )
}

/** Hat der Typ Rückwärts-Listen? */
export function hasReverseLists(lists: readonly ListEntry[] | undefined, edges: readonly EdgeEntry[] | undefined): boolean {
  return (lists?.length ?? 0) > 0 || (edges ?? []).some((e) => e.pos === "list" && e.itemRole === "to")
}

function QueryList({ item, entry }: { item: Item; entry: ListEntry }) {
  // Pro Instanz dieselbe Abfrage (key = Name): gleiche Hooks je Render.
  const useQuery = resolveListQuery(entry.query)!
  const { entries, decorate, action, note, noteDetail } = useQuery(item, entry)
  return (
    <ReverseList
      id={entry.query}
      item={item}
      label={entry.label}
      entries={entries}
      decorate={decorate}
      action={entry.action && action ? { label: entry.action.label, run: action, id: entry.action.id } : undefined}
      note={note}
      noteDetail={noteDetail}
    />
  )
}

function EdgeLists({ item, edges }: { item: Item; edges: readonly EdgeEntry[] }) {
  const targets = useItemEdges(item, edges)
  return (
    <>
      {edges.map((edge) => {
        const now = new Date().toISOString()
        const entries = (targets.get(edge) ?? [])
          .map((t) => t.item)
          .filter((entry) => {
            if (edge.list?.filter === "open") return !isItemDone(entry)
            if (edge.list?.filter === "upcoming") {
              const start = (entry.data as Record<string, unknown> | undefined)?.start
              return typeof start === "string" && start >= now.slice(0, start.length)
            }
            return true
          })
        return <ReverseList key={`${edge.predicate}:${edge.itemRole}`} id={`${edge.predicate}:${edge.itemRole}`} item={item} label={edge.label} entries={entries} />
      })}
    </>
  )
}

function ReverseList({
  id,
  item,
  label,
  entries,
  decorate,
  action,
  note,
  noteDetail,
}: {
  id: string
  item: Item
  label: string
  entries: readonly Item[]
  decorate?: (entry: Item) => ListRowDecoration
  action?: { id: string; label: string; run: () => void }
  note?: ReactNode
  noteDetail?: string
}) {
  const others = entries.filter((e) => e.id !== item.id)
  const actionLink = action && <ListActionLink action={action} />
  const noteRow = note && (
    <div
      data-list-note
      title={noteDetail}
      className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground"
    >
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{note}</span>
      {noteDetail && <span className="sr-only">{noteDetail}</span>}
      {actionLink}
    </div>
  )
  if (others.length === 0) {
    // Kein Eintrag außer dem Item selbst: der Hinweis, sonst die Aktion
    // allein an ihrer Stelle — rechts, wie im Kopf einer Liste.
    if (!action && !note) return null
    return noteRow ? (
      <div data-reverse-list={id}>{noteRow}</div>
    ) : (
      <div data-reverse-list={id} className="flex justify-end">{actionLink}</div>
    )
  }
  return (
    <section data-reverse-list={id} aria-label={label} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label} <span className="font-normal tabular-nums">{entries.length}</span>
        </h3>
        {!noteRow && actionLink}
      </div>
      {noteRow}
      <ul className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          // Der Klick gehört der Zeile, nicht der Karte darum herum.
          <li key={entry.id} data-list-row={entry.id} onClick={(event) => event.stopPropagation()}>
            <ReverseRow entry={entry} current={entry.id === item.id} decoration={decorate?.(entry)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Die Aktion einer Liste als kleiner Link (Kopf, Hinweiszeile oder allein). */
function ListActionLink({ action }: { action: { id: string; label: string; run: () => void } }) {
  return (
    <button
      type="button"
      data-list-action={action.id}
      onClick={action.run}
      className="shrink-0 rounded px-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {action.label}
    </button>
  )
}

/**
 * Eine Zeile der Liste: die einzeilige Form von `ItemPreview` (Kartenflächen-
 * MUSS, Detail-Anatomie Regel 8) — Badge in der Typfarbe, Titel, rechts
 * Markierung und kleiner Zusatz; erledigt mit Häkchen und gedimmt
 * (`completed`, Rolle `done`). Klick öffnet den Eintrag in derselben
 * Panel-Instanz; die angezeigte Zeile ist markiert (`active`).
 */
function ReverseRow({ entry, current, decoration }: { entry: Item; current: boolean; decoration?: ListRowDecoration }) {
  const focus = useOptionalItemFocus()
  const presentation = resolveTypePresentation(entry.type)
  const badge = presentation.badge ?? GENERIC_BADGE
  const Icon = badge.icon
  const open = !current && focus ? () => focus.focusItem(entry.id) : undefined
  const trailing = (decoration?.mark || decoration?.trailing) && (
    <>
      {decoration?.mark && <span className="shrink-0 text-xs text-muted-foreground">{decoration.mark}</span>}
      {decoration?.trailing && <span className="w-16 shrink-0 empty:hidden">{decoration.trailing}</span>}
    </>
  )
  return (
    <ItemPreview
      item={entry}
      density="row"
      author={null}
      active={current}
      completed={isItemDone(entry)}
      onClick={open}
      headerAdornment={
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium", badge.className)}>
          <Icon className="h-3 w-3" aria-hidden />
          {decoration?.badge ?? presentation.label}
        </span>
      }
      footerAdornment={trailing || undefined}
    />
  )
}
