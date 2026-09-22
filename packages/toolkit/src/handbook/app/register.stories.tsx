import { useMemo, useState, type ReactNode } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Store } from "lucide-react"

import { Button } from "../../components/primitives/button"
import { TOOLKIT_DEFINITION, composeModules, type ModuleExtension } from "../../lib/module-register"

/**
 * **The register** (spec 01, "module register"): which modules exist is said
 * by exactly one list — composed from contributions, the toolkit's first,
 * then the app's. An app **defines** modules of its own and **extends**
 * existing ones; it may replace a field only explicitly (`replaces`, rule 2).
 * A conflict is an error at start-up, never a silent override.
 *
 * The list is kept nowhere a second time: tabs, routes, notifications,
 * "a field leads to its view" — all of them read `getModules()`. Which modules
 * a space **carries** is stored in `Group.data.modules`, in its order.
 *
 * Below, the register is composed live. The contributions are those of the
 * network app: the marketplace as a module of its own, map and calendar with
 * options of their own.
 */
const Dummy = () => null

const MARKETPLACE: ModuleExtension = {
  name: "network",
  definitions: [{ id: "marketplace", label: "Marktplatz", icon: Store, presents: ["resource"], options: { suggestType: "resource" }, view: Dummy }],
}
const mapOptions = (replaces: boolean): ModuleExtension => ({
  name: "network",
  extensions: [{ id: "map", options: { suggestType: "place", initialView: { center: [12.4066, 52.1183], zoom: 16 } }, ...(replaces ? { replaces: ["options"] } : {}) }],
})

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function Register() {
  const [withMarketplace, setMarketplace] = useState(true)
  const [withMap, setMap] = useState(true)
  const [explicit, setExplicit] = useState(true)
  const result = useMemo(() => {
    const contributions: ModuleExtension[] = [TOOLKIT_DEFINITION]
    if (withMarketplace) contributions.push(MARKETPLACE)
    if (withMap) contributions.push(mapOptions(explicit))
    try {
      return { register: composeModules(contributions), error: null as string | null }
    } catch (e) {
      return { register: null, error: (e as Error).message }
    }
  }, [withMarketplace, withMap, explicit])
  const toolkit = composeModules([TOOLKIT_DEFINITION])

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={withMarketplace ? "default" : "outline"} onClick={() => setMarketplace((v) => !v)}>define marketplace</Button>
        <Button size="sm" variant={withMap ? "default" : "outline"} onClick={() => setMap((v) => !v)}>app's map options</Button>
        <Button size="sm" variant={explicit ? "default" : "outline"} onClick={() => setExplicit((v) => !v)} disabled={!withMap}>
          {explicit ? "with replaces: [\"options\"]" : "without replaces"}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Column title="contribution “toolkit”">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {toolkit.map((m) => (
              <li key={m.id}><code>{m.id}</code> — {m.label}{m.presents?.length ? <span className="text-muted-foreground"> · presents {JSON.stringify(m.presents)}</span> : null}</li>
            ))}
          </ol>
        </Column>
        <Column title="composed: toolkit + network">
          {result.register ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {result.register.map((m) => (
                <li key={m.id}>
                  <code>{m.id}</code> — {m.label}
                  {m.id === "marketplace" && <span className="text-muted-foreground"> · defined by the app</span>}
                  {m.id === "map" && withMap && <span className="text-muted-foreground"> · options replaced: {JSON.stringify(m.options)}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <pre className="whitespace-pre-wrap rounded-md bg-destructive/10 p-3 text-xs text-destructive">{result.error}</pre>
          )}
        </Column>
      </div>
      <p className="text-sm text-muted-foreground">
        Register order = tab order; a space reorders for itself by storing <code>data.modules</code> in its own order. A module this app does not know stays stored and simply gets no tab. (The error text is German: it is the message the register throws at start-up.)
      </p>
    </div>
  )
}

const meta: Meta<typeof Register> = {
  id: "rls-app-02-register",
  title: "RLS/App/02 The register",
  component: Register,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
}
export default meta
type Story = StoryObj<typeof Register>
export const Default: Story = { name: "Compose, extend, replace" }
