"use client"

import type { Item, VoteValue } from "@real-life-stack/data-interface"
import { hasItemGroups } from "@real-life-stack/data-interface"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { useConnector } from "@/hooks/connector-context"
import { useMembers } from "@/hooks/use-groups"
import { useVotes, useVoteUsers } from "@/hooks/use-votes"
import type { EdgeEntry } from "../preview/field-register"

/**
 * Die Stimme im Slot `actions` (C4): Pills Dafür · Skeptisch · Dagegen als
 * Selbstaktion, darunter der Balken mit Anteil und „12 von 14".
 *
 * Spec: shared-components → Widget-Paare C4, Detail-Anatomie Regel 7;
 * Beschriftungen aus dem Register (Qualifier `value` an `votesOn`). Die Logik
 * bleibt die der Resonanz (resonance.md): `useVotes` entscheidet, was zählt,
 * dieselbe Pill noch einmal zieht die Stimme zurück, eine Stimme für eine
 * frühere Fassung zählt nicht. Die Karte zeigt weiter die kompakte
 * `VoteBar`.
 */
const ORDER: readonly VoteValue[] = ["green", "yellow", "red"]

const SEGMENT: Record<VoteValue, string> = {
  green: "bg-emerald-600",
  yellow: "bg-amber-500",
  red: "bg-red-600",
}

const PILL = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
const PILL_PRIMARY = "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
const PILL_ON = "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-300"
const PILL_IDLE = "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"

export function VoteActions({ item, edge }: { item: Item; edge: EdgeEntry }) {
  const connector = useConnector()
  const { data: summary, vote, canVote } = useVotes(item.id)
  const { data: voters } = useVoteUsers(item.id, summary.total > 0)
  const groupId = hasItemGroups(connector) ? connector.getItemGroupId(item.id) : null
  const { data: members } = useMembers(groupId ?? null)

  const label = (value: VoteValue) => edge.qualifier?.values.find((v) => v.id === value)?.label ?? value
  const neutral = summary.myVote === undefined
  if (!canVote && summary.total === 0) return null

  const percent = summary.total > 0 ? Math.round((summary.green / summary.total) * 100) : 0
  const answered =
    groupId && members.length >= summary.total && members.length > 0
      ? `${summary.total} von ${members.length} haben geantwortet`
      : summary.total === 1
        ? "1 Stimme"
        : `${summary.total} Stimmen`

  return (
    <div data-vote-actions className="flex w-full flex-col gap-2" onClick={(event) => event.stopPropagation()}>
      {canVote && (
        <div role="group" aria-label={edge.selfAction?.label ?? edge.label} className="flex flex-wrap items-center gap-1.5">
          {ORDER.map((value, index) => {
            const on = summary.myVote === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => void vote(value)}
                className={cn(PILL, on ? PILL_ON : neutral && index === 0 ? PILL_PRIMARY : PILL_IDLE)}
              >
                {on && <Check className="h-3.5 w-3.5" aria-hidden />}
                {label(value)}
              </button>
            )
          })}
        </div>
      )}
      {summary.total > 0 && (
        <div className="flex flex-col gap-1">
          <div
            className="flex h-7 gap-0.5 overflow-hidden rounded-lg"
            role="img"
            aria-label={ORDER.map((value) => `${label(value)}: ${summary[value]}`).join(", ")}
          >
            {ORDER.map((value) =>
              summary[value] > 0 ? (
                <div
                  key={value}
                  title={`${label(value)}: ${voters.filter((v) => v.value === value).map((v) => v.displayName).join(", ")}`}
                  className={cn("flex min-w-0 items-center justify-center text-xs font-semibold text-white", SEGMENT[value])}
                  style={{ flexGrow: summary[value] }}
                >
                  {summary[value]}
                </div>
              ) : null,
            )}
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {percent} % {label("green").toLocaleLowerCase("de")}
            </span>
            <span>{answered}</span>
          </div>
        </div>
      )}
      {summary.myVoteOtherVersion && (
        // resonance.md, Stimmregel 5: Die Stimme galt einer früheren Fassung.
        <p className="text-xs text-muted-foreground">
          Deine Stimme ({label(summary.myVoteOtherVersion)}) galt einer früheren Fassung und zählt nicht mehr. Stimme neu ab, damit sie zählt.
        </p>
      )}
    </div>
  )
}
