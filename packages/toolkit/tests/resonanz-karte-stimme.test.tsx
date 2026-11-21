// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life/data-interface"
import { MockConnector } from "@real-life/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { FilterProvider } from "../src/components/filter/filter-store"
import { MemoryFocusProvider } from "../src/hooks/use-item-focus"
import { CreateHostProvider } from "../src/components/host/create-host"
import { DetailHostProvider } from "../src/components/host/detail-host"
import { ModuleHost } from "../src/components/host/module-host"
import { getModule } from "../src/lib/module-register"

/**
 * #520 (Loop-Review zu #518): Die Stimme zog im DETAIL nach `actions`; die
 * Karten im Resonanzmodul behalten ihre Stimmleiste (06, Regel 17 —
 * Karten nehmen renderTypeCardFooter). Das echte Modul im echten Modul-Host,
 * wie in modul-host.test.tsx.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

const STATEMENT: Item = {
  id: "s1",
  type: "statement",
  createdBy: "u-me",
  createdAt: "2026-09-20T10:00:00.000Z",
  data: { title: "Wir öffnen den Garten" },
}

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe("Resonanzmodul: Karten behalten die Stimmleiste (#520)", () => {
  it("zeigt auf der Karte die VoteBar", async () => {
    const connector = new MockConnector({
      items: [STATEMENT],
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: "u-me", displayName: "Ich" }],
      groupMembers: { g: ["u-me"] },
      groupItems: { g: ["s1"] },
    } as never)
    await connector.init()
    connector.setCurrentGroup("g")
    const entry = getModule("resonance")!
    await act(async () => {
      root.render(
        createElement(ConnectorProvider, { connector: connector as never },
          createElement(FilterProvider, null,
            createElement(MemoryFocusProvider, { module: entry.id },
              createElement(DetailHostProvider, null,
                createElement(CreateHostProvider, null,
                  createElement(ModuleHost, { entry, groupId: "g", active: true })))))),
      )
    })
    for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
    expect(host.textContent).toContain("Wir öffnen den Garten")
    // VoteBar: je Stufe ein Knopf, der erste „Zustimmung…"
    expect(host.querySelectorAll('[aria-label^="Zustimmung"]').length).toBe(1)
  })
})
