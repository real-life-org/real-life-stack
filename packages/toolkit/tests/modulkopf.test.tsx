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

/**
 * Der Abstand nach unten gehört der Leiste allein.
 *
 * Vorher trugen ihn zwei: die eigene Polsterung und der Container
 * (`space-y-*`). Im Ruhezustand zählten beide, beim Kleben nur die eigene —
 * der Inhalt rückte beim Scrollen also näher heran. Gemessen sprang er im Feed
 * von 28 auf 12 Pixel. Dazu kam, dass die Module unterschiedliche
 * Container-Abstände haben (`space-y-4` im Feed, `space-y-3` im Kalender), die
 * Leiste also je nach Modul anders stand.
 */
describe("Der Abstand der Steuerleiste", () => {
  const html = renderToStaticMarkup(<ModuleToolbar>x</ModuleToolbar>)

  it("bringt ihn selbst mit", () => {
    // 16px — derselbe Abstand wie vor dem Umbau, als ihn allein `space-y-4`
    // des Containers trug.
    expect(html).toContain("pb-4")
  })

  it("nimmt den Abstand des Containers weg, statt ihn zu addieren", () => {
    // `space-y-*` setzt in Tailwind v4 ein margin-bottom auf jedes Kind außer
    // dem letzten — es sitzt also an der Leiste selbst, nicht am Nachbarn.
    expect(html).toContain("mb-0!")
  })
})
