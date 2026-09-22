import type { Meta, StoryObj } from "@storybook/react-vite"

import { useCreate } from "../../components/host/create-host"
import { useModulePanel } from "../../components/module-panel/module-panel"
import { Button } from "../../components/primitives/button"
import { useItemFocus } from "../../hooks/use-item-focus"
import { HostWorld } from "../../story-support/host-world"
import { STORY_EVENT, STORY_TASK } from "../../story-support/story-world"

const BAR = "pointer-events-auto fixed bottom-2 left-32 right-24 z-[60] rounded-lg border bg-background/95 px-4 py-2 text-sm shadow-lg backdrop-blur"

/**
 * **The focus** (spec 01, "the module host"): which item is open, whether it
 * is being edited, whether something is being created. The contract is one
 * (`useItemFocus`), the storage is not: in an app with a router the focus
 * lives in the **URL** — `/{space}/{module}/{item}`, `?edit`, `?comment`,
 * `?compose=` — so that back in the browser closes the panel and a link leads
 * to the item. Without a router (story, test) `MemoryFocusProvider` holds the
 * same contract in memory.
 *
 * The bar at the bottom shows **which address** the state would have in an
 * app. Click a card, "edit" in the panel, the plus button, a module switch:
 * every time the line changes — and in the app, the URL.
 *
 * Rule: a module calls `focusItem(id)` and `focusItem(id, "calendar")` (module
 * and item in **one** step); it holds no selection state of its own.
 */
function AddressBar() {
  const f = useItemFocus()
  const params = new URLSearchParams()
  if (f.isEditing) params.set("edit", "1")
  if (f.isCommenting) params.set("comment", "1")
  if (f.composeType) params.set("compose", f.composeType)
  const q = params.toString()
  const url = `/${f.scope ?? "?"}/${f.module ?? "?"}${f.itemId ? `/${f.itemId}` : ""}${q ? `?${q}` : ""}`
  return (
    <div className={BAR}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="text-muted-foreground">In the app the URL would now be</span>
        <code className="rounded bg-muted px-2 py-0.5 font-mono text-[13px]">{url}</code>
        <span className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => f.focusItem(STORY_EVENT.id)}>open event</Button>
          <Button size="sm" variant="outline" onClick={() => f.focusItem(STORY_TASK.id, "kanban")}>task in kanban</Button>
          <Button size="sm" variant="outline" onClick={() => f.editItem()} disabled={!f.itemId}>edit</Button>
          <Button size="sm" variant="outline" onClick={() => f.startCompose("event")}>create: event</Button>
          <Button size="sm" variant="ghost" onClick={() => (f.composeType ? f.stopCompose() : f.clearFocus())}>let go</Button>
        </span>
      </div>
    </div>
  )
}

/**
 * **The panel**: detail, create (as a sheet), activity and settings share
 * **one** panel per app (`ModulePanelProvider`). Content is swapped, not
 * stacked: one z-level, one drawer on the phone. `panelFit: "overlay"` (map,
 * graph) leaves out the backdrop so the surface stays movable. A module never
 * opens the panel for an item itself — it sets the focus, the detail host
 * opens.
 */
function PanelBar() {
  const panel = useModulePanel()
  const { startCreate, isComposing } = useCreate()
  const f = useItemFocus()
  return (
    <div className={BAR}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="text-muted-foreground">The panel currently shows</span>
        <code className="rounded bg-muted px-2 py-0.5 font-mono text-[13px]">{panel.current ? `${panel.current.kind}${panel.current.itemId ? ` · ${panel.current.itemId}` : ""}` : "nothing"}</code>
        <span className="text-muted-foreground">· create open: {String(isComposing)}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => f.focusItem(STORY_EVENT.id)}>detail: event</Button>
          <Button size="sm" variant="outline" onClick={() => startCreate("task")}>create: task</Button>
          <Button size="sm" variant="ghost" onClick={() => panel.close()}>close panel</Button>
        </span>
      </div>
    </div>
  )
}

/**
 * **Create**: the plus button offers **all** types of the space in every
 * module; a module suggests one (`options.suggestType`) and prefills fields
 * (the calendar the date), it never restricts (rule 3). `createShell` picks
 * sheet or fullscreen (the feed). A module with an entry point of its own
 * reports it (`setCreateAnchor`) and the plus button steps back while that is
 * in view (the feed's pill). Whoever leaves the form with input is asked by
 * the guard.
 *
 * Switch the tabs below and open the plus button: the suggestion follows the
 * module, the menu stays the same.
 */
function CreateBar() {
  const { startCreate, patchCreate, isComposing } = useCreate()
  return (
    <div className={BAR}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="text-muted-foreground">useCreate(): isComposing = {String(isComposing)}</span>
        <span className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => startCreate("event", { start: "2026-10-03T15:00" })}>event on 3 Oct, 15:00</Button>
          <Button size="sm" variant="outline" onClick={() => startCreate("place")}>place</Button>
          <Button size="sm" variant="outline" onClick={() => patchCreate({ title: "Erntedank" })} disabled={!isComposing}>prefill title</Button>
        </span>
      </div>
    </div>
  )
}

const meta: Meta = {
  id: "rls-app-05-focus-panel-create",
  title: "RLS/App/05 Focus, panel, create",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}
export default meta

export const Focus: StoryObj = { name: "The focus — and its address", render: () => <HostWorld module="feed"><AddressBar /></HostWorld> }
export const Panel: StoryObj = { name: "The one panel", render: () => <HostWorld module="calendar"><PanelBar /></HostWorld> }
export const Create: StoryObj = { name: "Create: suggestion, not a fence", render: () => <HostWorld module="kanban"><CreateBar /></HostWorld> }
