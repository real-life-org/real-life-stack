// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ModuleToolbar } from "../src/components/layout/module-toolbar"

/**
 * Zwei Beobachtungen, eine Ursache: Die Scrollleiste klemmte im 16px-Spalt
 * rechts neben dem Panel, und die Modul-Steuerleiste scrollte mit weg.
 *
 * Die Leiste bleibt jetzt oben kleben — IM Container des Moduls, nicht in
 * einem eigenen Kopf darueber. Der erste Versuch tat Letzteres und handelte
 * sich damit eine zweite Geometrie ein: Die Leiste sass am Fensterrand,
 * waehrend die Karten zentriert standen.
 */
describe("Die Steuerleiste bleibt oben", () => {
  const html = renderToStaticMarkup(<ModuleToolbar>FILTERLEISTE</ModuleToolbar>)

  it("klebt am oberen Rand des Scrollbereichs", () => {
    expect(html).toContain("sticky")
    expect(html).toContain("top-0")
  })

  it("deckt den durchscrollenden Inhalt ab", () => {
    // Ohne eigene Flaeche schiene der Inhalt beim Scrollen durch die Leiste.
    expect(html).toContain("bg-background")
    expect(html).toContain("z-20")
  })

  it("zieht ihre Flaeche ueber den Rand des Containers", () => {
    // Der Container gibt 16px Rand; ohne das Herausziehen bliebe links und
    // rechts ein Streifen, durch den der Inhalt sichtbar vorbeizieht.
    expect(html).toContain("-mx-4")
    expect(html).toContain("px-4")
  })

  it("traegt keine eigene Geometrie", () => {
    // Randabstand, Zentrierung und Hoechstbreite kommen vom Container des
    // Moduls — eine zweite Angabe daneben driftet.
    expect(html).not.toContain("container")
    expect(html).not.toContain("mx-auto")
    expect(html).not.toMatch(/max-w-/)
  })
})
