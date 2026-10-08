// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life/data-interface"

import { ItemPreview } from "../src/components/preview/item-preview"

/**
 * S3b PR B: Die Zeilen der Rückwärts-Listen sind eine einzeilige Form von
 * `ItemPreview` (shared-components, Detail-Anatomie Regel 8: Karten immer aus
 * ItemPreview). Übernommen aus Draft rls#360: `completed` (Häkchen vor dem
 * Titel, gedimmt) und die Regel, was eine dichte Form weglässt.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ITEM: Item = {
  id: "t1",
  type: "task",
  createdBy: "u1",
  createdAt: "2026-09-27T10:00:00.000Z",
  data: { title: "Schubkarre reparieren", description: "Reifen flicken", status: "open" },
  tags: ["garten", "werkzeug"],
}

const html = (props: Partial<Parameters<typeof ItemPreview>[0]> = {}) =>
  renderToStaticMarkup(createElement(ItemPreview, { item: ITEM, density: "row", ...props }))

describe("ItemPreview density row", () => {
  it("zeigt Badge, Titel und rechts den Zusatz — in einer Zeile", () => {
    const out = html({
      headerAdornment: createElement("span", { "data-badge": "" }, "Task"),
      footerAdornment: createElement("span", { "data-mark": "" }, "diese"),
    })
    const doc = new DOMParser().parseFromString(out, "text/html")
    const article = doc.querySelector("article")!
    expect(article.getAttribute("data-preview-density")).toBe("row")
    expect(article.className).toContain("flex-row")
    expect(article.className).toContain("items-center")
    const title = article.querySelector("[data-row-title]")!
    expect(title.textContent).toBe("Schubkarre reparieren")
    expect(title.className).toContain("truncate")
    // Reihenfolge: Badge, Titel, Zusatz.
    const order = [...article.querySelectorAll("[data-badge], [data-row-title], [data-mark]")].map((el) => el.textContent)
    expect(order).toEqual(["Task", "Schubkarre reparieren", "diese"])
  })

  it("lässt Beschreibung, Tags, Urheber, Meta-Zeile und Kommentar-Hinweis weg", () => {
    const out = html({ metaAdornment: createElement("span", null, "META") })
    expect(out).not.toContain("Reifen flicken")
    expect(out).not.toContain("garten")
    expect(out).not.toContain("u1")
    expect(out).not.toContain("META")
    expect(out).not.toContain("Kommentieren")
  })

  it("ohne Titel steht der Name oder der Anfang des Inhalts, sonst „Ohne Titel“", () => {
    expect(renderToStaticMarkup(createElement(ItemPreview, { item: { ...ITEM, data: { content: "Ein Beitrag" } }, density: "row" }))).toContain("Ein Beitrag")
    expect(renderToStaticMarkup(createElement(ItemPreview, { item: { ...ITEM, data: {} }, density: "row" }))).toContain("Ohne Titel")
  })

  it("completed: Häkchen vor dem Titel, für Screenreader „Erledigt:“, gedimmt (aus rls#360)", () => {
    const doc = new DOMParser().parseFromString(html({ completed: true }), "text/html")
    const article = doc.querySelector("article")!
    expect(article.getAttribute("data-completed")).toBe("true")
    expect(article.getAttribute("style")).toContain("opacity:0.55")
    expect(article.querySelector("[data-row-title]")?.textContent).toBe("✓ Erledigt: Schubkarre reparieren")
    expect(article.querySelector(".sr-only")?.textContent).toBe("Erledigt: ")
  })

  it("completed gilt auch in den anderen Dichten", () => {
    const out = renderToStaticMarkup(createElement(ItemPreview, { item: ITEM, density: "compact", completed: true }))
    expect(out).toContain('data-completed="true"')
    expect(out).toContain("Erledigt: ")
  })

  it("active markiert die angezeigte Zeile (aria-current), ohne Schatten", () => {
    const doc = new DOMParser().parseFromString(html({ active: true }), "text/html")
    const article = doc.querySelector("article")!
    expect(article.getAttribute("aria-current")).toBe("true")
    expect(article.className).not.toContain("shadow-xl")
  })

  it("mit onClick ist die Zeile per Tastatur bedienbar", async () => {
    const onClick = vi.fn()
    const host = document.createElement("div")
    const root = createRoot(host)
    await act(async () => root.render(createElement(ItemPreview, { item: ITEM, density: "row", onClick })))
    const article = host.querySelector("article")!
    expect(article.getAttribute("role")).toBe("button")
    await act(async () => article.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect(onClick).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
  })
})

describe("CodeRabbit: completed ohne Titel", () => {
  it("zeigt Häkchen und Screenreader-Text auch ohne Titel", () => {
    const out = renderToStaticMarkup(createElement(ItemPreview, { item: { ...ITEM, data: { content: "Notiz" } }, density: "compact", completed: true }))
    expect(out).toContain("Erledigt: ")
    expect(out).toContain("✓")
  })
})
