// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import type { DataInterface, Item } from "@real-life/data-interface"
import { MockConnector } from "@real-life/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { ItemDetailPanel } from "../src/components/detail/item-detail-panel"
import { RoutedAppFrame } from "../src/components/router/routed-app-frame"

/**
 * Ein Lese-Connector: nur der Pflichtvertrag (Spec 02) und das Lesen von
 * Beziehungen — kein Schreiben, keine Spaces, keine Anmeldung. Der Rahmen
 * leitet aus den FEHLENDEN Capabilities ab, was er nicht anbietet (Spec 03,
 * „UI und Hooks dürfen optionale Fähigkeiten nur nach einem Type-Guard
 * nutzen"; Anton, 06.11.2026: eine Lese-App mit einem Space).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal("ResizeObserver", ResizeObserverStub)

const LESEN_BASIS = [
  "init", "dispose", "getItems", "getItem", "observe", "observeItem",
  "getRelatedItems", "observeRelatedItems",
  "getRelationRecords", "observeRelationRecords", "getRelationNeighbors", "observeRelationNeighbors",
]
const LESEN = new Set(LESEN_BASIS)
/** Dazu das Nachschlagen von Personen (UserLookup) — weiter ohne Anmeldung. */
const LESEN_MIT_NAMEN = new Set([...LESEN_BASIS, "getUser"])

/** Derselbe Connector, reduziert auf seine Lese-Fähigkeiten. */
function nurLesend(connector: DataInterface, erlaubt: ReadonlySet<string> = LESEN): DataInterface {
  return new Proxy(connector, {
    has: (target, key) => (typeof key === "string" && typeof Reflect.get(target, key) === "function" ? erlaubt.has(key) : key in target),
    get: (target, key) => {
      const value = Reflect.get(target, key, target)
      if (typeof value !== "function") return value
      return typeof key === "string" && erlaubt.has(key) ? value.bind(target) : undefined
    },
  }) as DataInterface
}

const PROJEKT: Item = { id: "p-garten", type: "project", createdBy: "u-me", createdAt: "2026-11-06T10:00:00.000Z", data: { title: "Gemeinschaftsgarten" } }

let host: HTMLDivElement
let root: Root
let connector: MockConnector

async function settle() {
  for (let round = 0; round < 5; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

async function render(node: ReactNode, data: DataInterface) {
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: data as never }, node))
  })
  await settle()
}

const kommentarFeld = () => host.querySelector("textarea, input[placeholder*='Kommentar']")

beforeEach(async () => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  connector = new MockConnector(
    {
      items: [PROJEKT],
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: "u-me", displayName: "Ich" }],
      groupMembers: { g: ["u-me"] },
      groupItems: { g: [PROJEKT.id] },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("g")
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe("Lese-Connector: das Detail bietet kein Kommentieren an", () => {
  it("mit schreibendem Connector steht das Kommentarfeld unter dem Item", async () => {
    await render(createElement(ItemDetailPanel, { itemId: PROJEKT.id }, createElement("p", null, "Garten")), connector)
    expect(kommentarFeld()).not.toBeNull()
  })

  it("ohne isWritable gibt es kein Kommentarfeld — ein Kommentar ist ein neues Item", async () => {
    await render(createElement(ItemDetailPanel, { itemId: PROJEKT.id }, createElement("p", null, "Garten")), nurLesend(connector))
    expect(host.textContent).toContain("Garten")
    expect(kommentarFeld()).toBeNull()
  })
})

describe("Lese-Connector: ein Space, kein Umschalter", () => {
  const rahmen = () => createElement(RouterProvider, {
    router: createMemoryRouter([{ path: "*", element: createElement(RoutedAppFrame, { fallbackModule: "collection" }) }], { initialEntries: ["/"] }),
  })
  // Menue-Ausloeser ausser „Weitere Navigation" der mobilen Modulleiste.
  const umschalter = () => [...host.querySelectorAll("[aria-haspopup='menu']")].find((el) => el.getAttribute("aria-label") !== "Weitere Navigation") ?? null

  it("mit Gruppen steht der Space-Umschalter in der Kopfzeile", async () => {
    await render(rahmen(), connector)
    expect(umschalter()).not.toBeNull()
  })

  it("ohne hasGroups: kein Umschalter, kein „Mein Netzwerk“, kein „Neue Gruppe“ — der Name der App", async () => {
    document.title = "Weave"
    await render(rahmen(), nurLesend(connector))
    expect(umschalter()).toBeNull()
    expect(host.textContent).not.toContain("Mein Netzwerk")
    expect(host.textContent).not.toContain("Neue Gruppe")
    expect(host.querySelector("header, nav")?.textContent ?? host.textContent).toContain("Weave")
  })
})

describe("Lese-Connector: Urheber ohne Gruppen und ohne Anmeldung", () => {
  const rahmen = () => createElement(RouterProvider, {
    router: createMemoryRouter([{ path: "*", element: createElement(RoutedAppFrame, { fallbackModule: "collection" }) }], { initialEntries: [`/network/collection/${PROJEKT.id}`] }),
  })

  it("ohne getUser bleibt der Urheber unbekannt", async () => {
    await render(rahmen(), nurLesend(connector))
    expect(host.textContent).toContain("Gemeinschaftsgarten")
    expect(host.textContent).toContain("Unbekannt")
  })

  it("mit getUser (UserLookup) steht der Name des Urhebers im Detail", async () => {
    await render(rahmen(), nurLesend(connector, LESEN_MIT_NAMEN))
    expect(host.textContent).toContain("Gemeinschaftsgarten")
    expect(host.textContent).toContain("Ich")
    expect(host.textContent).not.toContain("Unbekannt")
  })
})
