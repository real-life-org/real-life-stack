// @vitest-environment jsdom
import { act, createElement, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CreateFab } from "../src/components/create-fab/create-fab"
import { ModuleFrame } from "../src/components/layout/module-frame"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

/** jsdom kennt keinen IntersectionObserver — hier einer zum Umlegen. */
let melde: ((sichtbar: boolean) => void) | null = null
let beobachtet: Element | null = null
let wurzel: Element | null | undefined

function stubbeBeobachter() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        private rueckruf: (eintraege: { isIntersecting: boolean }[]) => void,
        optionen?: { root?: Element | null },
      ) {
        wurzel = optionen?.root
        melde = (sichtbar) => act(() => this.rueckruf([{ isIntersecting: sichtbar }]))
      }
      observe(el: Element) { beobachtet = el }
      unobserve() {}
      disconnect() {}
    },
  )
}

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  melde = null
  beobachtet = null
  wurzel = undefined
  stubbeBeobachter()
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

/** Die Flaeche mit Pille im Scrollbereich und dem FAB darueber. */
function Flaeche({ onCreate, mitBeobachtung = true }: { onCreate: () => void; mitBeobachtung?: boolean }) {
  const pille = useRef<HTMLDivElement | null>(null)
  return createElement(
    ModuleFrame,
    { moduleId: "feed" },
    createElement("div", { ref: pille, "data-pille": true }, "PILLE"),
    createElement(CreateFab, {
      onClick: onCreate,
      label: "Beitrag erstellen",
      hideWhileVisible: mitBeobachtung ? pille : undefined,
    }),
  )
}

const fab = () => host.querySelector<HTMLButtonElement>('[aria-label="Beitrag erstellen"]')

function rendere(node: React.ReactNode) {
  act(() => root.render(node))
}

/**
 * Der Feed bekommt denselben Einstieg wie jedes andere Modul — den FAB unten
 * rechts. Nur zeigt er ihn nicht immer: Solange die Composer-Pille im Bild
 * ist, IST sie der Einstieg (Spec shared-components → „Feed-Sonderfall"), und
 * zwei nebeneinander waeren einer zu viel.
 */
describe("Der CreateFab mit beobachtetem Einstieg", () => {
  it("bleibt weg, solange die Pille im Bild ist", () => {
    rendere(createElement(Flaeche, { onCreate: () => {} }))
    expect(fab()).toBeNull()
    melde!(true)
    expect(fab()).toBeNull()
  })

  it("erscheint, sobald die Pille weggescrollt ist", () => {
    const erstellen = vi.fn()
    rendere(createElement(Flaeche, { onCreate: erstellen }))
    melde!(false)
    expect(fab()).not.toBeNull()
    act(() => fab()!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(erstellen).toHaveBeenCalledTimes(1)
  })

  it("verschwindet wieder, wenn sie zurueckkommt", () => {
    rendere(createElement(Flaeche, { onCreate: () => {} }))
    melde!(false)
    expect(fab()).not.toBeNull()
    melde!(true)
    expect(fab()).toBeNull()
  })

  /**
   * Gemessen wird gegen den Scrollbereich der Modulflaeche, nicht gegen das
   * Fenster: Was aus IHM herausgescrollt ist, entscheidet.
   */
  it("misst gegen den Scrollbereich der Flaeche", () => {
    rendere(createElement(Flaeche, { onCreate: () => {} }))
    expect(beobachtet).toBe(host.querySelector("[data-pille]"))
    expect(wurzel).toBe(host.querySelector("[data-module-scroll]"))
  })

  it("steht ohne Beobachtung dauerhaft, wie in allen anderen Modulen", () => {
    rendere(createElement(Flaeche, { onCreate: () => {}, mitBeobachtung: false }))
    expect(fab()).not.toBeNull()
  })

  /**
   * Ohne IntersectionObserver (aeltere WebViews) lieber ein FAB zu viel als
   * ein unerreichbarer Einstieg.
   */
  it("zeigt sich, wo niemand beobachten kann", () => {
    vi.unstubAllGlobals()
    rendere(createElement(Flaeche, { onCreate: () => {} }))
    expect(fab()).not.toBeNull()
    stubbeBeobachter()
  })
})

/**
 * Der Erstellen-Knopf steht auf derselben Ebene wie die Filter-Pille und
 * sieht aus wie sie: weiss mit Rand, 48px, derselbe Schatten (Design-Board
 * 1.3). Vorher war er 56px und primaerfarben und schrie lauter als alles
 * andere auf der Flaeche.
 */
describe("Die Anatomie des Erstellen-Knopfes", () => {
  it("ist eine weisse Flaeche mit Rand statt eines primaerfarbenen Klotzes", () => {
    act(() => root.render(createElement(CreateFab, { onClick: () => {} })))
    const knopf = host.querySelector("button")!
    const klassen = knopf.className.split(/\s+/)
    expect(klassen).toContain("bg-card")
    expect(klassen).toContain("border")
    expect(klassen).toContain("shadow-lg")
    expect(klassen).not.toContain("bg-primary")
  })

  it("misst 48px am Desktop und 52px am Telefon", () => {
    act(() => root.render(createElement(CreateFab, { onClick: () => {} })))
    const klassen = host.querySelector("button")!.className
    expect(klassen).toContain("h-13")
    expect(klassen).toContain("md:h-12")
  })

  it("hebt sich beim Zeigen nicht an (Design Guide: Buttons ohne Lift)", () => {
    act(() => root.render(createElement(CreateFab, { onClick: () => {} })))
    expect(host.querySelector("button")!.className).not.toContain("hover:scale-105")
  })
})
