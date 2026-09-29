// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import * as toolkit from "../src/index"

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

const rendere = (node: ReactNode) => act(() => root.render(node))

const note = (id: string, title: string): Item =>
  ({ id, type: "note", tags: [], data: { title }, createdAt: "2026-07-01T00:00:00.000Z", createdBy: "u" }) as unknown as Item

const ITEMS = [note("a", "Apfel"), note("b", "Birne")]

/**
 * real-life-stack#558: Eine Fläche außerhalb des Modul-Hosts (das
 * Karabirrdt-Brett) wandte den geteilten Filter selbst an, weil die beiden
 * Hooks nicht aus dem Paket kamen. Sie kommen jetzt aus dem Toolkit-Index.
 */
describe("surface hooks from the package index", () => {
  it("exports useModuleFilteredItems and useSurfaceItems", () => {
    expect(typeof toolkit.useModuleFilteredItems).toBe("function")
    expect(typeof toolkit.useSurfaceItems).toBe("function")
  })

  it("useModuleFilteredItems applies the shared search text under a FilterProvider", () => {
    let setSearch: (text: string) => void = () => {}
    function Brett() {
      const filter = toolkit.useSharedFilter()
      setSearch = filter.setSearchText
      const items = toolkit.useModuleFilteredItems(ITEMS)
      return <ul>{items.map((i) => <li key={i.id}>{String(i.data.title)}</li>)}</ul>
    }
    rendere(<toolkit.FilterProvider><Brett /></toolkit.FilterProvider>)
    expect(host.querySelectorAll("li")).toHaveLength(2)
    act(() => setSearch("birne"))
    expect([...host.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Birne"])
  })

  it("useModuleFilteredItems passes the items through when no FilterProvider owns a filter", () => {
    function Brett() {
      const items = toolkit.useModuleFilteredItems(ITEMS)
      return <ul>{items.map((i) => <li key={i.id}>{String(i.data.title)}</li>)}</ul>
    }
    rendere(<Brett />)
    expect(host.querySelectorAll("li")).toHaveLength(2)
  })

  it("useSurfaceItems reads the filtered items of a ModuleSurfaceScope outside the module host", () => {
    let setSearch: (text: string) => void = () => {}
    function Suche() {
      setSearch = toolkit.useSharedFilter().setSearchText
      return null
    }
    function Brett() {
      const items = toolkit.useSurfaceItems()
      return <ul>{items.map((i) => <li key={i.id}>{String(i.data.title)}</li>)}</ul>
    }
    rendere(
      <toolkit.FilterProvider>
        <Suche />
        <toolkit.ModuleSurfaceScope items={ITEMS}><Brett /></toolkit.ModuleSurfaceScope>
      </toolkit.FilterProvider>,
    )
    expect(host.querySelectorAll("li")).toHaveLength(2)
    act(() => setSearch("apfel"))
    expect([...host.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Apfel"])
  })
})
