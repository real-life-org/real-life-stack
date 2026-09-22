import type { Meta, StoryObj } from "@storybook/react-vite"
import { List } from "lucide-react"

import { useModuleHost } from "../../components/host/module-host"
import type { ModuleEntry, ModuleViewProps } from "../../lib/module-register"
import { HostWorld } from "../../story-support/host-world"
import { ProbeWorld } from "../../story-support/probe-world"

/**
 * **The module host** (spec 01, "the module host"): bind the register, render
 * the host, done. The host is the place that turns a register entry into a
 * running surface — once, for all modules. What it produces, and where it
 * knows it from:
 *
 * | The host … | … from |
 * |---|---|
 * | provides the surface (header, search, vocabulary, filter card, chips) | `fill`, `panelFit`, `maxWidth` |
 * | loads the items and applies the shared filter | `presents` + `options` via the hint table; `loads: "module"` = no query |
 * | resolves the space context (members, authors, colours, overview) | the active space; `__overview__` in exactly one place |
 * | limits aggregating modules to items that stand as a card of their own | `isAggregateVisibleItemType` |
 * | names the active item and whether a filter is active | panel + focus, shared filter state |
 * | scrolls the focused card into view | `registerItemElement` |
 * | registers detail and create | type register: all types, `options.suggestType`, `options.createShell` |
 * | holds the focus | URL (app) or memory (story) |
 *
 * A module receives all of this ready-made via `useModuleHost()` and
 * `ModuleViewProps`; it must not build any of it itself (rule 2). The story
 * "Probe" shows exactly these values live for an artificial entry.
 *
 * This story contains **no line** of module wiring — no `useItems`, no
 * `useRegisterDetail`, no plus button. The map shows the note "no map engine
 * provided" on purpose: the engine is the one line an app writes for the map
 * (`MapLibreAdapterProvider` from `@real-life-stack/toolkit/maplibre`), and it
 * is missing here so that you have seen the note once.
 *
 * Click the event: the host opens the detail in the panel, with edit. Click an
 * empty day: create with "Termin" suggested and the date prefilled — the type
 * menu stays open. The plus button bottom right: the same suggestion, without
 * a date.
 */
function TheModuleHost() {
  return <HostWorld module="calendar" />
}

/** A module that only shows what the host gives it — nothing else. */
function ProbeModule({ items = [], itemsLoading }: ModuleViewProps) {
  const host = useModuleHost()
  const row = (k: string, v: unknown) => (
    <div key={k} className="grid grid-cols-[13rem_minmax(0,1fr)] gap-3 border-b py-1.5 last:border-b-0 text-sm">
      <code className="font-mono text-[13px] text-primary">{k}</code>
      <span className="break-all">{typeof v === "string" ? v : JSON.stringify(v)}</span>
    </div>
  )
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <p className="text-sm text-muted-foreground">Everything below comes from <code>useModuleHost()</code> and the props — the module has not called a single hook to load anything. Type into the search above and watch the items change with it.</p>
      <div className="rounded-xl border bg-card px-4 py-1">
        {row("entry.id / presents / loads", `${host.entry.id} / ${JSON.stringify(host.entry.presents ?? [])} / ${host.entry.loads ?? "host"}`)}
        {row("groupId / isOverview", `${host.groupId} / ${host.isOverview}`)}
        {row("members", host.members.map((m) => m.displayName ?? m.id))}
        {row("currentUser", host.currentUser?.displayName ?? "—")}
        {row("items (filtered)", items.map((i) => i.data.title ?? i.id))}
        {row("itemsLoading", String(itemsLoading))}
        {row("filterActive", String(host.filterActive))}
        {row("activeItemId", host.activeItemId ?? "—")}
        {row("resolveAuthor(items[0].createdBy)", items[0] ? host.resolveAuthor(items[0].createdBy)?.displayName ?? "unknown" : "—")}
      </div>
    </div>
  )
}
const PROBE: ModuleEntry = { id: "probe", label: "Probe", icon: List, presents: ["start"], options: { suggestType: "event" }, view: ProbeModule }

function ProbeInWorld() {
  return <ProbeWorld entry={PROBE} />
}

const meta: Meta<typeof TheModuleHost> = {
  id: "rls-app-03-module-host",
  title: "RLS/App/03 The module host",
  component: TheModuleHost,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof TheModuleHost>

export const Default: Story = { name: "The calendar inside the host" }
/** An entry with `presents: ["start"]`: the host loads events, filters by search, provides members, author, and the plus button suggesting "Termin". */
export const Probe: StoryObj = { name: "Probe: what the host gives", render: () => <ProbeInWorld /> }
