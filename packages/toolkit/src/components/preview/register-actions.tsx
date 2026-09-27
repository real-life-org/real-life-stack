"use client"

import type { Item } from "@real-life-stack/data-interface"
import { Check } from "lucide-react"

import { cn } from "../../lib/utils"
import { VoteActions } from "../resonance/vote-actions"
import { FOLLOW_UP_WHEN, doneValue, type EdgeEntry, type FieldEntry } from "./field-register"
import { useFollowUps, useSelfAction } from "./use-people-line"

/**
 * Slot `actions` aus dem Register: Selbstaktionen als Pill-Zeile (C2) und die
 * Stimme (C4, Pills und Balken) direkt unter der Meta-Box.
 *
 * Spec: shared-components → „Item-Detail aus dem Register", Detail-Anatomie
 * Regel 7, Widget-Paare C2/C4, Modi Regel 1; 06 → Feld- und Kantenregister,
 * Regel 9.
 *
 * Verzweigt über das Widget der Kante, nie über den Typ. Rendert `null`, wenn
 * keine Aktion möglich ist — ohne Schreibrecht entfällt die Zeile ganz.
 */
export function RegisterActions({
  item,
  edges,
  fields,
  defaultStatus,
}: {
  item: Item
  edges?: readonly EdgeEntry[]
  /** Die Felder des Typs: Folgeaktionen lesen daraus ihr Status-Feld. */
  fields?: readonly FieldEntry[]
  /** Standard-Status für „Wieder öffnen" (`composer.defaultStatus`). */
  defaultStatus?: string
}) {
  const rows = actionEdges(edges)
  if (rows.length === 0) return null
  return (
    <>
      {rows.map((edge) =>
        edge.widget === "vote" ? (
          <VoteActions key={`${edge.predicate}:${edge.itemRole}`} item={item} edge={edge} />
        ) : (
          <SelfActionPills key={`${edge.predicate}:${edge.itemRole}`} item={item} edge={edge} fields={fields} defaultStatus={defaultStatus} />
        ),
      )}
    </>
  )
}

/** Kanten mit Selbstaktion oder im Slot `actions`, in Register-Reihenfolge. */
export function actionEdges(edges: readonly EdgeEntry[] | undefined): EdgeEntry[] {
  return (edges ?? []).filter((edge) => (edge.widget === "vote" && edge.pos === "actions") || (edge.widget === "people" && edge.selfAction))
}

const PILL = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
const PILL_PRIMARY = "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
const PILL_ON = "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-300"
const PILL_IDLE = "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"

const capitalize = (word: string) => word.charAt(0).toLocaleUpperCase("de") + word.slice(1)

/**
 * Pill-Zeile einer Selbstaktion (C2): vor der Aktion neutral (die erste Pill
 * hervorgehoben), danach mein Zustand („✓ Zugesagt"). Auch `declined` ist ein
 * Zustand und bleibt als meiner sichtbar (Detail-Anatomie, Regel 7).
 *
 * Deklariert die Kante Folgeaktionen (`selfAction.followUps`, Entscheidung
 * 27), stehen sie nach meinem Zustand in derselben Zeile — nur für mich, wenn
 * ich die Selbstaussage habe, und nur mit Schreibrecht am Item. Mein Zustand
 * ist dann eine Anzeige, kein Umschalter: Abgeben ist eine eigene Aktion.
 */
export function SelfActionPills({
  item,
  edge,
  fields,
  defaultStatus,
}: {
  item: Item
  edge: EdgeEntry
  fields?: readonly FieldEntry[]
  defaultStatus?: string
}) {
  const { available, mine, act, withdraw, busy, error } = useSelfAction(item, edge)
  const followUps = edge.selfAction?.followUps
  const statusField = followUps ? fields?.find((f) => f.key === followUps.field) : undefined
  const follow = useFollowUps(item, statusField, defaultStatus, edge)
  if (!available || !edge.selfAction) return null
  const values = edge.selfAction.qualifiers?.length
    ? edge.selfAction.qualifiers
        .map((id) => edge.qualifier?.values.find((v) => v.id === id))
        .filter((v): v is NonNullable<typeof v> => !!v)
    : null
  const neutral = mine === undefined
  const withFollowUps = !!followUps && !neutral && follow.available
  const isDone = withFollowUps && doneValue(statusField) !== undefined && item.data?.[followUps!.field] === doneValue(statusField)

  const pills = values
    ? values.map((value, index) => ({
        key: value.id,
        value: value.id as string | undefined,
        on: mine === value.id,
        primary: neutral && index === 0,
        label: mine === value.id ? capitalize(value.label) : (value.action ?? capitalize(value.label)),
      }))
    : [
        {
          key: "self",
          value: undefined,
          on: mine !== undefined,
          primary: neutral,
          label: mine !== undefined ? edge.selfAction.mine : edge.selfAction.label,
        },
      ]

  const followActions = withFollowUps
    ? followUps!.actions.filter((a) => FOLLOW_UP_WHEN[a.id] === (isDone ? "done" : "open"))
    : []

  return (
    <div
      role="group"
      aria-label={edge.selfAction.label}
      data-self-action={edge.predicate}
      className="flex flex-wrap items-center gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {isDone ? (
        <StatePill label={followUps!.done} />
      ) : (
        pills.map((pill) =>
          withFollowUps && pill.on ? (
            // Mein Zustand als Anzeige: Die Folgeaktionen sagen, was geht.
            <StatePill key={pill.key} label={pill.label} />
          ) : (
            <button
              key={pill.key}
              type="button"
              aria-pressed={pill.on}
              onClick={() => void act(pill.value)}
              className={cn(PILL, pill.on ? PILL_ON : pill.primary ? PILL_PRIMARY : PILL_IDLE)}
            >
              {pill.on && <Check className="h-3.5 w-3.5" aria-hidden />}
              {pill.label}
            </button>
          ),
        )
      )}
      {followActions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={follow.busy || busy}
          data-follow-up={action.id}
          onClick={() => void (action.id === "release" ? withdraw() : follow.run(action.id))}
          className={cn(PILL, PILL_IDLE, "disabled:opacity-60")}
        >
          {action.label}
        </button>
      ))}
      {(error || follow.error) && (
        <span role="alert" className="basis-full text-xs text-destructive">
          Konnte nicht gespeichert werden. {error ?? follow.error}
        </span>
      )}
    </div>
  )
}

/** Mein Zustand als Pill, ohne Aktion („✓ Übernommen", „✓ Erledigt"). */
function StatePill({ label }: { label: string }) {
  return (
    <span data-self-state className={cn(PILL, PILL_ON)}>
      <Check className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  )
}
