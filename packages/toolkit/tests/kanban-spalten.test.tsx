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

  /** Die Spalte selbst — über ihre Fläche gefunden, nicht über ihre Nachbarn. */
  function spaltenElement(): HTMLElement {
    const doc = new DOMParser().parseFromString(html, "text/html")
    const spalte = doc.querySelector<HTMLElement>(".bg-sunken")
    expect(spalte, "keine Spalte mit vertiefter Fläche gefunden").not.toBeNull()
    return spalte!
  }

  it("legt die Spalte tiefer als den Grund, nicht darüber", () => {
    expect(html).toContain("bg-sunken")
  })

  it("gibt der Spalte keinen Rahmen und keine Card-Fläche", () => {
    // Über das DOM, nicht über Zeichenpositionen: Ein Ausschnitt „bis zum
    // Titel, dann rückwärts zum letzten <div>" traf die innere Flex-Zeile —
    // ein Rahmen AN DER SPALTE wäre unbemerkt durchgegangen.
    const spalte = spaltenElement()
    const klassen = spalte.className.split(/\s+/)
    expect(klassen).not.toContain("bg-card")
    expect(klassen).not.toContain("border")
    expect(klassen.filter((k) => k.startsWith("border-"))).toEqual([])
  })

  it("lässt die Karten darin erhaben bleiben", () => {
    // Die Karten liegen IN der Spalte und tragen die erhabene Fläche.
    const karten = [...spaltenElement().querySelectorAll("article")]
    expect(karten.length).toBeGreaterThan(0)
    expect(karten[0]!.className).toContain("bg-card")
    expect(karten[0]!.textContent).toContain("Aufgabe")
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
    // Ohne diese Prüfung liefe `slice(-1)` und meldete „Token nicht gefunden",
    // obwohl in Wahrheit der ganze Block fehlt.
    expect(start, `Block ${block} nicht gefunden`).toBeGreaterThan(-1)
    const ende = css.indexOf("\n}", start)
    expect(ende, `Block ${block} wird nicht geschlossen`).toBeGreaterThan(start)
    const rumpf = css.slice(start, ende)
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
