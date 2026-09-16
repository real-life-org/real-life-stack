import { describe, expect, it } from "vitest"

import { deriveColorScale, namedScale, scalesForColor } from "../src/lib/color-scales"
import { clearThemeTokens, contrastChecks, SEMANTIC_TOKENS, themeTokens, TOKEN_PAIRS } from "../src/lib/theme-tokens"
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
  // Kein mittleres Grau: dort steht Weiss auf der Fuellung bei 2.85:1 — mit
  // Absicht (siehe getReadableTextColor). Die Kontrastzeilen im Space zeigen
  // es; die Zusicherung hier gilt fuer Akzente, die als solche taugen.
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
          if (!check.guaranteed) continue
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
  it("setzt Fehler-, Warn- und Diagrammfarben gar nicht — sie gehoeren der Instanz", () => {
    // Schriebe die Schicht sie mit, ueberschriebe ein fester Standard in
    // jedem Space das Ocker einer Instanz.
    const t = build("#e87520", "light")
    for (const name of ["--destructive", "--warning", "--pink", "--chart-1", "--chart-5"]) {
      expect(t[name], name).toBeUndefined()
    }
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
    expect(checks.filter((c) => c.guaranteed).every((c) => c.ok), "eine abgeleitete Skala haelt alle garantierten Latten").toBe(true)
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

/**
 * Die Schrift auf der Fuellung ist weiss — reines Weiss, in beiden Schemata.
 * Schwarz nur auf sehr hellen Fuellungen wie Gelb. Antons Entscheidung fuer
 * den Look, begruendet bei `getReadableTextColor`.
 */
describe("themeTokens — Schrift auf der Fuellung", () => {
  it("ist weiss auf einer dunklen Fuellung", () => {
    const gray = namedScale("sand", "light")
    const t = themeTokens({ accent: deriveColorScale("#3e5e2e", "light"), gray, scheme: "light" })
    expect(t["--primary-foreground"]).toBe("#ffffff")
    expect(t["--sidebar-primary-foreground"]).toBe("#ffffff")
  })

  it("ist schwarz auf einer sehr hellen Fuellung", () => {
    const gray = namedScale("sand", "light")
    const t = themeTokens({ accent: deriveColorScale("#ffff00", "light"), gray, scheme: "light" })
    expect(t["--primary-foreground"]).toBe("#000000")
  })

  it("bleibt reines Weiss auf Orange, auch im dunklen Schema", () => {
    for (const scheme of ["light", "dark"] as const) {
      const gray = namedScale("sand", scheme)
      const t = themeTokens({ accent: deriveColorScale("#e87520", scheme), gray, scheme })
      expect(t["--primary-foreground"], scheme).toBe("#ffffff")
    }
  })

  it("haelt auch getoent die garantierten Latten", () => {
    for (const [hex] of CASES) {
      for (const scheme of ["light", "dark"] as const) {
        const { accent, gray } = scalesForColor(hex, scheme, { tint: 1 })
        const t = themeTokens({ accent, gray, scheme })
        for (const check of contrastChecks(t)) {
          if (check.guaranteed) expect(check.ok, `${hex}/${scheme} ${check.label}: ${check.ratio.toFixed(2)}`).toBe(true)
        }
      }
    }
  })
})

describe("clearThemeTokens", () => {
  it("raeumt auch Rundung und Flaechen weg", () => {
    // Sonst bliebe die Rundung eines Space nach dem Wechsel in die
    // Uebersicht stehen — inline schlaegt den Instanz-Block.
    const el = { style: { removed: [] as string[], removeProperty(n: string) { this.removed.push(n) } } } as unknown as HTMLElement
    clearThemeTokens(el)
    const removed = (el.style as unknown as { removed: string[] }).removed
    for (const n of ["--radius", "--surface-alpha", "--surface-blur", "--background"]) expect(removed).toContain(n)
  })
})
