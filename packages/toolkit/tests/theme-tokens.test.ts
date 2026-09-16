import { describe, expect, it } from "vitest"

import { deriveColorScale, namedScale } from "../src/lib/color-scales"
import { SEMANTIC_TOKENS, themeTokens } from "../src/lib/theme-tokens"
import { contrastRatio, parseColor } from "../src/lib/oklch"

const ok = (hex: string) => {
  const c = parseColor(hex)
  if (!c) throw new Error(`Unlesbar: ${hex}`)
  return c
}
const ratio = (a: string, b: string) => contrastRatio(ok(a), ok(b))

const build = (accentHex: string, scheme: "light" | "dark") =>
  themeTokens({
    accent: deriveColorScale(accentHex, scheme),
    gray: namedScale("slate", scheme),
    scheme,
  })

/** Farben, an denen sich die Schicht bewaehren muss. */
const CASES: [string, string][] = [
  ["#e87520", "Orange"],
  ["#2d5a3d", "dunkles Gruen"],
  ["#3b82f6", "Blau"],
  ["#ffff00", "Gelb"],
  ["#000000", "Schwarz"],
  // Mittleres Grau: hier waehlte die alte Helligkeitsschwelle weissen
  // Knopftext mit 2.85:1.
  ["#999999", "mittleres Grau"],
  ["#ffffff", "Weiss"],
]

describe("themeTokens — Vollstaendigkeit", () => {
  it("setzt jedes Token, das die Flaechen erwarten", () => {
    const tokens = build("#e87520", "light")
    for (const name of SEMANTIC_TOKENS) {
      expect(tokens[name], name).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it("laesst nichts uebrig, was niemand erwartet", () => {
    const tokens = build("#e87520", "light")
    for (const name of Object.keys(tokens)) {
      expect(SEMANTIC_TOKENS, name).toContain(name)
    }
  })
})

/**
 * Die eigentliche Zusage. Eine frei gewaehlte Farbe darf keine Flaeche
 * erzeugen, auf der man den Text nicht mehr liest.
 *
 * WCAG 2 unterscheidet dabei, und dieser Test tut es auch: Fliesstext
 * braucht 4.5:1, grosse oder fette Schrift und Bedienelemente 3:1. Die
 * Fuellflaeche (Stufe 9) traegt Knoepfe und Abzeichen — dort ist 3:1 die
 * richtige Latte, und Radix legt seine eigenen Skalen genau darauf aus.
 * Eine pauschale 4.5 waere keine Strenge, sondern ein falscher Massstab:
 * sie wuerde jede kraeftige Akzentfarbe verbieten.
 */
describe("themeTokens — Lesbarkeit", () => {
  const TEXT_PAIRS: [string, string, number][] = [
    ["--foreground", "--background", 4.5],
    ["--card-foreground", "--card", 4.5],
    ["--popover-foreground", "--popover", 4.5],
    ["--muted-foreground", "--background", 4.5],
    ["--muted-foreground", "--muted", 4.5],
    ["--secondary-foreground", "--secondary", 4.5],
    // Knopfbeschriftung, fett — 3:1 nach WCAG fuer Bedienelemente.
    ["--primary-foreground", "--primary", 3],
    ["--accent-foreground", "--accent", 4.5],
    ["--sidebar-foreground", "--sidebar", 4.5],
    ["--sidebar-primary-foreground", "--sidebar-primary", 3],
    ["--sidebar-accent-foreground", "--sidebar-accent", 4.5],
  ]

  for (const [hex, name] of CASES) {
    for (const scheme of ["light", "dark"] as const) {
      it(`haelt Text lesbar: ${name} in ${scheme}`, () => {
        const t = build(hex, scheme)
        for (const [fg, bg, min] of TEXT_PAIRS) {
          const r = ratio(t[fg], t[bg])
          expect(r, `${fg} auf ${bg} = ${r.toFixed(2)}:1 (${t[fg]} auf ${t[bg]})`)
            .toBeGreaterThanOrEqual(min)
        }
      })
    }
  }

  it("haelt Rahmen und Fokusring vom Untergrund unterscheidbar", () => {
    for (const [hex, name] of CASES) {
      for (const scheme of ["light", "dark"] as const) {
        const t = build(hex, scheme)
        // Rahmen muessen nicht lesbar, aber sichtbar sein.
        expect(ratio(t["--border"], t["--background"]), `${name}/${scheme} Rahmen`)
          .toBeGreaterThan(1.1)
        // WCAG 2.2: Fokusindikatoren brauchen 3:1 gegen ihre Umgebung.
        expect(ratio(t["--ring"], t["--background"]), `${name}/${scheme} Fokusring`)
          .toBeGreaterThanOrEqual(3)
      }
    }
  })
})

/**
 * Fehler- und Warnfarben gehoeren NICHT dem Space. Rot muss rot bleiben,
 * auch wenn jemand seinen Space rot faerbt — sonst verlieren sie ihre
 * Bedeutung genau dann, wenn es darauf ankommt.
 */
describe("themeTokens — was dem Space nicht gehoert", () => {
  it("haelt Fehler- und Warnfarbe unabhaengig von der Akzentfarbe", () => {
    const a = build("#e87520", "light")
    const b = build("#3b82f6", "light")
    expect(a["--destructive"]).toBe(b["--destructive"])
    expect(a["--warning"]).toBe(b["--warning"])
  })

  it("laesst die Akzentfarbe dagegen wirklich durchschlagen", () => {
    const a = build("#e87520", "light")
    const b = build("#3b82f6", "light")
    expect(a["--primary"]).not.toBe(b["--primary"])
    expect(a["--ring"]).not.toBe(b["--ring"])
  })
})
