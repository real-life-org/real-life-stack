// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MockConnector, type MockConnectorSeed } from "@real-life-stack/mock-connector"

import App from "./App"
import "./module-register"
import { buildDwebCampSeedItems } from "./data/network-seed"
import { NETWORK_RELATION_STORE_OPTIONS } from "./data/network-relation-predicates"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal("ResizeObserver", ResizeObserverStub)

/**
 * Die Netzwerk-App ist eine Shell um den Modul-Host: Was sie zeigt, kommt aus
 * dem Register und dem Space — nicht aus einer Liste in der App.
 */
const SEED: MockConnectorSeed = {
  items: [],
  groups: [
    { id: "dwebcamp", name: "DWebCamp", data: { modules: ["graph", "collection", "kanban", "calendar", "map", "marketplace"] } },
    { id: "privat", name: "Privat", data: { scope: "personal", modules: ["collection"] } },
  ],
  users: [{ id: "ich", displayName: "Ich" }],
  groupMembers: { dwebcamp: ["ich"], privat: ["ich"] },
  groupItems: { dwebcamp: [], privat: [] },
}

let host: HTMLDivElement
let root: Root
let connector: MockConnector

async function rendere(pfad: string) {
  await act(async () => {
    root.render(createElement(MemoryRouter, { initialEntries: [pfad] }, createElement(App, { connector })))
  })
  // Register, Gruppen und Items kommen über Observables an — einen Tick warten.
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
}

beforeEach(async () => {
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host)
  connector = new MockConnector(SEED, { symmetricRelationPredicates: NETWORK_RELATION_STORE_OPTIONS.symmetricPredicates, allowFixtureAuthors: true })
  await connector.init()
  connector.injectSeedItems(await buildDwebCampSeedItems(), "dwebcamp")
  connector.setCurrentGroup("dwebcamp")
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const tabs = () => [...host.querySelectorAll("[role=tablist] [role=tab], nav a, nav button")].map((el) => el.textContent?.trim()).filter(Boolean)

describe("Netzwerk-Shell auf dem Modul-Host", () => {
  it("zeigt die Module des Space aus dem Register — in seiner Reihenfolge, mit dem Marktplatz", async () => {
    await rendere("/dwebcamp/marketplace")
    const labels = tabs()
    for (const label of ["Graph", "Liste", "Kanban", "Kalender", "Karte", "Marktplatz"]) {
      expect(labels, `Tab ${label}`).toContain(label)
    }
    expect(labels.indexOf("Graph")).toBeLessThan(labels.indexOf("Marktplatz"))
  })

  it("der Marktplatz bekommt vom Host nur Ressourcen", async () => {
    await rendere("/dwebcamp/marketplace")
    const liste = host.querySelector("[data-virtualizer-item-count]")
    expect(liste, "Liste des Marktplatzes gerendert").toBeTruthy()
    const resources = (await connector.getItems({ type: ["resource"] })).length
    expect(resources).toBeGreaterThan(0)
    expect(Number(liste!.getAttribute("data-virtualizer-item-count"))).toBe(resources)
  })

  it("ein Space ohne Marktplatz zeigt keinen", async () => {
    await rendere("/privat/collection")
    expect(tabs()).not.toContain("Marktplatz")
  })
})
