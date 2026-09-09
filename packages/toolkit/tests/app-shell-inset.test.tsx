// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { AppShellMain } from "../src/components/layout/app-shell"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Die Flaeche weicht einem offenen Panel animiert aus. Wechselt aber das Modul,
 * springt die Regel (`inset`) um, ohne dass am Panel etwas passiert waere —
 * dann darf nichts animieren, sonst schnurrt der neue Kalender sichtbar
 * zusammen bzw. streckt sich die neue Karte auf die volle Breite.
 *
 * Gemessen wird das am MARGIN. Frueher war es ein Padding, das nur den Inhalt
 * einrueckte, waehrend die Flaeche bis zum Fensterrand reichte — und mit ihr
 * die Scrollleiste. Seit sie an der Panelkante endet, ist es ein Margin; die
 * Aussage dieser Tests bleibt dieselbe.
 */
let host: HTMLDivElement
let root: Root

function render(inset: boolean) {
  act(() => {
    root.render(createElement(AppShellMain, { inset }, "Inhalt"))
  })
}

/**
 * Einzelne Klassen, nicht der rohe String: `transition-none` steckt auch in
 * der Variante `[.adaptive-panel-resizing_&]:transition-none`, ein
 * Teilstring-Vergleich wuerde die also immer finden.
 */
function klassen(): string[] {
  return (host.querySelector("main")?.className ?? "").split(/\s+/).filter(Boolean)
}

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe("AppShellMain: der Uebergang beim Verdraengen", () => {
  it("animiert im Ruhezustand, damit ein Panel die Flaeche weich verdraengt", () => {
    render(true)
    expect(klassen()).toContain("transition-[margin]")
    expect(klassen()).not.toContain("transition-none")
  })

  it("setzt beim Regelwechsel sofort statt zu animieren", () => {
    render(true)
    render(false)
    expect(klassen()).toContain("transition-none")
  })

  it("gilt in beide Richtungen (Karte -> Kalender und zurueck)", () => {
    render(false)
    render(true)
    expect(klassen()).toContain("transition-none")
  })

  it("laesst die Animation nach dem gezeichneten Sprung wieder zu", async () => {
    render(true)
    render(false)
    await act(async () => {
      // Zwei Bilder abwarten: erst danach ist der Sprung gemalt.
      await new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(fertig)))
      await new Promise((fertig) => setTimeout(fertig, 0))
    })
    expect(klassen()).not.toContain("transition-none")
    expect(klassen()).toContain("transition-[margin]")
  })

  it("nimmt der Flaeche nur Platz, wenn sie einruecken soll", () => {
    render(true)
    expect(host.querySelector("main")?.style.marginRight).toBe("var(--adaptive-panel-margin-right, 0px)")
    render(false)
    expect(host.querySelector("main")?.style.marginRight).toBe("")
  })
})
