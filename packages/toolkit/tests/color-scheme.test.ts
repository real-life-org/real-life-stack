import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Scrollleisten, Auswahlfelder, Datumswähler und ausgefüllte Formularfelder
 * malt der Browser selbst — unsere Tokens erreichen sie nicht. `color-scheme`
 * ist die einzige Stelle, an der man ihm sagt, in welchem Modus er das tun
 * soll. Ohne die Angabe bleibt alles hell: in Chrome ein heller Balken quer
 * durch ein dunkles Fenster.
 */
const css = readFileSync(join(__dirname, "../src/styles/globals.css"), "utf8")

function blockVon(selektor: string): string {
  const start = css.indexOf(`${selektor} {`)
  expect(start, `${selektor} nicht gefunden`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf("\n}", start))
}

describe("Der Browser malt seine eigenen Flächen mit", () => {
  it("nennt das helle Schema in der Wurzel", () => {
    expect(blockVon(":root")).toMatch(/color-scheme:\s*light/)
  })

  it("nennt das dunkle Schema im Dark-Block", () => {
    expect(blockVon(".dark")).toMatch(/color-scheme:\s*dark/)
  })

  /**
   * Die Leiste ist eine Ortsangabe, keine Fläche: schmal, und ohne eigene
   * Spur — ein grauer Kanal neben dem Inhalt zieht Aufmerksamkeit auf sich,
   * die dem Inhalt gehört.
   */
  it("lässt die Spur der Scrollleiste durchsichtig", () => {
    // `scrollbar-color` vererbt sich, `scrollbar-width` nicht — sonst bleibt
    // jeder innere Scrollbereich bei der breiten Voreinstellung.
    expect(blockVon(":root")).toMatch(/scrollbar-color:[^;]*transparent/)
    expect(blockVon("*")).toMatch(/scrollbar-width:\s*thin/)
    expect(blockVon(".dark")).toMatch(/scrollbar-color:[^;]*transparent/)
  })
})
