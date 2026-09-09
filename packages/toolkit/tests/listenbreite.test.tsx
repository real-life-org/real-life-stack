// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { FilterProvider } from "../src/components/filter/filter-store"
import { CollectionView } from "../src/components/lens/collection-view"
import { ModuleFrame } from "../src/components/layout/module-frame"
import { ModuleToolbar } from "../src/components/layout/module-toolbar"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

const eintrag: Item = {
  id: "a",
  type: "post",
  tags: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  createdBy: "u",
  data: { title: "Gartentreffen" },
} as unknown as Item

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

const breite = (el: Element | null) =>
  (el?.className ?? "").split(/\s+/).find((k) => k.startsWith("max-w-"))

/**
 * Die Breite der Liste stand fuenfmal im Code — in der Lens, im Raster, in der
 * Kopfzeile, im Register und in der Netzwerk-App. Wer eine davon anfasste,
 * rueckte Kopf und Eintraege gegeneinander. Sie gehoert der FLAECHE; die Lens
 * liest sie.
 */
describe("Die Breite der Liste", () => {
  it("kommt unter einer Flaeche aus deren Layout — fuer Kopf und Eintraege", () => {
    act(() => {
      root.render(
        createElement(
          FilterProvider,
          null,
        createElement(
          ModuleFrame,
          { fill: "bleed" as const, maxWidth: "max-w-4xl" },
          createElement(ModuleToolbar, { availableTags: ["garten"] }),
          createElement(CollectionView, { items: [eintrag] }),
        ),
        ),
      )
    })
    const kopf = host.querySelector("[data-module-head-slot]")
    const liste = host.querySelector("[aria-label='Listenansicht'] > div")
    expect(breite(kopf)).toBe("max-w-4xl")
    expect(breite(liste)).toBe("max-w-4xl")
  })

  it("bringt die Lens ohne Flaeche selbst mit", () => {
    act(() => {
      root.render(createElement(CollectionView, { items: [eintrag] }))
    })
    expect(breite(host.querySelector("[aria-label='Listenansicht'] > div"))).toBe("max-w-6xl")
  })
})

/**
 * Der Rueckfall, den dieser Test verhindert: Jemand setzt die Breite wieder in
 * die Lens, und ab da gibt es zwei Wahrheiten.
 */
describe("Keine zweite Breite in der Lens", () => {
  const dateien = ["list-view.tsx", "grid-view.tsx", "collection-view.tsx"]

  it("nennt `max-w-6xl` nirgends mehr als Literal", () => {
    for (const datei of dateien) {
      const quelle = readFileSync(join(__dirname, "../src/components/lens", datei), "utf8")
      expect(quelle, `${datei} traegt wieder eine eigene Breite`).not.toMatch(
        /className=[^\n]*max-w-6xl/,
      )
    }
  })
})
