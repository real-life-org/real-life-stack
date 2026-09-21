import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Ein Unterpfad, der nur in den Workspace-`exports` steht, fehlt im
 * veroeffentlichten Paket: `pnpm publish` ersetzt `exports` durch
 * `publishConfig.exports`. So verschwand `./router` aus dem Tarball, waehrend
 * `dist/router.js` darin lag (Codex-Review zu #414, rls#415). Der Typecheck im
 * Workspace sieht das nie — er nimmt die `development`-Bedingung.
 */
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  exports: Record<string, unknown>
  publishConfig: { exports: Record<string, unknown> }
}

describe("Paket-Exporte", () => {
  it("jeder Workspace-Unterpfad steht auch im veroeffentlichten Paket — und umgekehrt", () => {
    expect(Object.keys(pkg.publishConfig.exports).sort()).toEqual(Object.keys(pkg.exports).sort())
  })

  it("jeder veroeffentlichte Unterpfad zeigt auf dist mit Typen, nie auf src", () => {
    for (const [pfad, eintrag] of Object.entries(pkg.publishConfig.exports)) {
      if (typeof eintrag === "string") continue // Stylesheet
      const e = eintrag as Record<string, string>
      expect(e.types, pfad).toMatch(/^\.\/dist\/.*\.d\.ts$/)
      expect(e.import, pfad).toMatch(/^\.\/dist\/.*\.js$/)
      expect(e.development, pfad).toBeUndefined()
    }
  })
})
