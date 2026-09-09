// @vitest-environment jsdom
import { act, createElement, Fragment } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it, vi } from "vitest"
import { FilterBar } from "../src/components/filter/filter-bar"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

function rendere(chipsExtra: React.ReactNode, tags: string[] = []) {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(
      createElement(FilterBar, {
        value: { tags, types: [] },
        onChange: () => {},
        availableTags: ["garten"],
        chipsExtra,
      }),
    )
  })
  return { host, aufraeumen: () => { act(() => root.unmount()); host.remove() } }
}

/**
 * Die Chip-Zeile steht unter der Bedienzeile mit 8px Luecke. Kanban und
 * Kalender uebergeben `chipsExtra` immer als Fragment, auch wenn darin gerade
 * nichts aktiv ist. Dann darf die Zeile keinen Platz einnehmen — sonst ist
 * die Steuerleiste dort 8px hoeher als im Feed, der kein `chipsExtra` kennt.
 */
describe("FilterBar Chip-Zeile", () => {
  it("nimmt keinen Platz ein, wenn das Fragment nichts rendert", () => {
    const { host, aufraeumen } = rendere(createElement(Fragment, null, false))
    const zeile = host.querySelector("[data-filter-chips]")
    expect(zeile).not.toBeNull()
    expect(zeile!.childNodes.length).toBe(0)
    expect(zeile!.className).toContain("empty:hidden")
    aufraeumen()
  })

  it("zeigt aktive Chips", () => {
    const { host, aufraeumen } = rendere(undefined, ["garten"])
    const zeile = host.querySelector("[data-filter-chips]")
    expect(zeile).not.toBeNull()
    expect(zeile!.childNodes.length).toBeGreaterThan(0)
    aufraeumen()
  })
})
