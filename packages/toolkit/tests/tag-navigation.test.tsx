// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createObservable, type Item, type User } from "@real-life-stack/data-interface"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { FilterProvider, useSharedFilter } from "../src/components/filter/filter-store"
import { TagNavigationProvider } from "../src/components/navigation/tag-navigation"
import { ItemPreview } from "../src/components/preview/item-preview"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const beitrag: Item = {
  id: "p1",
  type: "post",
  createdAt: "2026-06-05T10:00:00.000Z",
  createdBy: "u1",
  data: { title: "Gartenplan", content: "Text" },
  tags: ["garten", "beet"],
  relations: [],
} as unknown as Item
const autor: User = { id: "u1", displayName: "Sebastian" } as User

/** Nur was `ItemPreview` fuer den Kommentar-Zaehler liest. */
const connector = {
  observeRelatedItems: () => createObservable<Item[]>([]),
  getRelatedItems: async () => [],
  relate: async () => {},
  unrelate: async () => {},
  getItems: async () => [],
  observeItems: () => createObservable<Item[]>([]),
  getItem: async () => null,
  observeItem: () => createObservable<Item | null>(null),
} as never

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

/** Liest den geteilten Filter mit, damit der Test sieht, was ein Klick tat. */
function Filterprobe() {
  const { value } = useSharedFilter()
  return <span data-tags>{value.tags.join(",")}</span>
}

function rendereKarte(options: { navigation?: boolean; onClick?: () => void } = {}) {
  const { navigation = true, onClick } = options
  const karte = <ItemPreview item={beitrag} author={autor} onClick={onClick} />
  act(() =>
    root.render(
      <ConnectorProvider connector={connector}>
        <FilterProvider>
          <Filterprobe />
          {navigation ? <TagNavigationProvider>{karte}</TagNavigationProvider> : karte}
        </FilterProvider>
      </ConnectorProvider>,
    ),
  )
}

const tagKnopf = (tag: string) =>
  Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === tag)

const aktiveTags = () => host.querySelector("[data-tags]")!.textContent

function klick(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
}

/**
 * Ein Tag auf einer Karte ist nicht nur Auskunft, sondern der Weg zu allem
 * anderen, das so verschlagwortet ist. Er setzt den GETEILTEN Filter — deshalb
 * wirkt er nach dem Modulwechsel weiter (Spec shared-components →
 * „Modul-uebergreifender Filter-State").
 */
describe("Der Tag-Klick als Filter", () => {
  it("nimmt ein Tag in den Filter auf", () => {
    rendereKarte()
    klick(tagKnopf("garten")!)
    expect(aktiveTags()).toBe("garten")
  })

  it("nimmt ein zweites dazu — Tags sind UND-verknuepft", () => {
    rendereKarte()
    klick(tagKnopf("garten")!)
    klick(tagKnopf("beet")!)
    expect(aktiveTags()).toBe("garten,beet")
  })

  it("nimmt ein bereits aktives Tag wieder heraus", () => {
    rendereKarte()
    klick(tagKnopf("garten")!)
    klick(tagKnopf("garten")!)
    expect(aktiveTags()).toBe("")
  })

  it("sagt vorgelesen, ob das Tag gerade filtert", () => {
    rendereKarte()
    expect(tagKnopf("garten")!.getAttribute("aria-pressed")).toBe("false")
    klick(tagKnopf("garten")!)
    expect(tagKnopf("garten")!.getAttribute("aria-pressed")).toBe("true")
  })

  /**
   * Der Klick gilt dem Tag, nicht der Karte darunter. Ohne `stopPropagation`
   * filterte er UND oeffnete das Item — man landete im Detail und suchte den
   * Weg zurueck zur gefilterten Liste.
   */
  it("oeffnet nicht zugleich die Karte", () => {
    const oeffnen = vi.fn()
    rendereKarte({ onClick: oeffnen })
    klick(tagKnopf("garten")!)
    expect(oeffnen).not.toHaveBeenCalled()
    expect(aktiveTags()).toBe("garten")
  })

  /**
   * Ohne Provider — Story, Test, eine App ohne geteilten Filter — bleibt der
   * Chip Text. Ein Knopf, der nichts tut, waere schlimmer als schlichter Text
   * (dieselbe Regel wie beim Kommentar-Hinweis).
   */
  it("bleibt ohne Provider ein stiller Chip", () => {
    rendereKarte({ navigation: false })
    expect(tagKnopf("garten")).toBeUndefined()
    expect(host.textContent).toContain("garten")
  })
})
