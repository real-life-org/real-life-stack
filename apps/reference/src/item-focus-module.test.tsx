// @vitest-environment jsdom
import { act, createElement, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ItemFocusProvider, useItemFocus } from "./hooks/use-item-focus"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Ein Feld führt zu der Sicht, die es darstellen kann: das Datum in den
 * Kalender, der Ort auf die Karte. Beides in EINER Navigation — sonst liest
 * der zweite Schritt noch das alte Modul.
 *
 * Genau das ging schief: erst `handleModuleChange("calendar")`, dann
 * `focusItem(id)`. Der Modulwechsel war zu diesem Zeitpunkt noch nicht in der
 * Route angekommen, also schrieb `focusItem` `/network/feed/event-1` und
 * machte den Wechsel rückgängig. Aus einer geöffneten Detailansicht fiel das
 * nicht auf, weil dort ohnehin schon das Item in der Route stand.
 */
let host: HTMLDivElement
let root: Root
let pfad = ""

function Sonde({ tun }: { tun: (focus: ReturnType<typeof useItemFocus>) => void }) {
  const focus = useItemFocus()
  const location = useLocation()
  pfad = `${location.pathname}${location.search}`
  useEffect(() => {
    tun(focus)
    // Genau einmal, beim Mounten — danach nur noch beobachten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

async function laufe(start: string, tun: (focus: ReturnType<typeof useItemFocus>) => void) {
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [start] },
        createElement(ItemFocusProvider, null, createElement(Sonde, { tun })),
      ),
    )
  })
}

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  pfad = ""
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe("Fokus mit Zielmodul", () => {
  it("wechselt Modul und Item in einem Schritt", async () => {
    await laufe("/network/feed", (focus) => focus.focusItem("event-1", "calendar"))
    expect(pfad).toBe("/network/calendar/event-1")
  })

  it("bleibt im aktuellen Modul, wenn keines genannt wird", async () => {
    await laufe("/network/feed", (focus) => focus.focusItem("event-1"))
    expect(pfad).toBe("/network/feed/event-1")
  })

  it("wechselt auch, wenn schon ein anderes Item offen ist", async () => {
    await laufe("/network/feed/event-9", (focus) => focus.focusItem("event-1", "map"))
    expect(pfad).toBe("/network/map/event-1")
  })

  it("lässt andere Abfrageparameter stehen und wirft `edit` weg", async () => {
    await laufe("/network/feed/event-9?edit=1&connector=mock", (focus) =>
      focus.focusItem("event-1", "calendar"),
    )
    expect(pfad).toBe("/network/calendar/event-1?connector=mock")
  })
})
