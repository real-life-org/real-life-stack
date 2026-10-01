// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { asString, locationField, scalarField, type LocationValue } from "../src/components/composer/form-fields"
import { FormHost } from "./support/form-host"
import { LocationWidget } from "../src/components/composer/widgets/location-widget"
import { AvatarField } from "../src/components/composer/widgets/avatar-widget"

/**
 * Struktur-Runde 2 (Klasse A): Warte-Zustände und Sperre gehören dem
 * Baustein (shared-components → Formular-Epoche, Regeln 3 und 4).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

describe("Geocoding-Spinner", () => {
  it("Space-Wechsel NACH dem Start der Anfrage: Spinner weg, Treffer verworfen", async () => {
    let finish!: (v: { label: string; lat: number; lng: number }[]) => void
    const geocode = vi.fn(() => new Promise<{ label: string; lat: number; lng: number }[]>((r) => (finish = r)))
    let setSpace!: (s: string) => void
    function Form(): ReactNode {
      const [space, set] = useState("g")
      setSpace = set
      return createElement(FormHost<LocationValue, never>, { def: locationField("Ort"), space, render: (field) => createElement(LocationWidget, { label: "Ort", field, geocode }) })
    }
    await act(async () => root.render(createElement(Form)))
    const input = host.querySelector<HTMLInputElement>('input[role="combobox"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Markt")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await settle(150)
    expect(geocode).toHaveBeenCalledTimes(1)
    expect(host.querySelector(".animate-spin")).toBeTruthy()
    await act(async () => setSpace("h"))
    expect(host.querySelector(".animate-spin")).toBeNull()
    await act(async () => finish([{ label: "Alt", lat: 1, lng: 1 }]))
    await settle()
    expect(host.querySelector(".animate-spin")).toBeNull()
    expect(host.querySelector('[role="option"]')).toBeNull()
  })
})

describe("Avatar", () => {
  const bild = scalarField("bild", "Bild", asString)

  it("während des Verkleinerns gesperrt: das Ergebnis wird nicht geschrieben, der Grund steht am Feld", async () => {
    let finish!: (v: string) => void
    const resize = vi.fn(() => new Promise<string>((r) => (finish = r)))
    const onChange = vi.fn()
    const draw = (locked: boolean) =>
      act(async () => root.render(createElement(FormHost<string>, { def: bild, locked, onValue: onChange, render: (field) => createElement(AvatarField, { label: "Bild", field, resize }) })))
    await draw(false)
    const file = host.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(file, "files", { value: [new File(["x"], "a.png", { type: "image/png" })] })
    await act(async () => file.dispatchEvent(new Event("change", { bubbles: true })))
    await draw(true)
    await act(async () => finish("data:image/webp;base64,SPAET"))
    await settle()
    expect(onChange).not.toHaveBeenCalled()
    expect(host.querySelector("[data-field-notice]")?.textContent).toContain("Bild nicht übernommen: Das Feld ist gesperrt")
  })

  it("der Schreibweg des Formulars JETZT schreibt, nicht ein beim Start eingefangener", async () => {
    let finish!: (v: string) => void
    const resize = vi.fn(() => new Promise<string>((r) => (finish = r)))
    const alt = vi.fn()
    const neu = vi.fn()
    // Dasselbe Feld, beim Eintreffen mit einer anderen Definition (anderer Schreibweg).
    const def = (onWrite: (v: string) => void) => ({
      ...bild,
      write: (v: string) => {
        onWrite(v)
        return { bild: v }
      },
    })
    const draw = (onWrite: (v: string) => void) =>
      act(async () => root.render(createElement(FormHost<string>, { def: def(onWrite), render: (field) => createElement(AvatarField, { label: "Bild", field, resize }) })))
    await draw(alt)
    const file = host.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(file, "files", { value: [new File(["x"], "a.png", { type: "image/png" })] })
    await act(async () => file.dispatchEvent(new Event("change", { bubbles: true })))
    await draw(neu)
    await act(async () => finish("data:image/webp;base64,NEU"))
    await settle()
    expect(alt).not.toHaveBeenCalled()
    expect(neu).toHaveBeenCalledWith("data:image/webp;base64,NEU")
  })
})
