import type { Meta, StoryObj } from "@storybook/react-vite"
import type { Item } from "@real-life-stack/data-interface"

import { ItemDetailRead } from "../host/detail-host"
import { useItem } from "../../hooks/use-items"
import { MemoryFocusProvider, useItemFocus } from "../../hooks/use-item-focus"
import { StoryWorld } from "../../story-support/story-world"

/**
 * **Links, lists and follow-up actions** in the detail view (spec
 * shared-components → „Item-Detail aus dem Register", C2, C3, B15, slot
 * `reverse`; spec 06 → „Feld- und Kantenregister", rules 9, 11, 12, 18).
 *
 * - **Follow-up actions (task):** after „Übernehmen" the row reads
 *   „✓ Übernommen · Erledigt · Abgeben", once done „✓ Erledigt · Wieder
 *   öffnen". Only the person who took the task sees them. „Erledigt" writes
 *   the status value the register marks as done.
 * - **Item links (C3):** one row per predicate with its label from the
 *   register — „Braucht" (incoming `blocks`), „Ermöglicht" (outgoing),
 *   „Teil von" (project). Chips in the target's type colour, a done target
 *   struck through, „+N" when there is no room. A click opens the target in
 *   the same panel.
 * - **Versions (statement):** the named list `family` („Fassungen N") with
 *   „Ausgang"/„Variante", „diese" and a small vote bar; „+ Variante" in the
 *   list head. On the card, „Variante von" is a chip (B15).
 *
 * Everything is live against the mock connector.
 */
const meta: Meta = {
  id: "rls-items-detail-links",
  title: "RLS/Items/Detail view/Links and lists",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
}
export default meta

type Story = StoryObj

const at = (day: number) => `2026-09-${String(day).padStart(2, "0")}T10:00:00+02:00`

const PROJECT: Item = { id: "projekt-garten", type: "project", createdAt: at(1), createdBy: "mira", data: { title: "Gartenprojekt" } }
const BEETPLAN: Item = { id: "task-beetplan", type: "task", createdAt: at(2), createdBy: "jonas", data: { title: "Beetplan für den Herbst", status: "open" } }
const ERNTE: Item = { id: "task-ernte", type: "task", createdAt: at(2), createdBy: "lea", data: { title: "Ernte einholen", status: "done" } }
const SCHUBKARRE: Item = {
  id: "task-schubkarre",
  type: "task",
  createdAt: at(2),
  createdBy: "lea",
  data: { title: "Schubkarre reparieren", status: "open" },
  relations: [{ predicate: "blocks", target: "item:task-kompost" }],
}
const KOMPOST: Item = {
  id: "task-kompost",
  type: "task",
  createdAt: at(3),
  createdBy: "jonas",
  data: { title: "Kompost umsetzen", description: "Den reifen Kompost auf die Beete 1–3 verteilen.", status: "in-progress", start: at(25) },
  relations: [
    { predicate: "assignedTo", target: "global:lea" },
    { predicate: "blocks", target: "item:task-beetplan" },
    { predicate: "blocks", target: "item:task-ernte" },
    { predicate: "partOf", target: "item:projekt-garten" },
  ],
}

const ORIGIN: Item = { id: "st-origin", type: "statement", createdAt: at(4), createdBy: "jonas", data: { title: "Wir öffnen den Garten einmal im Monat." } }
const VARIANT: Item = { id: "st-sonntag", type: "statement", createdAt: at(5), createdBy: "mira", data: { title: "Wir öffnen den Garten jeden Sonntag.", description: "Ein fester Sonntag, offene Tür, Kaffee.", variantOf: "item:st-origin" } }
const VARIANT2: Item = { id: "st-ernte", type: "statement", createdAt: at(6), createdBy: "lea", data: { title: "Wir öffnen den Garten zu Erntefesten.", variantOf: "item:st-origin" } }

function Frame({ start, seed }: { start: string; seed: Item[] }) {
  return (
    <StoryWorld trustRecords seed={{ items: seed }}>
      <MemoryFocusProvider module="kanban" scope="garden">
        <div className="w-[380px] overflow-hidden rounded-2xl border bg-background shadow-xl">
          <Focused start={start} />
        </div>
      </MemoryFocusProvider>
    </StoryWorld>
  )
}

/** Wie der Detail-Host: das fokussierte Item lebendig — ein Klick auf einen Chip tauscht das Detail. */
function Focused({ start }: { start: string }) {
  const { itemId } = useItemFocus()
  const { data: item } = useItem(itemId ?? start)
  return item ? <ItemDetailRead item={item} actions={null} groupId="garden" /> : null
}

const TASKS = [PROJECT, BEETPLAN, ERNTE, SCHUBKARRE, KOMPOST]

/** Task with „Braucht", „Ermöglicht" (one target done) and „Teil von". Take it, then mark it done. */
export const TaskLinks: Story = {
  render: () => <Frame start={KOMPOST.id} seed={TASKS} />,
}

/** Taken by you and done: „✓ Erledigt · Wieder öffnen". */
export const TaskDone: Story = {
  render: () => (
    <Frame
      start={KOMPOST.id}
      seed={[...TASKS.filter((t) => t !== KOMPOST), { ...KOMPOST, data: { ...KOMPOST.data, status: "done" }, relations: [{ predicate: "assignedTo", target: "global:mira" }, ...(KOMPOST.relations ?? []).slice(1)] }]}
    />
  ),
}

/** Statement with versions: „Fassungen 3" and „+ Variante" in the list head. */
export const Versions: Story = {
  render: () => <Frame start={VARIANT.id} seed={[ORIGIN, VARIANT, VARIANT2]} />,
}

/** A single version: the list has nothing besides the item — the action stands alone. */
export const SingleVersion: Story = {
  render: () => <Frame start={ORIGIN.id} seed={[ORIGIN]} />,
}
