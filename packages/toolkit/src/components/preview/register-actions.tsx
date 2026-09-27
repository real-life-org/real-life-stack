"use client"

import { useMemo } from "react"
import type { Item } from "@real-life-stack/data-interface"
import { Check } from "lucide-react"

import { cn } from "../../lib/utils"
import { VoteActions } from "../resonance/vote-actions"
import { statusRole, type EdgeEntry, type FieldEntry } from "./field-register"
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
  /** Standard-Status des Typs (`composer.defaultStatus`). */
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
 * Zustand und bleibt als meiner sichtbar (Detail-Anatomie, Regel 7). Die Pill
 * meines Zustands ist ein Umschalter; der zweite Klick nimmt ihn zurück —
 * idempotent, ein Doppelklick übernimmt nicht wieder.
 *
 * Mitmachen (`selfAction.join`, Spec 06 Regel 9): Stehen andere an der Kante
 * und ich nicht, heißt die Pill „Mitmachen"; stehe ich mit anderen dort,
 * „✓ Dabei" (Rücknahme „Nicht mehr mitmachen"); allein „✓ Übernommen".
 *
 * Deklariert die Kante eine Folgeaktion (`selfAction.followUps`), steht nach
 * meinem Zustand „Erledigt" — nur, wenn ich an der Kante stehe, mit
 * Schreibrecht am Item und einem Status der Rolle `open` oder `active`. Hat er
 * die Rolle `done`, zeigt die Zeile nur Zustände: „✓ Übernommen"/„✓ Dabei"
 * (wenn ich zugewiesen bin) und „✓ Erledigt", keine Knöpfe. Dazukommen und
 * Abgeben ändern den Status nach Regel 19 (useSelfAction).
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
  const followUps = edge.selfAction?.followUps
  const statusField = followUps ? fields?.find((f) => f.key === followUps.field && f.widget === "status") : undefined
  const transitions = useMemo(() => (statusField ? { field: statusField, defaultStatus } : undefined), [statusField, defaultStatus])
  const { available, mine, others, act, withdraw, busy, error } = useSelfAction(item, edge, transitions)
  const follow = useFollowUps(item, statusField, defaultStatus, edge)
  if (!available || !edge.selfAction) return null
  const values = edge.selfAction.qualifiers?.length
    ? edge.selfAction.qualifiers
        .map((id) => edge.qualifier?.values.find((v) => v.id === id))
        .filter((v): v is NonNullable<typeof v> => !!v)
    : null
  const neutral = mine === undefined
  // Mein Zustand, beschriftet aus ALLEN Werten der Kante (nicht nur den
  // angebotenen Pills, Codex R4): ein bekannter Wert mit seiner Anzeige, ein
  // unbekannter oder keiner mit der allgemeinen Beschriftung („Dabei").
  const generalMine = others && edge.selfAction.join ? edge.selfAction.join.mine : edge.selfAction.mine
  const myValue = typeof mine === "string" ? edge.qualifier?.values.find((v) => v.id === mine) : undefined
  const myStateLabel = myValue ? capitalize(myValue.label) : generalMine
  // Mit Pills: steht mein Wert unter keiner Pill, trägt eine eigene Zustands-Pill ihn (Umschalter zum Abgeben).
  const offMenu = !!values && !neutral && !values.some((v) => v.id === mine)
  // Erledigt zeigt die Zeile nur Zustände, keine Aktionen (Anton zu #542):
  // kein Übernehmen, kein Mitmachen, kein Abgeben. Wieder öffnen nur über
  // Bearbeiten oder das Modul; danach gelten die normalen Aktionen. Gilt für
  // jede Selbstaktion mit Folgeaktion, auch eine App-Ersetzung (Regel 20).
  if (followUps && statusField && statusRole(statusField, item.data?.[followUps.field], defaultStatus) === "done") {
    const mineLabel = neutral ? null : myStateLabel
    return (
      <div role="group" aria-label={edge.selfAction.label} data-self-action={edge.predicate} className="flex flex-wrap items-center gap-1.5">
        {mineLabel && (
          <span data-self-state role="status" className={cn(PILL, PILL_ON)}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            {mineLabel}
          </span>
        )}
        <span data-self-state role="status" className={cn(PILL, PILL_ON)}>
          <Check className="h-3.5 w-3.5" aria-hidden />
          {followUps.complete.label}
        </span>
      </div>
    )
  }
  const withFollowUp = !!followUps && !!statusField && !neutral && follow.available
  const role = withFollowUp ? statusRole(statusField, item.data?.[followUps!.field], defaultStatus) : undefined
  const join = others ? edge.selfAction.join : undefined
  const release = join ? join.release : followUps?.release

  const pills = values
    ? [
        ...(offMenu ? [{ key: "mine", value: undefined as string | undefined, on: true, primary: false, label: myStateLabel }] : []),
        ...values.map((value, index) => ({
        key: value.id,
        value: value.id as string | undefined,
        on: mine === value.id,
        primary: neutral && index === 0,
        label: mine === value.id ? capitalize(value.label) : (value.action ?? capitalize(value.label)),
      })),
      ]
    : [
        {
          key: "self",
          value: undefined,
          on: mine !== undefined,
          primary: neutral,
          label: mine !== undefined ? (join?.mine ?? edge.selfAction.mine) : (join?.label ?? edge.selfAction.label),
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
          // Mein Zustand nimmt beim zweiten Klick zurück; der Name sagt es.
          aria-label={pill.on && release ? `${pill.label} – ${release}` : undefined}
          disabled={pill.on && busy}
          // Ohne Qualifier ist der zweite Klick die Rücknahme — idempotent
          // (withdraw), ein Doppelklick übernimmt nicht wieder. Mit Qualifier
          // entscheidet die Schreibkette gegen die laufende Absicht: Ein
          // schneller Wechsel „vielleicht → zugesagt" darf nicht löschen.
          onClick={() => void (pill.on && pill.value === undefined ? withdraw() : act(pill.value))}
          className={cn(PILL, pill.on ? PILL_ON : pill.primary ? PILL_PRIMARY : PILL_IDLE)}
        >
          {pill.on && <Check className="h-3.5 w-3.5" aria-hidden />}
          {pill.label}
        </button>
      ))}
      {role === "done" && (
        // „✓ Erledigt" ist ein Zustand, nicht zurücknehmbar (Anton): zurück
        // geht es über Bearbeiten (Status im Formular) oder das Kanban.
        <span data-self-state role="status" className={cn(PILL, PILL_ON)}>
          <Check className="h-3.5 w-3.5" aria-hidden />
          {followUps!.complete.label}
        </span>
      )}
      {(role === "open" || role === "active") && (
        <button
          type="button"
          disabled={follow.busy || busy}
          data-follow-up="complete"
          // Frisch geprüft beim Auslösen (#531): nur, wenn ich noch an der Kante stehe und der Status open oder active ist.
          onClick={() => void follow.run("complete")}
          className={cn(PILL, PILL_IDLE, "disabled:opacity-60")}
        >
          {followUps!.complete.label}
        </button>
      )}
      {(error || follow.error) && (
        <span role="alert" className="basis-full text-xs text-destructive">
          Konnte nicht gespeichert werden. {error ?? follow.error}
        </span>
      )}
    </div>
  )
}
