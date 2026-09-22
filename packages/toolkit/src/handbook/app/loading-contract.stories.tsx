import type { Meta, StoryObj } from "@storybook/react-vite"
import { List } from "lucide-react"
import { itemTypes, registerModuleHint } from "@real-life-stack/data-interface"

import { hostFiltersFor, useModuleHost } from "../../components/host/module-host"
import type { ModuleEntry, ModuleViewProps } from "../../lib/module-register"
import { ProbeWorld } from "../../story-support/probe-world"

/**
 * **The loading contract** (spec 01, "the loading contract"): `presents` says
 * what a module can show — as **hints**. A hint is a field (`start`,
 * `position`, `status`) or a class with an affordance (`statement`), and the
 * hint table in `data-interface` knows both directions: item → hint (routing,
 * notifications) and hint → connector filter (the host loads).
 *
 * Four rules, all visible here:
 *
 * 1. **One table, open.** A hint of your own (`resource`) registers itself with
 *    both directions — that is how the network app's marketplace does it.
 * 2. **The connector loads coarsely, the module decides finely.** The filter
 *    checks presence (`hasField`), never values.
 * 3. **Several hints are a union.** One query per hint, never "load everything
 *    and filter locally".
 * 4. **Whoever loads itself says so** (`loads: "module"`): the host issues no
 *    query — the map loads by viewport.
 *
 * Pick below what the entry promises and see what the host asks for and what
 * arrives. The search above applies on top — rule 2a.
 */
try {
  registerModuleHint("resource", {
    test: (item) => itemTypes(item).includes("resource"),
    filter: () => ({ type: ["resource"] }),
  })
} catch {
  // Beim Neuladen der Story ist die Zeile schon da — die Tabelle lehnt Dubletten ab.
}

function LoadingProbe({ items = [] }: ModuleViewProps) {
  const { entry } = useModuleHost()
  const filter = hostFiltersFor(entry)
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 text-sm">
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Entry</div>
        <code>presents: {JSON.stringify(entry.presents ?? [])}{entry.loads ? `, loads: "${entry.loads}"` : ""}</code>
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">The host asks the connector</div>
        {filter === null ? (
          <p>no query — the module loads itself</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">{filter.map((f, i) => <li key={i}><code>{JSON.stringify(f)}</code></li>)}</ol>
        )}
        {filter && filter.length > 1 && <p className="mt-2 text-muted-foreground">{filter.length} queries, united by id.</p>}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">What arrives ({items.length})</div>
        <ul className="space-y-1">{items.map((i) => <li key={i.id}>{String(i.data.title ?? i.id)} <span className="text-muted-foreground">· {itemTypes(i).join(", ")}</span></li>)}</ul>
        {items.length === 0 && <p className="text-muted-foreground">nothing — either no item matches, or the module loads itself</p>}
      </div>
    </div>
  )
}

const entry = (presents: string[] | undefined, loads?: "module"): ModuleEntry => ({
  id: "probe", label: "Probe", icon: List, presents, loads, options: { suggestType: presents?.[0] === "start" ? "event" : "post" }, view: LoadingProbe,
})

const meta: Meta = {
  id: "rls-app-04-loading-contract",
  title: "RLS/App/04 The loading contract",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}
export default meta

/** One hint: `presents: ["start"]` → `hasField: ["start"]` → the events. */
export const OneHint: StoryObj = { name: "One hint: start", render: () => <ProbeWorld entry={entry(["start"])} /> }
/** Two hints are OR: two queries, the union — events and places. */
export const TwoHints: StoryObj = { name: "Two hints: start + position", render: () => <ProbeWorld entry={entry(["start", "position"])} /> }
/** Without `presents` the module aggregates: everything that stands as a card of its own — no comments, no reactions. */
export const Aggregating: StoryObj = { name: "Without presents: aggregating", render: () => <ProbeWorld entry={entry(undefined)} /> }
/** A hint of the app's own: `resource` is a class, not a field — the table knows both directions. */
export const OwnHint: StoryObj = { name: "Own hint: resource", render: () => <ProbeWorld entry={entry(["resource"])} /> }
/** `loads: "module"`: the host stays silent, the module loads itself (the map, by viewport). */
export const LoadsItself: StoryObj = { name: "loads: module", render: () => <ProbeWorld entry={entry(["position"], "module")} /> }
