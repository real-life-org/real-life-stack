// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { createObservable, type Item } from "@real-life-stack/data-interface"
import { ConnectorProvider } from "../src/hooks/connector-context"
import { ItemPreview } from "../src/components/preview/item-preview"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const comment = (id: string): Item =>
  ({ id, type: "comment", createdAt: "2026-08-06T10:00:00.000Z", createdBy: "u1", data: { content: id } }) as Item

const post: Item =
  ({ id: "post-1", type: "post", createdAt: "2026-08-06T09:00:00.000Z", createdBy: "u1",
     data: { title: "Gartenplan", content: "Text" } }) as Item

/** Minimal relation-capable connector: only what ItemPreview reads. */
function connectorWith(comments: Item[]) {
  const related = createObservable<Item[]>(comments)
  return {
    fake: {
      observeRelatedItems: () => related,
      getRelatedItems: async () => related.current,
      relate: async () => {},
      unrelate: async () => {},
      getItems: async () => [], observeItems: () => createObservable<Item[]>([]),
      getItem: async () => null, observeItem: () => createObservable<Item | null>(null),
    },
    related,
  }
}

async function renderPreview(comments: Item[]) {
  const { fake, related } = connectorWith(comments)
  const host = document.createElement("div")
  document.body.append(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(
      createElement(ConnectorProvider, { connector: fake as never },
        createElement(ItemPreview, { item: post, author: null })),
    )
  })
  return { host, root, related }
}

/**
 * Der Wortlaut hat sich geändert: aus „2 Kommentare" wurde „2 · Kommentieren".
 * Der Hinweis ist jetzt zugleich der Weg hinein (siehe
 * `comment-navigation.test.tsx`), und eine Einladung sagt, was möglich ist,
 * statt nur zu zählen. Was diese Datei prüft, ist unverändert: DASS gezählt
 * wird, dass eine Null nichts anzeigt, und dass der Zähler mitwächst.
 */
describe("ItemPreview — Kommentar-Hinweis", () => {
  it("zeigt an, DASS ein Item Kommentare hat", async () => {
    const { host, root } = await renderPreview([comment("c1"), comment("c2")])
    expect(host.textContent).toContain("2")
    expect(host.textContent).toContain("Kommentieren")
    await act(async () => root.unmount())
    host.remove()
  })

  it("nennt auch einen einzelnen Kommentar", async () => {
    const { host, root } = await renderPreview([comment("c1")])
    expect(host.textContent).toContain("1")
    await act(async () => root.unmount())
    host.remove()
  })

  it("zeigt ohne Kommentare NICHTS an — eine Null waere Rauschen auf jeder Karte", async () => {
    const { host, root } = await renderPreview([])
    expect(host.textContent).not.toMatch(/Kommentar/)
    await act(async () => root.unmount())
    host.remove()
  })

  it("aktualisiert sich live, wenn ein Kommentar dazukommt", async () => {
    const { host, root, related } = await renderPreview([])
    expect(host.textContent).not.toMatch(/Kommentar/)
    await act(async () => { related.set([comment("c1")]) })
    expect(host.textContent).toContain("1")
    expect(host.textContent).toContain("Kommentieren")
    await act(async () => root.unmount())
    host.remove()
  })
})
