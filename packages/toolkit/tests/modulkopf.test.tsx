// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { AppShellMain } from "../src/components/layout/app-shell"
import { ModuleToolbar } from "../src/components/layout/module-toolbar"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Zwei Beobachtungen, eine Ursache: Die Scrollleiste klemmte im 16px-Spalt
 * rechts neben dem Panel, und die Modul-Steuerleiste scrollte mit weg.
 *
 * Beides lag daran, dass `main` bis zum Fensterrand reichte und ALLES
 * enthielt — nur sein Inhalt rückte per Padding ein. Jetzt ist die Fläche
 * eine Spalte: ein fester Kopf, darunter der Scrollbereich, und der endet
 * dort, wo der Platz endet.
 */
let host: HTMLDivElement
let root: Root

function rendern(kinder: React.ReactNode, inset = true) {
  act(() => {
    root.render(createElement(AppShellMain, { inset }, kinder))
  })
}

const scrollbereich = () => host.querySelector<HTMLElement>("[data-scroll-area]")
const kopf = () => host.querySelector<HTMLElement>("[data-module-toolbar]")

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe("Die Modulfläche ist eine Spalte", () => {
  it("scrollt im Inhalt, nicht in der ganzen Fläche", () => {
    rendern("Inhalt")
    const bereich = scrollbereich()
    expect(bereich, "kein eigener Scrollbereich").not.toBeNull()
    expect(bereich!.className).toContain("overflow-y-auto")
    // Die Fläche selbst scrollt nicht mehr — sonst wanderte der Kopf mit.
    expect(host.querySelector("main")!.className).not.toContain("overflow-y-auto")
  })

  /**
   * Der Scrollbereich endet, wo der Platz endet — nicht am Fensterrand. Sonst
   * sitzt die Leiste rechts NEBEN dem Panel, in einem 16px-Spalt.
   */
  it("hört an der Panelkante auf, statt am Fensterrand", () => {
    rendern("Inhalt")
    const stil = host.querySelector("main")!.getAttribute("style") ?? ""
    expect(stil).toContain("margin-right: var(--adaptive-panel-margin-right, 0px)")
    // Kein Padding mehr: Das schob nur den Inhalt, nicht den Scrollbereich.
    expect(stil).not.toContain("padding-right")
  })

  it("nimmt der Karte den Platz nicht weg", () => {
    rendern("Inhalt", false)
    expect(host.querySelector("main")!.getAttribute("style") ?? "").not.toContain("margin-right")
  })
})

describe("Der Modulkopf bleibt stehen", () => {
  it("nimmt die Steuerleiste aus dem Scrollbereich heraus", () => {
    rendern([
      createElement(ModuleToolbar, { key: "t" }, "FILTERLEISTE"),
      createElement("div", { key: "i" }, "Inhalt"),
    ])

    expect(kopf(), "kein Modulkopf").not.toBeNull()
    expect(kopf()!.textContent).toContain("FILTERLEISTE")
    // Entscheidend: NICHT im Scrollbereich, sonst scrollt sie mit weg.
    expect(scrollbereich()!.textContent).not.toContain("FILTERLEISTE")
    expect(scrollbereich()!.textContent).toContain("Inhalt")
  })

  it("lässt den Kopf weg, wo ein Modul keinen beisteuert", () => {
    rendern("Nur Inhalt")
    expect(kopf()?.textContent ?? "").toBe("")
  })

  /**
   * Ohne Shell darüber — Story, Test, eingebettete Ansicht — bleibt die Leiste
   * an Ort und Stelle, statt spurlos zu verschwinden.
   */
  it("bleibt sichtbar, wo keine Fläche sie aufnimmt", () => {
    act(() => {
      root.render(createElement("div", null, createElement(ModuleToolbar, null, "FILTERLEISTE")))
    })
    expect(host.textContent).toContain("FILTERLEISTE")
  })
})
