import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { getTagColor } from "../src/lib/utils"

/**
 * Tailwind erzeugt nur Klassen, die es in gescannten Dateien SIEHT. Die
 * Tag-Palette steht in `lib/utils.ts`, die Apps scannen im Toolkit aber nur
 * `.tsx` — und die App-Konfiguration ist nicht Sache des Toolkits. Vier der
 * fuenf Farben kamen zufaellig anderswo vor, Rosa nirgends: Ein Fuenftel
 * aller Tags („nachbarschaft", „gemeinschaft", „sharing") war farblos.
 *
 * Darum meldet die Palette ihre Klassen selbst an, in `globals.css` per
 * `@source inline(...)`, das jede App ohnehin importiert. Dieser Test haelt
 * fest, dass jede Klasse der Palette dort steht.
 */
describe("Die Tag-Palette meldet ihre Klassen selbst an", () => {
  const css = readFileSync(join(__dirname, "../src/styles/globals.css"), "utf8")
  const inlineBloecke = [...css.matchAll(/@source inline\(\s*"([^"]*)"\s*\)/g)].map((m) => m[1]!)
  const angemeldet = new Set(inlineBloecke.flatMap((b) => b.split(/\s+/)).filter(Boolean))

  // Fuenf Tags, die auf fuenf verschiedene Farben fallen — gefunden, nicht
  // geraten: Die Zuordnung ist ein Hash, und der Test soll nicht davon
  // abhaengen, welche Woerter gerade wohin fallen.
  const eimer = new Map<string, string>()
  for (let i = 0; eimer.size < 5 && i < 500; i++) {
    const tag = `t${i}`
    const farbe = getTagColor(tag)
    if (!eimer.has(farbe)) eimer.set(farbe, tag)
  }

  it("kennt fuenf Farben", () => {
    expect(eimer.size).toBe(5)
  })

  it("hat jede Klasse jeder Farbe in globals.css angemeldet", () => {
    for (const [farbe] of eimer) {
      for (const klasse of farbe.split(/\s+/)) {
        expect(angemeldet.has(klasse), `${klasse} fehlt in @source inline`).toBe(true)
      }
    }
  })
})
