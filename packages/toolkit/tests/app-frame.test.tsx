// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MockConnector } from "@real-life/mock-connector"
import type { DataInterface } from "@real-life/data-interface"
import { Sparkles } from "lucide-react"

import { AppFrame, type FrameRouting } from "../src/components/frame/app-frame"
import { useCreate } from "../src/components/host/create-host"
import { useModulePanel } from "../src/components/module-panel/module-panel"
import { ConnectorProvider, useConnector } from "../src/hooks/connector-context"
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
  return connector
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

  it("traegt den Umschalter hell/dunkel aus dem Toolkit — beide Signale (rls#568)", async () => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
    await rendere(createElement(AppFrame, { routing: routing() }))
    const schalter = host.querySelector("[aria-label='Dunkles Design']") as HTMLButtonElement
    expect(schalter, "Umschalter in der Kopfzeile").toBeTruthy()
    await act(async () => { schalter.click() })
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    document.documentElement.classList.remove("dark")
    document.documentElement.removeAttribute("data-theme")
    localStorage.clear()
  })

  it("reicht App-Abschnitte an den Space-Dialog durch (rls#551)", async () => {
    const spaceSections = [{ id: "traum", label: "Traum", icon: Sparkles, render: () => createElement("p", { "data-testid": "traum" }, "Traum-Flaeche") }]
    await rendere(createElement(AppFrame, { routing: routing(), spaceSections, spaceSectionsTitle: "Karabirrdt" }))
    const switcher = host.querySelector("[data-slot='dropdown-menu-trigger'], [aria-haspopup='menu']") as HTMLElement
    await act(async () => {
      switcher.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
      switcher.click()
    })
    const bearbeiten = document.querySelector("[aria-label='Gartenprojekt bearbeiten']") as HTMLElement
    await act(async () => { bearbeiten.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    const traum = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.startsWith("Traum")) as HTMLElement
    expect(traum, "App-Abschnitt im Menue").toBeTruthy()
    await act(async () => { traum.click() })
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("Traum-Flaeche")
  })

  it("reicht die Group live in den offenen Space-Dialog: Daten und Name aus dem Connector kommen an", async () => {
    const spaceSections = [{ id: "traum", label: "Traum", icon: Sparkles, render: ({ group }: { group: { data?: Record<string, unknown> } }) => createElement("p", { "data-testid": "traum" }, String(group.data?.dream ?? "—")) }]
    const connector = await rendere(createElement(AppFrame, { routing: routing(), spaceSections }))
    const switcher = host.querySelector("[data-slot='dropdown-menu-trigger'], [aria-haspopup='menu']") as HTMLElement
    await act(async () => {
      switcher.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }))
      switcher.click()
    })
    await act(async () => { (document.querySelector("[aria-label='Gartenprojekt bearbeiten']") as HTMLElement).click() })
    const traum = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.startsWith("Traum")) as HTMLElement
    await act(async () => { traum.click() })
    expect(document.querySelector("[data-testid='traum']")?.textContent).toBe("—")
    await act(async () => { await connector.updateGroup("garten", { name: "Garten Nord", data: { dream: "live" } }) })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(document.querySelector("[data-testid='traum']")?.textContent, "Daten live").toBe("live")
    expect((document.querySelector("[role=dialog] input:not([type=file])") as HTMLInputElement).value, "Name live").toBe("Garten Nord")
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

  it("behaelt Connector und Daten ueber den Modulwechsel (rls#431)", async () => {
    // Der Modul-Tab liegt als Zustand UEBER der Story-Huelle; die darf darum
    // ihren Connector nicht je Render neu erzeugen — sonst ist nach jedem
    // Tabwechsel alles weg, was die Story geschrieben hat.
    let gesehen: DataInterface | null = null
    function Sonde() { gesehen = useConnector(); return null }
    await act(async () => { root.render(createElement(HostWorld, { module: "feed" }, createElement(Sonde))) })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    const vorher = gesehen!
    const angelegt = await (vorher as MockConnector).createItem({ id: "post-neu", type: "post", createdBy: "mira", data: { title: "Neu" } } as never)
    expect(angelegt).toBeTruthy()
    const liste = [...host.querySelectorAll("button, [role=tab], a")].find((el) => el.textContent?.trim() === "Liste") as HTMLElement
    await act(async () => { liste.click() })
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(gesehen).toBe(vorher)
    expect(await vorher.getItem("post-neu")).not.toBeNull()
    expect((vorher as MockConnector).getCurrentGroup()?.id).toBe("garden")
  })
})
