// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { HostWorld } from "../src/story-support/host-world"
import { tabsZeigenText } from "../src/components/layout/module-tabs"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal("ResizeObserver", ResizeObserverStub)

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
})

async function zeige(readOnly: boolean) {
  await act(async () => { root.render(createElement(HostWorld, { module: "feed", readOnly })) })
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  return host.textContent ?? ""
}

/**
 * Spec 03: Eine Flaeche blendet aus, was der Connector nicht kann. Der
 * Plusknopf hielt sich daran, die beiden anderen Einstiege ins Schreiben
 * nicht — gefunden ueber die Nur-Lese-Story des Gartens (rls#478).
 */
describe("Einstiege ins Schreiben folgen den Faehigkeiten", () => {
  it("mit Schreibfaehigkeit: Composer-Pille, Kommentieren und Plusknopf", async () => {
    const text = await zeige(false)
    expect(text).toContain("Was gibt's Neues?")
    expect(text).toContain("Kommentieren")
    expect(host.querySelector("[aria-label='Erstellen']")).toBeTruthy()
  })

  it("ohne Schreibfaehigkeit: keiner der drei, aber die Items bleiben lesbar", async () => {
    const text = await zeige(true)
    expect(text).not.toContain("Was gibt's Neues?")
    expect(text).not.toContain("Kommentieren")
    expect(host.querySelector("[aria-label='Erstellen']")).toBeNull()
    // Lesen geht weiter: die Karten stehen da.
    expect(text).toContain("Erntefest")
  })
})

/**
 * Der Space-Anzeiger und der Filter auf dem Telefon (24.09.2026): Der
 * Doppelpfeil war unter `sm` ausgeblendet, obwohl er dort erst recht sagt,
 * dass sich hinter dem Namen etwas oeffnet.
 */
describe("Kopfzeile auf dem Telefon", () => {
  it("der Space-Anzeiger ist in jeder Breite da", async () => {
    await zeige(false)
    const wechsler = host.querySelector("[data-slot='dropdown-menu-trigger'], button[aria-haspopup='menu']")
    expect(wechsler).toBeTruthy()
    const anzeiger = [...wechsler!.querySelectorAll("svg")].at(-1)
    expect(anzeiger).toBeTruthy()
    expect(anzeiger!.getAttribute("class") ?? "").not.toContain("hidden")
  })
})

/**
 * Die Tabs entscheiden ueber ihre Beschriftung gemessen, nicht an einer festen
 * Schwelle: Drei Module haben bei 1024px Platz, sieben liefen dort in das
 * Nutzer-Menue.
 */
describe("Modul-Tabs", () => {
  it("zeigen Text nur, solange er in den Platz passt", () => {
    expect(tabsZeigenText(689, 665)).toBe(false)
    expect(tabsZeigenText(689, 741)).toBe(true)
    expect(tabsZeigenText(300, 300)).toBe(true)
  })
})
