// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MockConnector } from "@real-life-stack/mock-connector"

import { AppFrame, type FrameRouting } from "../src/components/frame/app-frame"
import { useCreate } from "../src/components/host/create-host"
import { useModulePanel } from "../src/components/module-panel/module-panel"
import { ConnectorProvider } from "../src/hooks/connector-context"
import { MemoryFocusProvider } from "../src/hooks/use-item-focus"
import { useUnsavedChanges } from "../src/hooks/use-unsaved-changes"
import { getModules } from "../src/lib/module-register"
import { HostWorld } from "../src/story-support/host-world"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal("ResizeObserver", ResizeObserverStub)

/**
 * Der Rahmen einer App (Spec 01, „Was bei der App bleibt"): Provider, Panel,
 * Kopfzeile, Controller und Outlet einmal — fuer Apps und Stories gleich.
 * Bis zum 21.09.2026 zaehlten drei Stellen den Stapel von Hand auf, und was
 * in einer fehlte, fiel nicht auf (rls#429).
 */
let host: HTMLDivElement
let root: Root

const GROUPS = [
  { id: "garten", name: "Gartenprojekt", data: { modules: ["feed", "map"] } },
  { id: "hof", name: "Hofladen", data: { modules: ["collection"] } },
]

function routing(teil: Partial<FrameRouting> = {}): FrameRouting {
  const modules = getModules().filter((m) => ["feed", "map"].includes(m.id)).map((m) => ({ id: m.id, label: m.label, icon: m.icon }))
  return {
    groups: GROUPS,
    workspaces: GROUPS.map((g) => ({ id: g.id, name: g.name })),
    activeWorkspace: { id: "garten", name: "Gartenprojekt" },
    activeModule: "feed",
    modules,
    handleWorkspaceChange: () => {},
    handleModuleChange: () => {},
    goTo: () => {},
    goHome: () => {},
    ...teil,
  }
}

async function rendere(node: ReactNode) {
  const connector = new MockConnector(
    { items: [], groups: GROUPS, users: [{ id: "u1", displayName: "Uli" }], groupMembers: { garten: ["u1"], hof: ["u1"] }, groupItems: { garten: [], hof: [] } },
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("garten")
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector }, createElement(MemoryFocusProvider, { module: "feed", scope: "garten" }, node)))
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
}
const texte = () => host.textContent ?? ""
const knoepfe = () => [...host.querySelectorAll("button, [role=tab], a")].map((el) => el.textContent?.trim() ?? "")

beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe("AppFrame", () => {
  it("zeigt Space, Tabs aus dem Routing und die Flaeche des aktiven Moduls", async () => {
    await rendere(createElement(AppFrame, { routing: routing() }))
    expect(texte()).toContain("Gartenprojekt")
    expect(knoepfe()).toContain("Feed")
    expect(knoepfe()).toContain("Karte")
    expect(knoepfe()).not.toContain("Kanban")
    // Der Host haengt den Plusknopf an — die Flaeche laeuft.
    expect(host.querySelector("[aria-label='Erstellen']"), "Plusknopf des Hosts").toBeTruthy()
  })

  it("stellt Kindern alle Provider — Panel, Erstellen-Host, Ungespeichert", async () => {
    let gesehen: { panel: boolean; create: boolean; unsaved: boolean } | null = null
    function Sonde() {
      gesehen = { panel: !!useModulePanel(), create: !!useCreate(), unsaved: !!useUnsavedChanges() }
      return null
    }
    await rendere(createElement(AppFrame, { routing: routing() }, createElement(Sonde)))
    expect(gesehen).toEqual({ panel: true, create: true, unsaved: true })
  })

  it("sagt ohne Zugang, was los ist, und fuehrt nach Hause", async () => {
    const goHome = vi.fn()
    await rendere(createElement(AppFrame, { routing: routing({ activeWorkspace: null, urlSpaceId: "fremd", goHome }) }))
    expect(texte()).toContain("kein Mitglied dieses Spaces")
    const zurueck = [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Zurück"))
    await act(async () => { zurueck!.click() })
    expect(goHome).toHaveBeenCalledTimes(1)
  })

  it("rendert App-Eigenes in der Kopfzeile und im Baum", async () => {
    await rendere(createElement(AppFrame, { routing: routing(), navbarEnd: createElement("span", { "data-testid": "relay" }, "Relay") }, createElement("div", { "data-testid": "eigen" }, "Eigenes")))
    expect(host.querySelector("[data-testid='relay']")).toBeTruthy()
    expect(host.querySelector("[data-testid='eigen']")).toBeTruthy()
  })
})

describe("HostWorld ist derselbe Rahmen", () => {
  it("zeigt die Module des Registers als Tabs und den Space des Connectors", async () => {
    await act(async () => { root.render(createElement(HostWorld, { module: "feed" })) })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    for (const m of getModules().filter((m) => m.view)) expect(knoepfe(), m.id).toContain(m.label)
    expect(host.querySelector("[aria-label='Erstellen']")).toBeTruthy()
  })
})
