// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { FieldNavigationProvider } from "../src/components/navigation/field-navigation"
import { ItemMetaRow } from "../src/components/preview/item-meta-row"

const event = (over: Record<string, unknown> = {}): Item =>
  ({
    id: "e1",
    type: "event",
    createdAt: "2026-06-05T10:00:00.000Z",
    createdBy: "u1",
    data: {
      start: "2026-07-04T16:00:00.000Z",
      locationName: "Stadtteilzentrum",
      position: { type: "Point", coordinates: [13.4, 52.5] },
      ...over,
    },
    relations: [],
  }) as Item

/**
 * Ein Feld führt zu der Sicht, die es darstellen kann. Ob es das tut, weiß
 * weder das Feld noch die Meta-Zeile: Das Modul-Register sagt, WER ein Feld
 * darstellt, die App, welche Module dieser Space führt und wie man hinkommt.
 * Hier steht nur, dass die Zeile sich danach richtet.
 */
describe("ItemMetaRow: Felder als Weg", () => {
  it("bleibt Text, wenn niemand die Navigation bereitstellt", () => {
    const html = renderToStaticMarkup(<ItemMetaRow item={event()} />)
    expect(html).not.toContain("<button")
    expect(html).toContain("Stadtteilzentrum")
  })

  it("macht Datum und Ort anklickbar, wenn es eine Sicht dafür gibt", () => {
    const html = renderToStaticMarkup(
      <FieldNavigationProvider value={{ openField: () => () => undefined }}>
        <ItemMetaRow item={event()} />
      </FieldNavigationProvider>,
    )
    expect(html.match(/<button/g) ?? []).toHaveLength(2)
  })

  it("fragt genau die Felder ab, die es zeigt", () => {
    const openField = vi.fn(() => null)
    renderToStaticMarkup(
      <FieldNavigationProvider value={{ openField }}>
        <ItemMetaRow item={event()} />
      </FieldNavigationProvider>,
    )
    expect(openField.mock.calls.map(([feld]) => feld)).toEqual(["start", "position"])
  })

  /**
   * Ein Ort ohne Koordinaten lässt sich auf keiner Karte zeigen — der Name
   * allein reicht nicht. Ein Link dorthin wäre ein Versprechen ohne Deckung.
   */
  it("verlinkt einen Ort nur, wenn er Koordinaten hat", () => {
    const html = renderToStaticMarkup(
      <FieldNavigationProvider value={{ openField: () => () => undefined }}>
        <ItemMetaRow item={event({ position: undefined })} />
      </FieldNavigationProvider>,
    )
    expect(html.match(/<button/g) ?? []).toHaveLength(1)
    expect(html).toContain("Stadtteilzentrum")
  })

  it("lässt ein Feld ohne Sicht als Text stehen", () => {
    const html = renderToStaticMarkup(
      <FieldNavigationProvider value={{ openField: (feld) => (feld === "start" ? () => undefined : null) }}>
        <ItemMetaRow item={event()} />
      </FieldNavigationProvider>,
    )
    expect(html.match(/<button/g) ?? []).toHaveLength(1)
  })
})
