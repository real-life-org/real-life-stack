// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { List } from "lucide-react"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { FilterProvider } from "../src/components/filter/filter-store"
import { MemoryFocusProvider } from "../src/hooks/use-item-focus"
import { CreateHostProvider } from "../src/components/host/create-host"
import { DetailHostProvider } from "../src/components/host/detail-host"
import { ModuleHost } from "../src/components/host/module-host"
import { useModuleFilter } from "../src/hooks/use-module-filter"
import type { ModuleEntry } from "../src/lib/module-register"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

/**
 * Modul-eigene Filter (spec shared-components → Modul-übergreifender
 * Filter-State, Regel 2): Sie bleiben beim Modul, leben aber so lange wie der
 * geteilte Filter — ein Modulwechsel hin und zurück behält sie.
 */

const NONE: string[] = []
const seen: Record<string, { value: string[]; set: (next: string[]) => void }> = {}

function Probe({ name }: { name: string }) {
  const [value, set] = useModuleFilter<string[]>("people", NONE)
  seen[name] = { value, set }
  return null
}

const entry = (id: string): ModuleEntry => ({ id, label: id, icon: List, view: () => createElement(Probe, { name: id }) })
const connector = new MockConnector({ items: [], groups: [], users: [{ id: "u1", displayName: "Uli" }], groupMembers: {} }, { allowFixtureAuthors: true })

function tree(moduleId: string, withOwner = true): ReactNode {
  const moduleTree = createElement(MemoryFocusProvider, { module: moduleId },
    createElement(DetailHostProvider, null,
      createElement(CreateHostProvider, null,
        createElement(ModuleHost, { key: moduleId, entry: entry(moduleId), groupId: "__overview__", active: true }))))
  return createElement(ConnectorProvider, { connector },
    withOwner ? createElement(FilterProvider, null, moduleTree) : moduleTree)
}

let host: HTMLDivElement
let root: Root
async function show(moduleId: string, withOwner = true) {
  await act(async () => { root.render(tree(moduleId, withOwner)) })
}

beforeEach(async () => {
  await connector.init()
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host)
  for (const key of Object.keys(seen)) delete seen[key]
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe("useModuleFilter", () => {
  it("survives switching to another module and back", async () => {
    await show("resonance")
    await act(async () => { seen.resonance!.set(["anna"]) })
    expect(seen.resonance!.value).toEqual(["anna"])

    await show("kanban")
    expect(seen.kanban!.value).toEqual([])

    await show("resonance")
    expect(seen.resonance!.value).toEqual(["anna"])
  })

  it("keeps each module's value to itself — same key, separate areas", async () => {
    await show("resonance")
    await act(async () => { seen.resonance!.set(["anna"]) })
    await show("kanban")
    await act(async () => { seen.kanban!.set(["bert"]) })
    await show("resonance")
    expect(seen.resonance!.value).toEqual(["anna"])
    await show("kanban")
    expect(seen.kanban!.value).toEqual(["bert"])
  })

  it("without a filter owner it is plain local state", async () => {
    await show("resonance", false)
    await act(async () => { seen.resonance!.set(["anna"]) })
    expect(seen.resonance!.value).toEqual(["anna"])
    await show("kanban", false)
    await show("resonance", false)
    expect(seen.resonance!.value).toEqual([])
  })
})
