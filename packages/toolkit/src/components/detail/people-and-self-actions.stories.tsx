import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item, User } from "@real-life-stack/data-interface"

import { ItemDetailRead } from "../host/detail-host"
import { useItem } from "../../hooks/use-items"
import { STORY_EVENT, STORY_TASK, STORY_USERS, StoryWorld } from "../../story-support/story-world"

/**
 * **People and self-actions** in the detail view (spec shared-components →
 * „Item-Detail aus dem Register", C1, C2, C4; spec 08 → „Teilnahme am Event").
 *
 * - **One people row per type.** An event shows invited people and attendance
 *   in one row; the qualifier stands small behind the name („zugesagt",
 *   „vielleicht", „eingeladen"). A statement about someone else says who
 *   entered it („eingetragen von …"). Who declined is not in the row, only in
 *   „Alle".
 * - **Self-action row** directly under the meta box: neutral before
 *   („Zusagen · Vielleicht · Absagen"), my state after („✓ Zugesagt").
 *   Declining writes `declined` and keeps the record; the same pill again
 *   removes my statement.
 * - **Many:** above the threshold the row summarises per qualifier.
 * - **Task:** only „Übernehmen" in the core; can/learns stays a Karabirrdt
 *   function.
 * - **Statement:** the vote moved from the footer into the action slot — pills
 *   and bar. The card keeps its compact vote bar.
 *
 * Everything here is live against the mock connector: click the pills.
 */
const meta: Meta = {
  id: "rls-items-detail-people",
  title: "RLS/Items/Detail view/People and self-actions",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
}
export default meta

type Story = StoryObj

const attends = (id: string, speaker: string, subject: string, role: "going" | "maybe" | "declined"): Item => ({
  id,
  type: "relation",
  createdAt: "2026-09-10T10:00:00+02:00",
  createdBy: speaker,
  data: { predicate: "attends", role, tense: "coming" },
  relations: [
    { predicate: "from", target: `global:${subject}` },
    { predicate: "to", target: `item:${STORY_EVENT.id}` },
  ],
})

const EVENT: Item = {
  ...STORY_EVENT,
  relations: [
    { predicate: "invited", target: "global:lea" },
    { predicate: "invited", target: "global:noah" },
  ],
}

function Frame({ item, seed, users }: { item: Item; seed: Item[]; users?: User[] }) {
  return (
    <StoryWorld
      trustRecords
      seed={{
        items: [item, ...seed],
        ...(users ? { users, groupMembers: { garden: users.map((u) => u.id), workshop: [] } } : {}),
      }}
    >
      <div className="w-[380px] overflow-hidden rounded-2xl border bg-background shadow-xl">
        <LiveRead id={item.id} />
      </div>
    </StoryWorld>
  )
}

/** Wie der Detail-Host: das Item lebendig aus dem Connector, damit Klicks sichtbar werden. */
function LiveRead({ id }: { id: string }) {
  const { data: item } = useItem(id)
  return item ? <ItemDetailRead item={item} actions={null} groupId="garden" /> : null
}

/** Normal: Jonas said yes himself, Mira (you) entered Noah as „vielleicht", Lea declined. */
export const Event: Story = {
  render: () => (
    <Frame
      item={EVENT}
      seed={[attends("rel-jonas", "jonas", "jonas", "going"), attends("rel-noah", "mira", "noah", "maybe"), attends("rel-lea", "lea", "lea", "declined")]}
    />
  ),
}

const MANY_USERS: User[] = [
  ...STORY_USERS,
  ...["Ada", "Ben", "Cem", "Dora", "Emil", "Fina", "Gus", "Hana", "Ivo", "Jule", "Kai", "Lina"].map((name, i) => ({
    id: `p${i}`,
    displayName: `${name} Muster`,
    avatarUrl: `https://randomuser.me/api/portraits/${i % 2 ? "men" : "women"}/${10 + i}.jpg`,
  })),
]

/** Many: above the threshold the row reads „10 zugesagt · 3 vielleicht · 2 eingeladen · Alle". */
export const Many: Story = {
  render: () => (
    <Frame
      item={{ ...EVENT, relations: [{ predicate: "invited", target: "global:lea" }, { predicate: "invited", target: "global:noah" }] }}
      users={MANY_USERS}
      seed={MANY_USERS.slice(4).map((u, i) => attends(`rel-m${i}`, u.id, u.id, i < 9 ? "going" : "maybe")).concat(attends("rel-mira", "mira", "mira", "going"))}
    />
  ),
}

/** Task: „Übernehmen" puts you into the assignment; then „✓ Übernommen · Erledigt", both toggles (see Links and lists). */
export const Task: Story = {
  render: () => <Frame item={STORY_TASK} seed={[]} />,
}

const STATEMENT: Item = {
  id: "statement-garten",
  type: "statement",
  createdAt: "2026-09-08T10:00:00+02:00",
  createdBy: "jonas",
  data: { title: "Wir öffnen den Garten einmal im Monat für die Nachbarschaft.", description: "Ein fester Sonntag, offene Tür, Kaffee." },
}

/** Statement: pills and bar in the action slot, directly under the head. */
export const Statement: Story = {
  render: () => <Frame item={STATEMENT} seed={[]} />,
}
