// @vitest-environment jsdom
/**
 * Hell oder dunkel entscheidet der Mensch, nicht der Space. Die App legt
 * dafuer die Klasse `dark` auf das Wurzelelement — und mehr als eine Stelle
 * muss wissen, was gerade gilt: die Token-Schicht der App und der
 * Space-Dialog, der eine Vorschau der Skala zeigt.
 *
 * Darum liegt das Lesen im Toolkit und nicht in der App.
 */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { useColorScheme } from "../src/hooks/use-color-scheme"

let root: Root
let host: HTMLDivElement

const Probe = () => {
  const scheme = useColorScheme()
  return <span data-testid="scheme">{scheme}</span>
}

const shown = () => document.querySelector('[data-testid="scheme"]')?.textContent

beforeEach(() => {
  document.documentElement.classList.remove("dark")
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  document.documentElement.classList.remove("dark")
})

describe("useColorScheme", () => {
  it("liest das Schema beim ersten Rendern", () => {
    document.documentElement.classList.add("dark")
    act(() => { root.render(<Probe />) })
    expect(shown()).toBe("dark")
  })

  it("faellt ohne Klasse auf hell zurueck", () => {
    act(() => { root.render(<Probe />) })
    expect(shown()).toBe("light")
  })

  it("zieht nach, wenn jemand waehrenddessen umschaltet", async () => {
    // Der MutationObserver meldet im naechsten Microtask, nicht sofort.
    const settle = async () => { await act(async () => { await Promise.resolve() }) }

    act(() => { root.render(<Probe />) })
    expect(shown()).toBe("light")

    document.documentElement.classList.add("dark")
    await settle()
    expect(shown()).toBe("dark")

    document.documentElement.classList.remove("dark")
    await settle()
    expect(shown()).toBe("light")
  })
})
