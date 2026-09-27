// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"
import { ConnectorProvider } from "../src/hooks/connector-context"
import { MemoryFocusProvider } from "../src/hooks/use-item-focus"

/**
 * #520 (Loop-Review zu #518): Die Stimme zog im DETAIL nach `actions`; die
 * Karten im Resonanzmodul behalten ihre Stimmleiste (06, Regel 17 —
 * Karten nehmen renderTypeCardFooter).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("../src/components/host/module-host", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/host/module-host")>()),
  useModuleHost: () => ({
    resolveAuthor: () => undefined,
    resolveItemGroupColor: () => "#000",
    activeItemId: undefined,
    filterActive: false,
    registerItemElement: () => {},
  }),
}))

const { ResonanceModule } = await import("../src/modules/resonance-module")

const STATEMENT: Item = {
  id: "s1",
  type: "statement",
  createdBy: "u-me",
  createdAt: "2026-09-20T10:00:00.000Z",
  data: { title: "Wir öffnen den Garten" },
}

let root: ReturnType<typeof createRoot> | null = null
afterEach(async () => {
  if (root) await act(async () => root!.unmount())
  root = null
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
    const host = document.createElement("div")
    root = createRoot(host)
    await act(async () => {
      root!.render(
        createElement(ConnectorProvider, { connector: connector as never },
          createElement(MemoryFocusProvider, null, createElement(ResonanceModule, { items: [STATEMENT], itemsLoading: false } as never))),
      )
    })
    for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
    // VoteBar: Knopf je Stufe mit aria-label „Zustimmung…"
    expect(host.querySelectorAll('[aria-label^="Zustimmung"]').length).toBe(1)
  })
})
