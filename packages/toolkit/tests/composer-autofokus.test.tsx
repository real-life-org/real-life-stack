// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ContentComposer, type ContentTypeConfig } from "../src/components/composer/content-composer"
import { istBreiteUnter, useIsCompact } from "../src/hooks/use-mobile"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** matchMedia in jsdom: merkt sich die Hoerer, damit ein Groessenwechsel ankommt. */
const hoerer = new Set<() => void>()
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  addEventListener: (_: string, fn: () => void) => void hoerer.add(fn),
  removeEventListener: (_: string, fn: () => void) => void hoerer.delete(fn),
  addListener: () => {},
  removeListener: () => {},
  onchange: null,
  dispatchEvent: () => false,
}))

const termin: ContentTypeConfig = { id: "event", label: "Termin", defaultWidgets: ["title", "text", "date"] }

const urspruenglicheBreite = window.innerWidth
function breite(px: number) {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true })
  for (const fn of hoerer) fn()
  window.dispatchEvent(new Event("resize"))
}

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
  breite(urspruenglicheBreite)
})

function markup() {
  return renderToStaticMarkup(
    createElement(ContentComposer, { contentTypes: [termin], mode: "event", onSubmit: () => {} }),
  )
}

function knopf(text: string) {
  return [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)
}

/**
 * Befund 24.09.2026 (Telefon): Der Erstellen-Drawer sprang in den Titel, die
 * Tastatur kam, und der Kopf des Formulars — Typ und Gruppe — war aus dem
 * Bild geschoben. Auf dem Telefon ist der Typ die erste Entscheidung.
 */
describe("Autofokus des Composers", () => {
  it("springt auf breiten Schirmen in den Titel", () => {
    breite(1280)
    expect(markup()).toContain("autofocus")
  })

  it("laesst den Titel auf schmalen Schirmen in Ruhe", () => {
    breite(390)
    expect(markup()).not.toContain("autofocus")
  })

  /**
   * `autoFocus` wirkt beim Einhaengen. Ein Hook, der seinen Wert erst im
   * Effekt setzt, meldet im ersten Render noch „breit" — genau daran ist der
   * erste Versuch gescheitert.
   */
  it("beantwortet die Breite schon im ersten Render", () => {
    function Sonde() {
      return createElement("i", null, String(useIsCompact()))
    }
    breite(390)
    expect(renderToStaticMarkup(createElement(Sonde))).toContain("true")
    breite(1280)
    expect(renderToStaticMarkup(createElement(Sonde))).toContain("false")
    expect(istBreiteUnter(1024)).toBe(false)
  })

  /**
   * Der Randfall aus dem Loop-Review zu rls#481: Wer die Breite beim
   * Einhaengen einfriert, haengt sie den Widgets an, die beim Rueckweg aus der
   * Vorschau neu entstehen — nach einem Groessenwechsel ist sie dann falsch.
   */
  it("folgt einem Groessenwechsel, auch ueber Vorschau und zurueck", async () => {
    breite(1280)
    await act(async () => {
      root.render(createElement(ContentComposer, { contentTypes: [termin], mode: "event", showPreview: true, onSubmit: () => {} }))
    })
    expect(document.activeElement?.tagName, "breit: Fokus im Titel").toBe("INPUT")

    await act(async () => { knopf("Vorschau")?.click() })
    await act(async () => { breite(390) })
    ;(document.activeElement as HTMLElement | null)?.blur()
    await act(async () => { knopf("Bearbeiten")?.click() })

    expect(document.activeElement?.tagName, "schmal: kein Fokus im Titel").not.toBe("INPUT")
  })
})
