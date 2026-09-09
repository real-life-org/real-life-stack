import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Was diese Datei NICHT leisten kann: Sie liest Deklarationen, nicht das, was
 * der Browser daraus errechnet. Genau dort lag der Fehler, den erst eine
 * Messung im Browser zeigte — `scrollbar-width` vererbt sich nicht, also blieb
 * die Angabe auf der Wurzel wirkungslos, während `scrollbar-color` ankam. Den
 * berechneten Zustand prüft `e2e/dark-scrollbar.spec.ts`.
 *
 * Der Wert dieser Tests liegt woanders: Sie halten fest, dass die Angaben
 * ueberhaupt dastehen — vier Zeilen, die bei einem Umbau der Token-Datei
 * lautlos verschwinden koennen.
 *
 * Scrollleisten, Auswahlfelder, Datumswähler und ausgefüllte Formularfelder
 * malt der Browser selbst — unsere Tokens erreichen sie nicht. `color-scheme`
 * ist die einzige Stelle, an der man ihm sagt, in welchem Modus er das tun
 * soll. Ohne die Angabe bleibt alles hell: in Chrome ein heller Balken quer
 * durch ein dunkles Fenster.
 */
const css = readFileSync(join(__dirname, "../src/styles/globals.css"), "utf8")

/**
 * Der Rumpf einer Regel, über Klammerzählung statt über die Textform: Ein
 * Umbruch mehr oder ein Kommentar mit `}` darin hätte einen Schnitt bei
 * „\n}" sonst an der falschen Stelle gesetzt — der Test wäre an der
 * Formatierung hängengeblieben statt am Inhalt.
 */
function blockVon(selektor: string): string {
  const kopf = new RegExp(`(^|\\n)\\s*${selektor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`)
  const treffer = kopf.exec(css)
  expect(treffer, `${selektor} nicht gefunden`).not.toBeNull()
  let tiefe = 0
  const start = css.indexOf("{", treffer!.index)
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") tiefe++
    else if (css[i] === "}" && --tiefe === 0) return css.slice(start + 1, i)
  }
  throw new Error(`${selektor}: Regel wird nicht geschlossen`)
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
