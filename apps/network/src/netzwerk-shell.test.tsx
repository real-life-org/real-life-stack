// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { RouterProvider, createMemoryRouter } from "react-router-dom"
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

// Unter einem Data-Router, wie in `main.tsx` — der Guard vor Entwurfsverlust braucht ihn.
async function rendere(pfad: string) {
  const router = createMemoryRouter([{ path: "*", element: createElement(App, { connector }) }], { initialEntries: [pfad] })
  await act(async () => { root.render(createElement(RouterProvider, { router })) })
  // Register, Gruppen und Items kommen über Observables an — einen Tick warten.
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
  return router
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

describe("Schutz vor Entwurfsverlust (Codex-Befund rls#429)", () => {
  const tippe = (input: HTMLInputElement, wert: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    setter.call(input, wert)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  }
  const dialog = () => document.body.textContent?.includes("Änderungen verwerfen?") ?? false

  it("fragt nach, bevor Abbrechen einen begonnenen Entwurf verwirft, und warnt vor dem Neuladen", async () => {
    const router = await rendere("/dwebcamp/collection?compose=task")
    const titel = document.body.querySelector<HTMLInputElement>("input[placeholder=\"Titel\"]")
    expect(titel, "Composer mit Titelfeld offen").toBeTruthy()
    await act(async () => { tippe(titel!, "Ungespeicherter Entwurf") })

    const reload = new Event("beforeunload", { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented, "Neuladen wird abgefangen").toBe(true)

    const abbrechen = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Abbrechen")
    expect(abbrechen, "Abbrechen-Knopf").toBeTruthy()
    await act(async () => { abbrechen!.click() })
    expect(dialog(), "Rueckfrage erscheint").toBe(true)
    expect(router.state.location.search).toContain("compose=task")

    const verwerfen = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Verwerfen")
    await act(async () => { verwerfen!.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(router.state.location.search).not.toContain("compose")
    expect(dialog()).toBe(false)
  })

  it("laesst einen unberuehrten Composer ohne Rueckfrage schliessen", async () => {
    const router = await rendere("/dwebcamp/collection?compose=task")
    const abbrechen = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Abbrechen")
    await act(async () => { abbrechen!.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(dialog()).toBe(false)
    expect(router.state.location.search).not.toContain("compose")
  })
})
