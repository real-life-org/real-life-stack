"use client"

import type { Item } from "@real-life-stack/data-interface"
import { Check } from "lucide-react"

import { cn } from "../../lib/utils"
import { VoteActions } from "../resonance/vote-actions"
import type { EdgeEntry } from "./field-register"
import { useSelfAction } from "./use-people-line"

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
export function RegisterActions({ item, edges }: { item: Item; edges?: readonly EdgeEntry[] }) {
  const rows = actionEdges(edges)
  if (rows.length === 0) return null
  return (
    <>
      {rows.map((edge) =>
        edge.widget === "vote" ? (
          <VoteActions key={`${edge.predicate}:${edge.itemRole}`} item={item} edge={edge} />
        ) : (
          <SelfActionPills key={`${edge.predicate}:${edge.itemRole}`} item={item} edge={edge} />
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
 */
export function SelfActionPills({ item, edge }: { item: Item; edge: EdgeEntry }) {
  const { available, mine, act } = useSelfAction(item, edge)
  if (!available || !edge.selfAction) return null
  const values = edge.selfAction.qualifiers?.length
    ? edge.selfAction.qualifiers
        .map((id) => edge.qualifier?.values.find((v) => v.id === id))
        .filter((v): v is NonNullable<typeof v> => !!v)
    : null
  const neutral = mine === undefined

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

  return (
    <div
      role="group"
      aria-label={edge.selfAction.label}
      data-self-action={edge.predicate}
      className="flex flex-wrap items-center gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      {pills.map((pill) => (
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
      ))}
    </div>
  )
}
