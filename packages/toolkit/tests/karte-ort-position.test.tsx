// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { projectMapInventory } from "../src/components/map/map-view"
import { scopesAcrossSpaces } from "../src/lib/item-targets"

/** Ohne Spaces: ein Bereich. */
const NONE = scopesAcrossSpaces(undefined)
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
    const shown = withPlacePosition(AM_ORT, places, NONE)
    expect(shown.data.position).toEqual(HALLE.data.position)
    expect(AM_ORT.data.position).toBeUndefined()
  })

  it("eine eigene Position gewinnt; ein fehlender Ort und ein Typ ohne Ort-Feld bleiben, wie sie sind", () => {
    const places = new Map([[HALLE.id, HALLE]])
    expect(withPlacePosition(EIGEN, places, NONE)).toBe(EIGEN)
    expect(withPlacePosition(WEG, places, NONE)).toBe(WEG)
    expect(withPlacePosition(POST, places, NONE)).toBe(POST)
  })

  it("Codex R8: nur ein Ort des richtigen Typs im richtigen Space", () => {
    const places = new Map([[HALLE.id, HALLE]])
    const spaceOf = (id: string) => (id === "pl-halle" ? "g" : id === "ev-fremd" ? "anders" : "g")
    // Space-qualifiziert auf einen anderen Space: kein Treffer.
    const qualifiziert = item("ev-q", "event", { title: "Q" }, [{ predicate: "locatedAt", target: "space:anders/item:pl-halle" }])
    expect(withPlacePosition(qualifiziert, places, scopesAcrossSpaces(spaceOf)).data.position).toBeUndefined()
    // Lokales Target aus einem anderen Space: kein Treffer.
    const fremd = item("ev-fremd", "event", { title: "F" }, [{ predicate: "locatedAt", target: "item:pl-halle" }])
    expect(withPlacePosition(fremd, places, scopesAcrossSpaces(spaceOf)).data.position).toBeUndefined()
    // Gleiche Id, falscher Typ: kein Treffer.
    const aufgabe = item("pl-halle", "task", { title: "T", position: point(1, 1) })
    expect(withPlacePosition(AM_ORT, new Map([[aufgabe.id, aufgabe]]), NONE).data.position).toBeUndefined()
    // Richtig: gleicher Space.
    expect(withPlacePosition(AM_ORT, places, scopesAcrossSpaces(spaceOf)).data.position).toEqual(HALLE.data.position)
  })

  it("Codex R9/1: die Ort-Kante gilt über alle Klassen, unabhängig von ihrer Reihenfolge", () => {
    const places = new Map([[HALLE.id, HALLE]])
    const a = { ...AM_ORT, type: ["post", "event"] } as unknown as Item
    const b = { ...AM_ORT, type: ["event", "post"] } as unknown as Item
    expect(withPlacePosition(a, places, NONE).data.position).toEqual(HALLE.data.position)
    expect(withPlacePosition(b, places, NONE).data.position).toEqual(HALLE.data.position)
  })

  it("Codex R9/2, R10, R11 als Vertrag: das Inventar ist eine Projektion aus Abfrage und Ableitung", () => {
    // Ausschnitt A: der Ort ist in der Abfrage, das Event kommt abgeleitet dazu.
    expect(projectMapInventory([HALLE], locatedPositions([AM_ORT], [HALLE], NONE)).map((i) => i.id)).toEqual(["pl-halle", "ev-ort"])
    // Nach B: weder Ort noch Event (keine Akkumulation).
    expect(projectMapInventory([], locatedPositions([AM_ORT], [], NONE))).toEqual([])
    // Ein Event mit eigener Position bei A, dann an einen Ort in B umgestellt: nur die Ableitung.
    const lebend = item("ev-x", "event", { title: "X" }, [{ predicate: "locatedAt", target: "item:pl-halle" }])
    const shown = projectMapInventory([HALLE], locatedPositions([lebend], [HALLE], NONE))
    expect(shown.find((i) => i.id === "ev-x")!.data.position).toEqual(HALLE.data.position)
    // Kante entfernt: kein Marker, auch kein alter.
    expect(projectMapInventory([HALLE], locatedPositions([{ ...lebend, relations: [] }], [HALLE], NONE)).map((i) => i.id)).toEqual(["pl-halle"])
  })

  it("locatedPositions: nur Items, deren Ort in der Menge liegt", () => {
    const shown = locatedPositions([AM_ORT, EIGEN, WEG, POST], [HALLE], NONE)
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
