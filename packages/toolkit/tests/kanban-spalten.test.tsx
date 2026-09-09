// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"

import { KanbanBoard } from "../src/components/kanban/kanban-board"

const aufgabe = (id: string, status = "open"): Item =>
  ({
    id, type: "task", createdAt: "2026-06-05T10:00:00.000Z", createdBy: "u1",
    data: { title: `Aufgabe ${id}`, status }, tags: ["garten"], relations: [],
  }) as Item

/**
 * Eine Spalte ist kein Gegenstand, sondern ein ORT: der Platz, an dem Karten
 * liegen. Als weiße Card mit Rahmen sah sie aus wie eine große Karte, in der
 * kleine Karten stecken — Card in Card, dieselbe Verdopplung wie im
 * Detail-Panel vor #307.
 *
 * Im Entwurf ist sie darum eine vertiefte Fläche: getönt, ohne Rahmen. Die
 * Karten darin sind das Erhabene.
 */
describe("Kanban: die Spalte ist eine Fläche, keine Karte", () => {
  const html = renderToStaticMarkup(
    <KanbanBoard items={[aufgabe("t1"), aufgabe("t2", "in-progress")]} readOnly />,
  )

  it("legt die Spalte tiefer als den Grund, nicht darüber", () => {
    expect(html).toContain("bg-sunken")
  })

  it("gibt der Spalte keinen Rahmen und keine Card-Fläche", () => {
    // Der Spaltenkopf trägt den Titel — von dort aus nach oben zum Container.
    const bisKopf = html.slice(0, html.indexOf("To Do"))
    const container = bisKopf.slice(bisKopf.lastIndexOf("<div"))
    expect(container).not.toContain("bg-card")
    expect(container).not.toMatch(/\bborder\b(?!-)/)
  })

  it("lässt die Karten darin erhaben bleiben", () => {
    // Genau ein Kartentyp trägt die erhabene Fläche: die Items.
    expect(html).toContain("bg-card")
    expect(html).toContain("Aufgabe t1")
  })
})

/**
 * Drei Ebenen, die sich unterscheiden MÜSSEN, sonst verschwindet die
 * Staffelung: vertieft < Grund < erhaben.
 */
describe("Die drei Flächenebenen", () => {
  const css = readFileSync(join(__dirname, "../src/styles/globals.css"), "utf8")

  function wert(block: string, token: string): number {
    const start = css.indexOf(`${block} {`)
    const rumpf = css.slice(start, css.indexOf("\n}", start))
    const treffer = rumpf.match(new RegExp(`--${token}:\\s*oklch\\(([0-9.]+)`))
    expect(treffer, `${token} in ${block} nicht gefunden`).not.toBeNull()
    return Number.parseFloat(treffer![1]!)
  }

  it("staffelt sie im hellen Modus", () => {
    expect(wert(":root", "sunken")).toBeLessThan(wert(":root", "background"))
    expect(wert(":root", "background")).toBeLessThan(wert(":root", "card"))
  })

  it("staffelt sie im dunklen Modus in derselben Richtung", () => {
    expect(wert(".dark", "sunken")).toBeLessThan(wert(".dark", "background"))
    expect(wert(".dark", "background")).toBeLessThan(wert(".dark", "card"))
  })
})
