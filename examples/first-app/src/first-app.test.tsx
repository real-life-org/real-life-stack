// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { RouterProvider, createMemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MockConnector } from "@real-life-stack/mock-connector"

import { App } from "./App"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal("ResizeObserver", ResizeObserverStub)

/**
 * Das Beispiel aus dem Handbuch („Erste App bauen") läuft gegen die
 * öffentlichen Exporte der Pakete: derselbe Seed wie in main.tsx, derselbe
 * Rahmen — ohne eine Zeile Modul-Code in der App.
 */
let host: HTMLDivElement
let root: Root
let connector: MockConnector

beforeEach(async () => {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host)
  connector = new MockConnector({
    users: [{ id: "mira", displayName: "Mira" }],
    groups: [{ id: "garten", name: "Gemeinschaftsgarten", data: { modules: ["calendar", "map", "collection"] } }],
    groupMembers: { garten: ["mira"] },
    items: [{ id: "erntefest", type: "event", createdBy: "mira", createdAt: "2026-09-01T10:00:00Z", data: { title: "Erntefest", start: "2026-09-26T14:00:00+02:00" } }],
    groupItems: { garten: ["erntefest"] },
  })
  await connector.init()
  connector.setCurrentGroup("garten")
})
afterEach(() => { act(() => root.unmount()); host.remove() })

async function rendere(pfad: string) {
  const router = createMemoryRouter([{ path: "*", element: createElement(App, { connector }) }], { initialEntries: [pfad] })
  await act(async () => { root.render(createElement(RouterProvider, { router })) })
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
  return router
}

describe("Erste App auf dem Rahmen", () => {
  it("zeigt die Module des Space als Tabs und das Item in der Liste", async () => {
    await rendere("/garten/collection")
    const text = host.textContent ?? ""
    for (const label of ["Kalender", "Karte", "Liste"]) expect(text, `Tab ${label}`).toContain(label)
    // Die Liste ist virtualisiert: unter jsdom zählt sie ihre Zeilen, statt sie zu malen.
    const liste = host.querySelector("[data-virtualizer-item-count]")
    expect(liste, "Liste gerendert").toBeTruthy()
    expect(Number(liste!.getAttribute("data-virtualizer-item-count"))).toBe(1)
  })

  it("öffnet das Item über die Adresse", async () => {
    const router = await rendere("/garten/collection/erntefest")
    expect(router.state.location.pathname).toBe("/garten/collection/erntefest")
    expect(document.body.textContent).toContain("Erntefest")
  })
})
