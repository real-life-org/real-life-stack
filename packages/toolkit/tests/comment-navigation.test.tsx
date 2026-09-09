// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { createObservable, type Item, type User } from "@real-life-stack/data-interface"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { CommentNavigationProvider } from "../src/components/navigation/comment-navigation"
import { ItemPreview } from "../src/components/preview/item-preview"

const beitrag: Item =
  ({ id: "p1", type: "post", createdAt: "2026-06-05T10:00:00.000Z", createdBy: "u1",
     data: { title: "Gartenplan", content: "Text" }, relations: [] }) as Item
const autor: User = { id: "u1", displayName: "Sebastian" } as User

const kommentar = (id: string): Item =>
  ({ id, type: "comment", createdAt: "2026-06-06T10:00:00.000Z", createdBy: "u1", data: { content: id } }) as Item

/** Nur was ItemPreview für den Kommentar-Zähler liest. */
function connectorMit(kommentare: Item[]) {
  const beobachtet = createObservable<Item[]>(kommentare)
  return {
    observeRelatedItems: () => beobachtet,
    getRelatedItems: async () => beobachtet.current,
    relate: async () => {},
    unrelate: async () => {},
    getItems: async () => [],
    observeItems: () => createObservable<Item[]>([]),
    getItem: async () => null,
    observeItem: () => createObservable<Item | null>(null),
  }
}

function markup(kommentare: Item[], navigation?: { openComments: () => (() => void) | null }) {
  const karte = <ItemPreview item={beitrag} author={autor} />
  return renderToStaticMarkup(
    <ConnectorProvider connector={connectorMit(kommentare) as never}>
      {navigation ? (
        <CommentNavigationProvider value={navigation}>{karte}</CommentNavigationProvider>
      ) : (
        karte
      )}
    </ConnectorProvider>,
  )
}

/**
 * Der Hinweis auf die Diskussion ist zugleich der Weg hinein: Wer ihn antippt,
 * will schreiben — nicht erst das Item öffnen und dann das Feld suchen.
 *
 * Ohne Kommentare steht dort keine Null, sondern eine Einladung. „0 Kommentare"
 * sagt dasselbe wie nichts; „Kommentieren" sagt, was möglich ist.
 */
describe("Der Kommentar-Hinweis als Weg", () => {
  const navigation = { openComments: () => () => undefined }

  it("lädt zum Schreiben ein, auch wenn noch niemand geschrieben hat", () => {
    const html = markup([], navigation)
    expect(html).toContain("Kommentieren")
    expect(html).not.toMatch(/>\s*0\s*</)
  })

  it("nennt die Zahl, sobald es etwas zu zählen gibt", () => {
    const html = markup([kommentar("k1"), kommentar("k2")], navigation)
    expect(html).toContain("2")
    expect(html).toContain("Kommentieren")
  })

  it("ist anklickbar, wenn ein Weg ins Kommentarfeld besteht", () => {
    expect(markup([kommentar("k1")], navigation)).toContain("<button")
  })

  /**
   * Ohne Provider — Story, Test, eine Fläche ohne Detailansicht — bleibt der
   * Hinweis, was er war: eine Auskunft. Ein Knopf, der nichts tut, wäre
   * schlimmer als schlichter Text.
   */
  it("bleibt Text, wo es keinen Weg gibt", () => {
    const html = markup([kommentar("k1")])
    expect(html).toContain("1")
    expect(html).not.toContain("<button")
  })

  it("fragt mit dem Item, über das gesprochen werden soll", () => {
    const openComments = vi.fn(() => () => undefined)
    markup([kommentar("k1")], { openComments })
    expect(openComments).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }))
  })

  /**
   * In der dichten Ansicht bleibt sichtbar nur ein Symbol und eine Zahl —
   * vorgelesen ergäbe das „2" oder gar nichts. Die Bedeutung muss deshalb
   * ausgesprochen werden, auch dort, wo der Hinweis nur Auskunft ist.
   */
  it("nennt seine Bedeutung, auch wo nur eine Zahl steht", () => {
    expect(markup([kommentar("k1"), kommentar("k2")], navigation))
      .toContain('aria-label="2 Kommentare, kommentieren"')
    expect(markup([kommentar("k1")], navigation))
      .toContain('aria-label="1 Kommentar, kommentieren"')
    expect(markup([], navigation)).toContain('aria-label="Kommentieren"')
  })

  it("nennt sie auch ohne Weg, wo die Zahl sonst unerklärt bliebe", () => {
    expect(markup([kommentar("k1")])).toContain('aria-label="1 Kommentar, kommentieren"')
  })

  it("zeigt in der dichten Ansicht nur die Zahl", () => {
    const html = renderToStaticMarkup(
      <ConnectorProvider connector={connectorMit([kommentar("k1")]) as never}>
        <CommentNavigationProvider value={navigation}>
          <ItemPreview item={beitrag} author={autor} density="compact" />
        </CommentNavigationProvider>
      </ConnectorProvider>,
    )
    expect(html).toContain("1")
    expect(html).not.toContain("Kommentieren")
  })
})
