import { describe, expect, it } from "vitest"

import { deriveColorScale, namedScale } from "../src/lib/color-scales"
import { contrastChecks, SEMANTIC_TOKENS, themeTokens, TOKEN_PAIRS } from "../src/lib/theme-tokens"
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
 * Geprueft wird gegen `TOKEN_PAIRS` — dieselbe Liste, die der Space beim
 * Setzen einzelner Stufen anzeigt. Haette der Test seine eigene Kopie,
 * drifteten beide auseinander, und die Anzeige verspraeche etwas, das die
 * Zusicherung nicht deckt.
 */
describe("themeTokens — Lesbarkeit", () => {
  for (const [hex, name] of CASES) {
    for (const scheme of ["light", "dark"] as const) {
      it(`haelt Text lesbar: ${name} in ${scheme}`, () => {
        const t = build(hex, scheme)
        for (const check of contrastChecks(t)) {
          expect(
            check.ok,
            `${check.label}: ${check.ratio.toFixed(2)}:1 (${t[check.foreground]} auf ${t[check.background]}), noetig ${check.minimum}`,
          ).toBe(true)
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

/**
 * Die Anzeige im Space. Wer eine Stufe von Hand setzt, soll sofort sehen,
 * ob dabei etwas unlesbar wird.
 */
describe("contrastChecks", () => {
  it("prueft jedes Paar und meldet, was reicht", () => {
    const checks = contrastChecks(build("#e87520", "light"))
    expect(checks).toHaveLength(TOKEN_PAIRS.length)
    expect(checks.every((c) => c.ok), "eine abgeleitete Skala haelt alle Latten").toBe(true)
    for (const c of checks) expect(c.ratio).toBeGreaterThan(1)
  })

  it("zeigt auf Wunsch nur, was an der Akzentskala haengt", () => {
    const only = contrastChecks(build("#e87520", "light"), { accentOnly: true })
    expect(only.length).toBeGreaterThan(0)
    expect(only.length).toBeLessThan(TOKEN_PAIRS.length)
    expect(only.every((c) => c.accent)).toBe(true)
  })

  it("schlaegt an, wenn eine gesetzte Stufe den Text verschluckt", () => {
    // Genau der Fall, den die Anzeige abfangen soll: jemand setzt die
    // Fuellflaeche auf denselben Ton wie ihre Schrift.
    const tokens = { ...build("#e87520", "light"), "--primary": "#ffffff", "--primary-foreground": "#ffffff" }
    const hit = contrastChecks(tokens, { accentOnly: true }).find((c) => c.label === "Knopfbeschriftung")
    expect(hit?.ok).toBe(false)
    expect(hit?.ratio).toBeCloseTo(1, 1)
  })
})
