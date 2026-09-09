// @vitest-environment jsdom
import { act, createElement, useRef } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ModuleFrame, moduleContainerClass } from "../src/components/layout/module-frame"
import { ModuleToolbar } from "../src/components/layout/module-toolbar"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function rendere(node: React.ReactNode) {
  act(() => root.render(node))
}

const kopf = () => host.querySelector("[data-module-head]")
const kopfInhalt = () => host.querySelector("[data-module-head-slot]")
const scrollbereich = () => host.querySelector("[data-module-scroll]")

/**
 * Die Modulflaeche ist eine Spalte: fester Kopf, darunter der Scrollbereich
 * (Spec 01 → „Die Modulflaeche ist eine Spalte"). Der Kopf gehoert der
 * Flaeche, das Modul reicht seine Steuerleiste hinein.
 */
describe("Der Modulkopf", () => {
  it("bleibt leer, wenn das Modul nichts hineinreicht", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    // Der Kopf-Slot ist als Portal-Ziel immer da, aber ohne Beitrag leer —
    // eine leere Zeile waere schlimmer als kein Kopf (Spec 01, Regel 4).
    expect(kopfInhalt()).not.toBeNull()
    expect(kopfInhalt()!.childNodes.length).toBe(0)
    expect(kopf()!.hasAttribute("hidden")).toBe(true)
  })

  it("nimmt die Steuerleiste des Moduls auf, statt sie im Scrollbereich zu lassen", () => {
    rendere(
      createElement(
        ModuleFrame,
        { moduleId: "feed" },
        createElement(ModuleToolbar, { availableTags: ["garten"] }),
        "INHALT",
      ),
    )
    expect(kopf()!.hasAttribute("hidden")).toBe(false)
    expect(kopfInhalt()!.querySelector("[data-filter-chips]")).not.toBeNull()
    expect(scrollbereich()!.querySelector("[data-filter-chips]")).toBeNull()
  })

  it("faellt ohne Flaeche darueber an seinen Ort zurueck", () => {
    // Story, Test, eingebettete Ansicht (Spec 01, Regel 3): Die Leiste
    // verschwindet nicht spurlos, wenn es keinen Kopf gibt.
    rendere(createElement(ModuleToolbar, { availableTags: ["garten"] }))
    const leiste = host.querySelector("[data-module-toolbar]")
    expect(leiste).not.toBeNull()
    expect(leiste!.querySelector("[data-filter-chips]")).not.toBeNull()
  })

  it("gibt es fuer ueberlagerte Flaechen gar nicht", () => {
    // `panelFit: "overlay"` (Karte, Graph): Die Steuerung schwebt ueber der
    // Flaeche, ein Kopf wuerde sie beschneiden (Spec 01, Regel 5).
    rendere(createElement(ModuleFrame, { moduleId: "map" }, "KARTE"))
    expect(kopf()).toBeNull()
    expect(host.textContent).toContain("KARTE")
  })
})

/**
 * Der Punkt, an dem der erste Versuch scheiterte: Kopf und Scrollbereich
 * trugen je eine eigene Geometrie. Die Leiste sass am Fensterrand, waehrend
 * die Karten zentriert standen — und die Scrollleiste verschob die
 * Zentrierung des Inhalts um weitere Pixel gegen den Kopf.
 */
describe("Die Geometrie der Spalte", () => {
  it("kommt fuer Kopf und Inhalt aus einer Funktion", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    const geometrie = moduleContainerClass("feed")!
    for (const klasse of geometrie.split(/\s+/)) {
      expect(kopfInhalt()!.className).toContain(klasse)
      expect(scrollbereich()!.firstElementChild!.className).toContain(klasse)
    }
  })

  it("traegt kein vertikales Polster — das gehoert Kopf und Scrollbereich", () => {
    // Sonst polsterte der Kopf oben UND der Inhalt darunter nochmal.
    expect(moduleContainerClass("feed")).not.toMatch(/\bp[ty]-/)
  })

  it("haelt in beiden dieselbe Scrollleistenbreite frei", () => {
    rendere(createElement(ModuleFrame, { moduleId: "feed" }, "INHALT"))
    expect(kopf()!.className).toContain("[scrollbar-gutter:stable]")
    expect(scrollbereich()!.className).toContain("[scrollbar-gutter:stable]")
    // Der Kopf scrollt nicht — er reserviert nur dieselbe Rinne.
    expect(kopf()!.className).toContain("overflow-hidden")
  })

  it("laesst randlose Module ohne Container fuellen", () => {
    // `fill: "bleed"` (Liste, Karte): kein Container, das Modul scrollt selbst.
    expect(moduleContainerClass("collection")).toBeUndefined()
    rendere(createElement(ModuleFrame, { moduleId: "collection" }, "LISTE"))
    expect(scrollbereich()).toBeNull()
    expect(host.querySelector("[data-module-fill]")).not.toBeNull()
  })
})

/**
 * Der Feed ist das einzige Modul ohne CreateFab: Sein Einstieg ins Schreiben
 * ist die Composer-Pille oben im Scrollbereich (Spec shared-components →
 * „Feed-Sonderfall"). Scrollt sie weg, ist der Einstieg weg — also uebernimmt
 * ihn der Kopf, der ohnehin stehen bleibt.
 */
describe("Der Erstellen-Knopf im Kopf", () => {
  /** jsdom kennt keinen IntersectionObserver — hier einer zum Umlegen. */
  let melde: ((sichtbar: boolean) => void) | null = null
  let beobachtet: Element | null = null
  let wurzel: Element | null | undefined

  beforeEach(() => {
    melde = null
    beobachtet = null
    wurzel = undefined
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
  })

  // Nur den Beobachter zuruecknehmen, nicht `matchMedia` — `unstubAllGlobals`
  // naehme den Stub aus der Datei-Praeambel gleich mit.
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).IntersectionObserver
  })

  function Flaeche({ onCreate, mitBeobachtung = true }: { onCreate: () => void; mitBeobachtung?: boolean }) {
    const pille = useRef<HTMLDivElement | null>(null)
    return createElement(
      ModuleFrame,
      { moduleId: "feed" },
      createElement(ModuleToolbar, {
        availableTags: [],
        create: {
          onCreate,
          label: "Beitrag schreiben",
          hideWhileVisible: mitBeobachtung ? pille : undefined,
        },
      }),
      createElement("div", { ref: pille, "data-pille": true }, "PILLE"),
    )
  }

  const knopf = () => host.querySelector<HTMLButtonElement>('[aria-label="Beitrag schreiben"]')

  it("bleibt weg, solange die Pille im Bild ist", () => {
    rendere(createElement(Flaeche, { onCreate: () => {} }))
    expect(knopf()).toBeNull()
    melde!(true)
    expect(knopf()).toBeNull()
  })

  it("erscheint, sobald die Pille weggescrollt ist", () => {
    const erstellen = vi.fn()
    rendere(createElement(Flaeche, { onCreate: erstellen }))
    melde!(false)
    expect(knopf()).not.toBeNull()
    act(() => knopf()!.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    expect(erstellen).toHaveBeenCalledTimes(1)
  })

  it("verschwindet wieder, wenn sie zurueckkommt", () => {
    rendere(createElement(Flaeche, { onCreate: () => {} }))
    melde!(false)
    expect(knopf()).not.toBeNull()
    melde!(true)
    expect(knopf()).toBeNull()
  })

  /**
   * Beobachtet wird gegen den Scrollbereich des Frames, nicht gegen das
   * Fenster: Der Kopf steht ueber dem Scrollbereich, und was aus IHM
   * herausgescrollt ist, entscheidet — nicht, was der Bildschirm zeigt.
   */
  it("misst gegen den Scrollbereich der Flaeche", () => {
    rendere(createElement(Flaeche, { onCreate: () => {} }))
    expect(beobachtet).toBe(host.querySelector("[data-pille]"))
    expect(wurzel).toBe(host.querySelector("[data-module-scroll]"))
  })

  it("steht ohne Beobachtung dauerhaft im Kopf", () => {
    // Module ohne FAB und ohne Pille koennen ihn ebenfalls nutzen.
    rendere(createElement(Flaeche, { onCreate: () => {}, mitBeobachtung: false }))
    expect(knopf()).not.toBeNull()
  })
})
