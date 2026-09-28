// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { reconcileMapInventory, withDerivedItems } from "../src/components/map/map-view"
import { locatedPositions, useItemWithPlacePosition, useLocatedItems, withPlacePosition } from "../src/components/map/place-position"

/**
 * S4b, Antwort 2 von Anton: Die Karte liest die Position eines Events vom
 * verknüpften Ort-Item (`locatedAt`), ohne sie am Event zu speichern —
 * abgeleitet und reaktiv: bewegt sich der Ort, folgt das Event.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const item = (id: string, type: string, data: Record<string, unknown>, relations: Item["relations"] = []): Item => ({
  id,
  type,
  createdBy: ME,
  createdAt: "2026-09-20T10:00:00.000Z",
  data,
  relations,
})
const point = (lng: number, lat: number) => ({ type: "Point", coordinates: [lng, lat] })

const HALLE = item("pl-halle", "place", { title: "Halle", position: point(13.4, 52.5) })
const AM_ORT = item("ev-ort", "event", { title: "Am Ort" }, [{ predicate: "locatedAt", target: "item:pl-halle" }])
const EIGEN = item("ev-eigen", "event", { title: "Eigene Position", position: point(10, 50) }, [{ predicate: "locatedAt", target: "item:pl-halle" }])
const WEG = item("ev-weg", "event", { title: "Ort fehlt" }, [{ predicate: "locatedAt", target: "item:weg" }])
const POST = item("post-1", "post", { content: "kein Ort" }, [{ predicate: "locatedAt", target: "item:pl-halle" }])

describe("withPlacePosition (rein)", () => {
  it("ein Event ohne Position übernimmt die Position seines Ort-Items, ohne das Item zu ändern", () => {
    const places = new Map([[HALLE.id, HALLE]])
    const shown = withPlacePosition(AM_ORT, places)
    expect(shown.data.position).toEqual(HALLE.data.position)
    expect(AM_ORT.data.position).toBeUndefined()
  })

  it("eine eigene Position gewinnt; ein fehlender Ort und ein Typ ohne Ort-Feld bleiben, wie sie sind", () => {
    const places = new Map([[HALLE.id, HALLE]])
    expect(withPlacePosition(EIGEN, places)).toBe(EIGEN)
    expect(withPlacePosition(WEG, places)).toBe(WEG)
    expect(withPlacePosition(POST, places)).toBe(POST)
  })

  it("Codex R8: nur ein Ort des richtigen Typs im richtigen Space", () => {
    const places = new Map([[HALLE.id, HALLE]])
    const spaceOf = (id: string) => (id === "pl-halle" ? "g" : id === "ev-fremd" ? "anders" : "g")
    // Space-qualifiziert auf einen anderen Space: kein Treffer.
    const qualifiziert = item("ev-q", "event", { title: "Q" }, [{ predicate: "locatedAt", target: "space:anders/item:pl-halle" }])
    expect(withPlacePosition(qualifiziert, places, spaceOf).data.position).toBeUndefined()
    // Lokales Target aus einem anderen Space: kein Treffer.
    const fremd = item("ev-fremd", "event", { title: "F" }, [{ predicate: "locatedAt", target: "item:pl-halle" }])
    expect(withPlacePosition(fremd, places, spaceOf).data.position).toBeUndefined()
    // Gleiche Id, falscher Typ: kein Treffer.
    const aufgabe = item("pl-halle", "task", { title: "T", position: point(1, 1) })
    expect(withPlacePosition(AM_ORT, new Map([[aufgabe.id, aufgabe]])).data.position).toBeUndefined()
    // Richtig: gleicher Space.
    expect(withPlacePosition(AM_ORT, places, spaceOf).data.position).toEqual(HALLE.data.position)
  })

  it("Codex R9/1: die Ort-Kante gilt über alle Klassen, unabhängig von ihrer Reihenfolge", () => {
    const places = new Map([[HALLE.id, HALLE]])
    const a = { ...AM_ORT, type: ["post", "event"] } as unknown as Item
    const b = { ...AM_ORT, type: ["event", "post"] } as unknown as Item
    expect(withPlacePosition(a, places).data.position).toEqual(HALLE.data.position)
    expect(withPlacePosition(b, places).data.position).toEqual(HALLE.data.position)
  })

  it("Codex R9/2: abgeleitete Items gehen nie ins bbox-Inventar; ohne Kante verschwinden sie sofort", () => {
    const bboxA: [number, number, number, number] = [13, 52, 14, 53]
    const bboxB: [number, number, number, number] = [0, 0, 1, 1]
    // Ausschnitt A: nur der Ort ist Inventar, das Event kommt abgeleitet dazu.
    let inventory = reconcileMapInventory(new Map(), [HALLE], false, bboxA, "bbox-module")
    const derivedA = locatedPositions([AM_ORT], [...inventory.values()])
    expect(withDerivedItems([...inventory.values()], derivedA).map((i) => i.id)).toEqual(["pl-halle", "ev-ort"])
    // Nach B schwenken: der Ort bleibt im Inventar (bbox-Aufbewahrung), das Event nicht.
    inventory = reconcileMapInventory(inventory, [], false, bboxB, "bbox-module")
    expect([...inventory.keys()]).toEqual(["pl-halle"])
    // Kante entfernt: keine Ableitung mehr, kein Marker.
    const ohneKante = { ...AM_ORT, relations: [] }
    expect(withDerivedItems([...inventory.values()], locatedPositions([ohneKante], []))).toEqual([HALLE])
  })

  it("locatedPositions: nur Items, deren Ort in der Menge liegt", () => {
    const shown = locatedPositions([AM_ORT, EIGEN, WEG, POST], [HALLE])
    expect(shown.map((i) => i.id)).toEqual(["ev-ort"])
  })
})

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

async function settle() {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((r) => setTimeout(r, 10)))
}

describe("useLocatedItems (reaktiv)", () => {
  it("die geladenen Orte ziehen ihre Events mit; bewegt sich der Ort, folgt das Event", async () => {
    const connector = new MockConnector(
      {
        items: [HALLE, AM_ORT, WEG],
        groups: [{ id: "g", name: "G", data: {} }],
        users: [{ id: ME, displayName: "Ich" }],
        groupMembers: { g: [ME] },
        groupItems: { g: [HALLE.id, AM_ORT.id, WEG.id] },
      } as never,
      { allowFixtureAuthors: true },
    )
    await connector.init()
    connector.setCurrentGroup("g")
    let result: Item[] = []
    function Spy({ loaded }: { loaded: Item[] }): ReactNode {
      result = useLocatedItems(loaded)
      return null
    }
    const draw = async (loaded: Item[]) => {
      await act(async () => {
        root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Spy, { loaded })))
      })
      await settle()
    }
    await draw([HALLE])
    expect(result.map((i) => i.id)).toEqual(["ev-ort"])
    expect(result[0]!.data.position).toEqual(point(13.4, 52.5))

    const moved = { ...HALLE, data: { ...HALLE.data, position: point(11, 48) } }
    await draw([moved])
    expect(result.find((i) => i.id === "ev-ort")!.data.position).toEqual(point(11, 48))
    // Das gespeicherte Event trägt keine Position.
    expect((await connector.getItem("ev-ort"))!.data.position).toBeUndefined()
  })

  it("Fokus: folgt dem Ort, wenn er im Connector bewegt wird", async () => {
    const connector = new MockConnector(
      {
        items: [HALLE, AM_ORT],
        groups: [{ id: "g", name: "G", data: {} }],
        users: [{ id: ME, displayName: "Ich" }],
        groupMembers: { g: [ME] },
        groupItems: { g: [HALLE.id, AM_ORT.id] },
      } as never,
      { allowFixtureAuthors: true },
    )
    await connector.init()
    connector.setCurrentGroup("g")
    let focused: Item | null | undefined
    function Spy(): ReactNode {
      focused = useItemWithPlacePosition(AM_ORT)
      return null
    }
    await act(async () => {
      root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Spy)))
    })
    await settle()
    expect(focused!.data.position).toEqual(point(13.4, 52.5))
    await act(async () => {
      await connector.updateItem(HALLE.id, { data: { ...HALLE.data, position: point(9, 49) } })
    })
    await settle()
    expect(focused!.data.position).toEqual(point(9, 49))
  })
})
