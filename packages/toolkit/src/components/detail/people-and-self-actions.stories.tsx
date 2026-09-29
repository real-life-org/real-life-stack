import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item, User } from "@real-life-stack/data-interface"

import { useEffect, type ReactNode } from "react"

import { ItemDetailRead } from "../host/detail-host"
import { registerTypePresentation } from "../preview/type-presentation"
import { EXAMPLE_LEARNING_LAYER } from "../../story-support/example-learning-layer"
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
 * - **Task:** „Übernehmen" when nobody is assigned, „Mitmachen" when others
 *   are; then „✓ Übernommen" (alone) or „✓ Dabei" (with others) · „Erledigt".
 *   Joining an open task sets it to „In Arbeit"; the last person leaving a
 *   task in progress sets it back to open (spec 06, rule 19). A done task
 *   shows only states. The core allows `role` on `assignedTo` but declares no
 *   values; a module's register layer brings them with labels and its own
 *   pills (rule 20) — see „Task with a module layer".
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

/** Task with Lea assigned: „Mitmachen"; then „✓ Dabei · Erledigt". */
export const Task: Story = {
  render: () => <Frame item={STORY_TASK} seed={[]} />,
}

/** Task nobody took yet: „Übernehmen" sets it to „In Arbeit"; „✓ Übernommen" again gives it back and reopens it. */
export const TaskAlone: Story = {
  render: () => <Frame item={{ ...STORY_TASK, id: "task-allein", relations: [] }} seed={[]} />,
}

const LEARNS_TASK: Item = {
  ...STORY_TASK,
  id: "task-lernt",
  data: { ...STORY_TASK.data, status: "in-progress" },
  relations: [{ predicate: "assignedTo", target: "global:lea", meta: { role: "learns" } }, { predicate: "assignedTo", target: "global:jonas" }],
}

/** Without a module layer the core knows no `role` values: the row reads „Lea“, the value is kept untouched. */
export const TaskRoleWithoutLayer: Story = {
  render: () => <Frame item={LEARNS_TASK} seed={[]} />,
}

/**
 * Registers the example layer only while this story is shown. The register is
 * module-global, so the story stays out of the docs page (its own iframe) and
 * on unmount empties only its own layer, never others.
 */
function WithExampleLayer({ children }: { children: ReactNode }) {
  registerTypePresentation("beispiel", { extensions: [EXAMPLE_LEARNING_LAYER] })
  useEffect(() => () => registerTypePresentation("beispiel", {}), [])
  return <>{children}</>
}

/** Task with a module layer (example): „Lea lernt“, pills „Kann ich · Will lernen“ instead of „Mitmachen“. */
export const TaskWithModuleLayer: Story = {
  tags: ["!autodocs"],
  render: () => (
    <WithExampleLayer>
      <Frame item={LEARNS_TASK} seed={[]} />
    </WithExampleLayer>
  ),
}

/**
 * The example layer with a default (spec 06, rules 7 and 20): an edge without
 * a value counts as `can`. The row keeps saying „Jonas“ (the default needs no
 * word), and my state reads „✓ Kann“ although my edge carries no `role`.
 */
const WITH_DEFAULT = {
  ...EXAMPLE_LEARNING_LAYER,
  qualifierValues: [{ ...EXAMPLE_LEARNING_LAYER.qualifierValues![0]!, default: "can" }],
}

function WithDefaultLayer({ children }: { children: ReactNode }) {
  registerTypePresentation("beispiel", { extensions: [WITH_DEFAULT] })
  useEffect(() => () => registerTypePresentation("beispiel", {}), [])
  return <>{children}</>
}

/** Task with a module layer that sets a default: „Lea lernt · Jonas · Mira“, my pill „✓ Kann“ pressed. */
export const TaskWithLayerDefault: Story = {
  tags: ["!autodocs"],
  render: () => (
    <WithDefaultLayer>
      <Frame item={{ ...LEARNS_TASK, id: "task-standard", relations: [...(LEARNS_TASK.relations ?? []), { predicate: "assignedTo", target: "global:mira" }] }} seed={[]} />
    </WithDefaultLayer>
  ),
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
