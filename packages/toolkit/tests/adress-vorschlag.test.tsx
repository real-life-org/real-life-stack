// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { LocationWidget } from "../src/components/composer/widgets/location-widget"
import type { GeocodeResult } from "../src/lib/geocode"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const treffer: GeocodeResult[] = [
  {
    label: "Rainwiesenweg 14a, 90571 Schwaig bei Nürnberg",
    detail:
      "14a, Rainwiesenweg, Sophienpark, Behringersdorf, Schwaig bei Nürnberg, Landkreis Nürnberger Land, Bayern, 90571, Deutschland",
    lat: 49.51,
    lng: 11.19,
  },
]

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  vi.useFakeTimers()
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

/** Tippt in das Adressfeld und laesst die Suche (entprellt) laufen. */
async function tippe(onChange: ReturnType<typeof vi.fn>, geocode: GeocodeResult[]) {
  const feld = host.querySelector("input")!
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!
  await act(async () => {
    setzer.call(feld, "Rainwiesenweg")
    feld.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await act(async () => {
    vi.advanceTimersByTime(500)
    await Promise.resolve()
    await Promise.resolve()
  })
  void onChange
  void geocode
}

/**
 * Gespeichert wird die kurze Adresse; die lange steht in der Auswahl, damit
 * zwei gleichnamige Strassen unterscheidbar bleiben.
 */
describe("Der Adress-Vorschlag", () => {
  it("zeigt die kurze Form oben und die lange klein darunter", async () => {
    const onChange = vi.fn()
    act(() => {
      root.render(
        createElement(LocationWidget, {
          value: { address: "" },
          onChange,
          geocode: async () => treffer,
        }),
      )
    })
    await tippe(onChange, treffer)

    const eintrag = host.querySelector("[role=option]")!
    expect(eintrag.textContent).toContain("Rainwiesenweg 14a, 90571 Schwaig bei Nürnberg")
    expect(eintrag.textContent).toContain("Landkreis Nürnberger Land")
  })

  it("speichert die kurze Form, nicht die lange", async () => {
    const onChange = vi.fn()
    act(() => {
      root.render(
        createElement(LocationWidget, {
          value: { address: "" },
          onChange,
          geocode: async () => treffer,
        }),
      )
    })
    await tippe(onChange, treffer)

    await act(async () => {
      host.querySelector<HTMLButtonElement>("[role=option] button")!.click()
    })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ address: "Rainwiesenweg 14a, 90571 Schwaig bei Nürnberg" }),
    )
  })

  it("zeigt nur eine Zeile, wenn beide Formen gleich sind", async () => {
    const onChange = vi.fn()
    const gleich: GeocodeResult[] = [
      { label: "Berlin, Deutschland", detail: "Berlin, Deutschland", lat: 52.5, lng: 13.4 },
    ]
    act(() => {
      root.render(
        createElement(LocationWidget, {
          value: { address: "" },
          onChange,
          geocode: async () => gleich,
        }),
      )
    })
    await tippe(onChange, gleich)

    const eintrag = host.querySelector("[role=option]")!
    expect(eintrag.textContent).toBe("Berlin, Deutschland")
  })
})
