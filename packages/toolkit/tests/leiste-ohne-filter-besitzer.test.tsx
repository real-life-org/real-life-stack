// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ModuleToolbar } from "../src/components/layout/module-toolbar"
import { ModuleSurfaceScope } from "../src/components/layout/module-surface-scope"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const heute = () => createElement("button", { "data-heute": true }, "Heute")

/**
 * real-life-stack#566: In Toolkit 0.1.x rief `ModuleToolbar` selbst
 * `useSharedFilter` und warf ohne `<FilterProvider>`. Seit #407 gehören Suche,
 * Filterkarte und Chips der Fläche; die Leiste liest keinen Filter mehr. Dieser
 * Wächter hält fest, dass sie ohne Besitzer des Filters rendert — ein eigener
 * `FilterScope` um die Leiste allein wäre falsch (filter-store, `FilterScope`:
 * Leiste und Inhalt sähen verschiedene Werte).
 */
describe("ModuleToolbar without a FilterProvider", () => {
  it("renders on its own, with every slot it offers", () => {
    act(() =>
      root.render(
        createElement(ModuleToolbar, {
          trailingActions: heute(),
          chipsExtra: createElement("span", { "data-chip": true }, "Meine"),
          drawerExtra: createElement("div", { "data-drawer": true }, "Ort"),
        }),
      ),
    )
    const leiste = host.querySelector("[data-module-toolbar]")
    expect(leiste?.querySelector("[data-heute]")).not.toBeNull()
    expect(leiste?.querySelector("[data-chip]")).not.toBeNull()
    expect(leiste?.querySelector("[data-drawer]")).not.toBeNull()
  })

  it("reaches the head of a ModuleSurfaceScope, which brings the filter owner along", () => {
    act(() =>
      root.render(createElement(ModuleSurfaceScope, { items: [] }, createElement(ModuleToolbar, { trailingActions: heute() }))),
    )
    expect(host.querySelector("[data-module-head-actions] [data-heute]")).not.toBeNull()
  })
})
