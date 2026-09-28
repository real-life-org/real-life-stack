// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { useItem } from "../src/hooks/use-items"
import { FormEpochProvider } from "../src/lib/form-epoch"
import { resolveTypePresentation } from "../src/components/preview/type-presentation"
import { LocationWidget } from "../src/components/composer/widgets/location-widget"
import { AvatarField } from "../src/components/composer/widgets/avatar-widget"
import { useItemWithPlacePosition } from "../src/components/map/place-position"
import { projectSpaceGraph } from "../src/components/graph/project-space-graph"
import { itemHasBindings } from "../src/lib/item-bindings"

/**
 * Struktur-Runde 1 (Codex, Befunde nach Klassen): Klasse A (asynchrone
 * Arbeit überlebt den Stand) und Klasse B (Regeln nachgebaut statt benutzt),
 * geschlossen über die Bausteine — Formular-Epoche und Auflöser.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const item = (id: string, type: string, data: Record<string, unknown>, relations: Item["relations"] = []): Item =>
  ({ id, type, createdBy: ME, createdAt: "2026-09-20T10:00:00.000Z", data, relations }) as Item

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})
async function settle(ms = 10) {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((r) => setTimeout(r, ms)))
}

function connectorWith(items: Item[], groups = [{ id: "g", name: "G", data: {} }, { id: "h", name: "H", data: {} }]) {
  return new MockConnector(
    {
      items,
      groups,
      users: [{ id: ME, displayName: "Ich" }],
      groupMembers: Object.fromEntries(groups.map((g) => [g.id, [ME]])),
      groupItems: { g: items.map((i) => i.id) },
    } as never,
    { allowFixtureAuthors: true },
  )
}

// ---------------------------------------------------------------------------
// Klasse A

describe("Klasse A: Selbstaktion — Frisch-Lesen und alle Wartezeiten unter der Epoche", () => {
  function Live({ id }: { id: string }): ReactNode {
    const { data: it } = useItem(id)
    if (!it) return null
    const Actions = resolveTypePresentation("task").actions!
    return createElement(Actions, { item: it })
  }

  it("Frisch-Lesen verzögert, Panel abgebaut und Space gewechselt: kein Schreiben", async () => {
    const T = item("t1", "task", { title: "Kompost", status: "open" })
    const connector = connectorWith([T])
    await connector.init()
    connector.setCurrentGroup("g")
    let release!: () => void
    const getItem = connector.getItem.bind(connector)
    connector.getItem = async (id: string) => {
      await new Promise<void>((r) => (release = r))
      return getItem(id)
    }
    const update = vi.spyOn(connector, "updateItem")
    await act(async () => root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Live, { id: "t1" }))))
    await settle()
    const take = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Übernehmen")!
    await act(async () => take.click())
    await act(async () => root.render(createElement("div")))
    connector.setCurrentGroup("h")
    await act(async () => release())
    await settle()
    expect(update).not.toHaveBeenCalled()
  })

  it("Folgeaktion: Warten auf „stehe ich noch dran“, dann Space gewechselt: kein Schreiben", async () => {
    const T = item("t2", "task", { title: "Beet", status: "in-progress" }, [{ predicate: "assignedTo", target: `global:${ME}` }])
    const connector = connectorWith([T])
    await connector.init()
    connector.setCurrentGroup("g")
    await act(async () => root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Live, { id: "t2" }))))
    await settle()
    // Ab jetzt hält das frische Lesen an: der Space wechselt dazwischen.
    let release!: () => void
    const getItem = connector.getItem.bind(connector)
    connector.getItem = async (id: string) => {
      const found = await getItem(id)
      await new Promise<void>((r) => (release = r))
      return found
    }
    const update = vi.spyOn(connector, "updateItem")
    const done = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Erledigt")!
    await act(async () => done.click())
    connector.setCurrentGroup("h")
    await act(async () => release())
    await settle()
    expect(update).not.toHaveBeenCalled()
  })
})

describe("Klasse A: Debounce und Beschäftigt-Zustand gehören zur Epoche", () => {
  it("Geocoding: Space-Wechsel während der Wartezeit — die alte Suche startet nicht", async () => {
    const geocode = vi.fn(async () => [{ label: "Alt 1", lat: 1, lng: 1 }])
    let setSpace!: (s: string) => void
    function Form(): ReactNode {
      const [space, set] = useState("g")
      setSpace = set
      return createElement(FormEpochProvider, { scope: [space] }, createElement(LocationWidget, { label: "Ort", value: {}, onChange: () => undefined, geocode }))
    }
    await act(async () => root.render(createElement(Form)))
    const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Markt")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => setSpace("h"))
    await settle(150)
    expect(geocode).not.toHaveBeenCalled()
    expect(host.querySelector('[role="option"]')).toBeNull()
  })

  it("Avatar: Space-Wechsel während des Verkleinerns — das Feld ist wieder frei, das Ergebnis verworfen", async () => {
    let finish!: (v: string) => void
    const resize = vi.fn(() => new Promise<string>((r) => (finish = r)))
    const onChange = vi.fn()
    let setSpace!: (s: string) => void
    function Form(): ReactNode {
      const [space, set] = useState("g")
      setSpace = set
      return createElement(FormEpochProvider, { scope: [space] }, createElement(AvatarField, { label: "Bild", value: "", onChange, resize }))
    }
    await act(async () => root.render(createElement(Form)))
    const file = host.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(file, "files", { value: [new File(["x"], "a.png", { type: "image/png" })] })
    await act(async () => file.dispatchEvent(new Event("change", { bubbles: true })))
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Bild hochladen"]')!.disabled).toBe(true)
    await act(async () => setSpace("h"))
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Bild hochladen"]')!.disabled).toBe(false)
    await act(async () => finish("data:image/webp;base64,ALT"))
    await settle()
    expect(onChange).not.toHaveBeenCalled()
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Bild hochladen"]')!.disabled).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Klasse B

describe("Klasse B: Ziele nur über den Auflöser", () => {
  it("Fokus: ein qualifiziertes Ort-Target liefert die Position des Ortes", async () => {
    const ORT = item("ort", "place", { title: "Ort", position: { type: "Point", coordinates: [13.4, 52.5] } })
    const EV = item("ev", "event", { title: "E" }, [{ predicate: "locatedAt", target: "space:g/item:ort" }])
    const connector = connectorWith([ORT, EV])
    await connector.init()
    connector.setCurrentGroup("g")
    let seen: Item | null | undefined
    function Spy(): ReactNode {
      seen = useItemWithPlacePosition(EV)
      return null
    }
    await act(async () => root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Spy))))
    await settle()
    expect(seen!.data.position).toEqual(ORT.data.position)
  })

  it("Graph: kein lokales Ziel in einem anderen Space, kein Ziel vom falschen Typ", () => {
    const ort = item("ort", "place", { title: "Ort" })
    const aufgabe = item("ort2", "task", { title: "Keine Stätte" })
    const ev = item("ev", "event", { title: "E" }, [
      { predicate: "locatedAt", target: "item:ort" },
      { predicate: "locatedAt", target: "item:ort2" },
    ])
    const spaces: Record<string, string> = { ev: "g", ort: "h", ort2: "g" }
    const graph = projectSpaceGraph([ort, aufgabe, ev], [], [], (t) => t, { resolveItemSpace: (id) => spaces[id] ?? null })
    expect(graph.edges.filter((e) => e.predicate === "locatedAt")).toEqual([])
    const sameSpace = projectSpaceGraph([ort, ev], [], [], (t) => t, { resolveItemSpace: (id) => (id === "ort" || id === "ev" ? "g" : null) })
    expect(sameSpace.edges.map((e) => e.targetId)).toEqual(["item:ort"])
  })

  it("Bindungen: ein qualifiziertes Target auf einen anderen Space bindet das lokale Item nicht", () => {
    const X = item("x", "task", { title: "X" })
    const fremd = item("y", "task", { title: "Y" }, [{ predicate: "blocks", target: "space:anders/item:x" }])
    expect(itemHasBindings(X, [X, fremd], "g")).toBe(false)
    const hier = item("z", "task", { title: "Z" }, [{ predicate: "blocks", target: "space:g/item:x" }])
    expect(itemHasBindings(X, [X, hier], "g")).toBe(true)
  })
})
