"use client"

import { useId, useState } from "react"
import type { User } from "@real-life-stack/data-interface"

import { PersonAvatar } from "./person-avatar"
import { ProfileLink } from "../profile/profile-link"
import { summarizePeople, type PeopleLineEntry } from "./people-line"

/**
 * Die Menschen-Zeile (C1, Lesen): Chips mit Avatar, Name und Qualifier klein
 * dahinter; eine Aussage über andere sagt, von wem („eingetragen von …").
 * Ab der Schwelle fasst sie je Qualifier zusammen (drei Avatare, „12
 * zugesagt"). „Alle" klappt die vollständige Liste auf — mit denen, die
 * abgesagt haben (shared-components, Detail-Anatomie, Regel 5; Zustand
 * „Viele").
 */
export interface PeopleLineRowProps {
  entries: readonly PeopleLineEntry[]
  resolveUser: (id: string) => User | undefined
  resolveName: (id: string) => string
  /** Die angemeldete Person — „eingetragen von dir". */
  currentUserId?: string
}

function UserAvatar({ user, className }: { user: User; className?: string }) {
  return <PersonAvatar name={user.displayName ?? user.id} avatarUrl={user.avatarUrl} className={className} />
}

/** Der Name des Profil-Links trägt, was der Chip zeigt: Qualifier und Sprecher. */
function accessibleLabel(name: string, entry: PeopleLineEntry, speaker: (id: string) => string): string {
  const parts = [entry.qualifier?.label, entry.speakerId ? `eingetragen von ${speaker(entry.speakerId)}` : undefined].filter(Boolean)
  return parts.length > 0 ? `Profil von ${name} öffnen — ${parts.join(", ")}` : `Profil von ${name} öffnen`
}

export function PeopleLineRow({ entries, resolveUser, resolveName, currentUserId }: PeopleLineRowProps) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const known = entries.filter((entry) => resolveUser(entry.userId))
  const visible = known.filter((entry) => !entry.hidden)
  const summary = summarizePeople(visible)
  const hasHidden = known.some((entry) => entry.hidden)
  const speaker = (id: string) => (id === currentUserId ? "dir" : resolveName(id))

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        {summary
          ? summary.map((group) => (
              <span key={group.label} data-people-summary={group.label} className="mr-1.5 inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className="flex -space-x-1.5">
                  {group.entries.map((entry) => (
                    <UserAvatar key={entry.userId} user={resolveUser(entry.userId)!} className="border-[1.5px] border-background" />
                  ))}
                </span>
                <span className="text-xs font-semibold text-foreground">{group.count}</span>
                {group.label && <span className="text-xs text-muted-foreground">{group.label}</span>}
              </span>
            ))
          : visible.map((entry) => {
              const user = resolveUser(entry.userId)!
              const name = user.displayName ?? user.id
              return (
                <ProfileLink key={entry.userId} userId={user.id} label={accessibleLabel(name, entry, speaker)}>
                  <span
                    data-person={entry.userId}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-2 text-xs font-medium text-foreground"
                  >
                    <UserAvatar user={user} />
                    <span className="truncate">{name}</span>
                    {entry.qualifier && <span className="font-normal text-muted-foreground"> {entry.qualifier.label}</span>}
                    {entry.speakerId && (
                      <span className="font-normal text-muted-foreground"> · eingetragen von {speaker(entry.speakerId)}</span>
                    )}
                  </span>
                </ProfileLink>
              )
            })}
        {(summary || hasHidden) && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={(event) => {
              event.stopPropagation()
              setOpen((o) => !o)
            }}
            className="rounded-sm text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {open ? "Weniger" : "Alle"}
          </button>
        )}
      </div>
      {open && (
        <ul id={listId} aria-label="Alle" className="flex flex-col gap-1.5">
          {known.map((entry) => {
            const user = resolveUser(entry.userId)!
            const name = user.displayName ?? user.id
            return (
              <li key={entry.userId} data-person-all={entry.userId} className="flex min-w-0 items-center gap-2 text-xs">
                <UserAvatar user={user} />
                <span className="truncate font-medium text-foreground">{name}</span>
                {entry.qualifier && <span className="text-muted-foreground"> {entry.qualifier.label}</span>}
                {entry.speakerId && <span className="text-muted-foreground"> · eingetragen von {speaker(entry.speakerId)}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
