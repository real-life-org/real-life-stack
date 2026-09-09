// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  FilterProvider,
  useOptionalSharedFilter,
  useSharedFilter,
} from "../src/components/filter/filter-store"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

/** Ein Modul, das den geteilten Zustand liest und schreibt. */
function Modul({ name }: { name: string }) {
  const { value, setValue, searchText, setSearchText, clear } = useSharedFilter()
  return createElement(
    "div",
    { "data-modul": name },
    createElement("span", { "data-tags": true }, value.tags.join(",")),
    createElement("span", { "data-suche": true }, searchText),
    createElement("button", {
      "data-setzen": true,
      onClick: () => {
        setValue({ ...value, tags: ["garten"] })
        setSearchText("beet")
      },
    }),
    createElement("button", { "data-leeren": true, onClick: clear }),
  )
}

/** Die Fläche tauscht das Modul aus; der Provider darüber bleibt stehen. */
function Flaeche() {
  const [modul, setModul] = useState("feed")
  return createElement(
    FilterProvider,
    null,
    createElement("button", { "data-wechseln": true, onClick: () => setModul("kanban") }),
    createElement(Modul, { name: modul, key: modul }),
  )
}

function klick(auswahl: string) {
  act(() => {
    host.querySelector<HTMLButtonElement>(auswahl)!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
  })
}

/**
 * Der Filter gehört der App-Shell, nicht dem Modul (Spec
 * shared-components.md → „Modul-übergreifender Filter-State"). Vorher hielt
 * ihn jedes Modul in eigenem `useState` — beim Wechsel von Feed zu Kanban war
 * er weg, und ein Klick auf ein Tag konnte nirgendwo hinführen.
 */
describe("Der geteilte Filter", () => {
  it("überlebt den Modulwechsel", () => {
    act(() => root.render(createElement(Flaeche)))
    klick("[data-setzen]")
    expect(host.querySelector("[data-tags]")!.textContent).toBe("garten")
    expect(host.querySelector("[data-suche]")!.textContent).toBe("beet")

    klick("[data-wechseln]")
    expect(host.querySelector("[data-modul]")!.getAttribute("data-modul")).toBe("kanban")
    expect(host.querySelector("[data-tags]")!.textContent).toBe("garten")
    expect(host.querySelector("[data-suche]")!.textContent).toBe("beet")
  })

  it("räumt Filter und Suchtext gemeinsam weg", () => {
    act(() => root.render(createElement(Flaeche)))
    klick("[data-setzen]")
    klick("[data-leeren]")
    expect(host.querySelector("[data-tags]")!.textContent).toBe("")
    expect(host.querySelector("[data-suche]")!.textContent).toBe("")
  })
})

describe("Ohne Provider", () => {
  it("gibt der weiche Zugriff null zurück, statt zu werfen", () => {
    let gesehen: unknown = "nicht gelesen"
    function Probe(): ReactNode {
      gesehen = useOptionalSharedFilter()
      return null
    }
    act(() => root.render(createElement(Probe)))
    expect(gesehen).toBeNull()
  })
})
