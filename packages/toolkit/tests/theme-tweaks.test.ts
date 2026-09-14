import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  adjust,
  ALL_TOKEN_NAMES,
  CONTRAST_PAIRS,
  contrastReport,
  EMPTY_TWEAKS,
  hasTweaks,
  IDENTITY,
  loadStoredTweaks,
  resolveScheme,
  storeTweaks,
  STORAGE_KEY,
  toThemeJson,
  type ThemeTweaks,
} from "../src/lib/theme-tweaks"
import type { Oklch } from "../src/lib/oklch"

const css = readFileSync(join(__dirname, "../src/styles/globals.css"), "utf8")

describe("theme-tweaks: Token-Liste", () => {
  it("nennt nur Tokens, die globals.css im hellen UND dunklen Schema definiert", () => {
    // Ein Token, das hier steht, aber im CSS fehlt, wuerde beim Branding
    // verworfen (knownTokens in runtime-config.ts) — der Regler liefe ins Leere.
    for (const name of ALL_TOKEN_NAMES) {
      const matches = css.match(new RegExp(`^\\s*--${name}:`, "gm")) ?? []
      expect(matches.length, `--${name}`).toBeGreaterThanOrEqual(2)
    }
  })
  it("Kontrastpaare verweisen nur auf bekannte Tokens", () => {
    for (const pair of CONTRAST_PAIRS) {
      expect(ALL_TOKEN_NAMES).toContain(pair.fg)
      expect(ALL_TOKEN_NAMES).toContain(pair.bg)
    }
  })
  it("ohne Duplikate", () => {
    expect(new Set(ALL_TOKEN_NAMES).size).toBe(ALL_TOKEN_NAMES.length)
  })
})

describe("theme-tweaks: globale Regler", () => {
  const c: Oklch = { l: 0.6, c: 0.2, h: 350 }
  it("Identitaet aendert nichts — und gibt dasselbe Objekt zurueck", () => {
    expect(adjust(c, IDENTITY)).toBe(c)
  })
  it("Helligkeit addiert und begrenzt", () => {
    expect(adjust(c, { ...IDENTITY, lightness: 0.1 }).l).toBeCloseTo(0.7)
    expect(adjust(c, { ...IDENTITY, lightness: 0.9 }).l).toBe(1)
    expect(adjust(c, { ...IDENTITY, lightness: -0.9 }).l).toBe(0)
  })
  it("Kontrast streckt um die Mitte", () => {
    expect(adjust({ ...c, l: 0.8 }, { ...IDENTITY, contrast: 1.5 }).l).toBeCloseTo(0.95)
    expect(adjust({ ...c, l: 0.2 }, { ...IDENTITY, contrast: 1.5 }).l).toBeCloseTo(0.05)
    expect(adjust({ ...c, l: 0.5 }, { ...IDENTITY, contrast: 1.5 }).l).toBeCloseTo(0.5)
  })
  it("Saettigung skaliert C, Farbton dreht modulo 360", () => {
    expect(adjust(c, { ...IDENTITY, chroma: 0.5 }).c).toBeCloseTo(0.1)
    expect(adjust(c, { ...IDENTITY, hue: 20 }).h).toBeCloseTo(10)
    expect(adjust(c, { ...IDENTITY, hue: -360 }).h).toBeCloseTo(350)
  })
  it("laesst die Deckkraft in Ruhe", () => {
    expect(adjust({ ...c, alpha: 0.4 }, { ...IDENTITY, hue: 1 }).alpha).toBe(0.4)
    expect(adjust(c, { ...IDENTITY, hue: 1 })).not.toHaveProperty("alpha")
  })
})

describe("theme-tweaks: Aufloesen und Export", () => {
  const base: Record<string, Oklch> = {
    primary: { l: 0.63, c: 0.16, h: 55 },
    "primary-foreground": { l: 1, c: 0, h: 0 },
    background: { l: 0.975, c: 0.003, h: 70 },
  }

  it("ohne Anpassung: nichts", () => {
    expect(resolveScheme(base, EMPTY_TWEAKS.light)).toEqual({})
    expect(toThemeJson(EMPTY_TWEAKS, { light: base })).toEqual({})
  })

  it("nur veraenderte Tokens landen in der Datei", () => {
    const tweaks: ThemeTweaks = {
      ...EMPTY_TWEAKS,
      light: { tokens: { primary: { l: 0.5, c: 0.2, h: 150 } }, global: IDENTITY },
    }
    expect(toThemeJson(tweaks, { light: base })).toEqual({ light: { primary: "oklch(0.500 0.200 150.0)" } })
  })

  it("ein Einzelwert, der der Basis gleicht, ist keine Aenderung", () => {
    const tweaks: ThemeTweaks = {
      ...EMPTY_TWEAKS,
      light: { tokens: { primary: { l: 0.63, c: 0.16, h: 55 } }, global: IDENTITY },
    }
    expect(resolveScheme(base, tweaks.light)).toEqual({})
  })

  it("globale Regler wirken auf alle Tokens, Einzelwerte davor", () => {
    const tweaks: ThemeTweaks = {
      ...EMPTY_TWEAKS,
      light: { tokens: { primary: { l: 0.5, c: 0.2, h: 150 } }, global: { ...IDENTITY, hue: 10 } },
    }
    const out = resolveScheme(base, tweaks.light)
    expect(out.primary).toBe("oklch(0.500 0.200 160.0)")
    expect(out.background).toBe("oklch(0.975 0.003 80.0)")
    // Weiss hat keine Buntheit — eine Drehung aendert seinen Wert nicht.
    expect(out).not.toHaveProperty("primary-foreground")
  })

  it("ein Schema ohne gelesene Basis: nur Einzelwerte, keine globalen", () => {
    const tweaks: ThemeTweaks = {
      light: { tokens: {}, global: { ...IDENTITY, lightness: 0.1 } },
      dark: { tokens: { primary: { l: 0.7, c: 0.1, h: 30 } }, global: { ...IDENTITY, lightness: 0.1 } },
    }
    expect(toThemeJson(tweaks, {})).toEqual({ dark: { primary: "oklch(0.800 0.100 30.0)" } })
  })
})

describe("theme-tweaks: Kontrastbericht", () => {
  it("bewertet Paare gegen ihre Schwelle und laesst unlesbare aus", () => {
    const base: Record<string, Oklch> = {
      primary: { l: 0.63, c: 0.16, h: 55 },
      "primary-foreground": { l: 1, c: 0, h: 0 },
      background: { l: 1, c: 0, h: 0 },
      foreground: { l: 0, c: 0, h: 0 },
    }
    const report = contrastReport(base, EMPTY_TWEAKS.light)
    const labels = report.map((r) => `${r.fg}/${r.bg}`)
    expect(labels).toContain("foreground/background")
    expect(labels).toContain("primary-foreground/primary")
    expect(labels).toContain("primary/background")
    expect(labels).not.toContain("card-foreground/card")
    expect(report.find((r) => r.fg === "foreground")?.ok).toBe(true)
    // Weiss auf dem Toolkit-Orange: ~3.4 — fuer Fliesstext (4.5) zu wenig.
    expect(report.find((r) => r.fg === "primary-foreground")?.ok).toBe(false)
    // Dasselbe Orange als Flaeche auf Weiss braucht nur 3.
    expect(report.find((r) => r.fg === "primary" && r.bg === "background")?.ok).toBe(true)
  })
})

describe("theme-tweaks: Ablage", () => {
  function memStorage(): Storage {
    const m = new Map<string, string>()
    return {
      get length() { return m.size },
      clear: () => m.clear(),
      getItem: (k) => m.get(k) ?? null,
      key: (i) => Array.from(m.keys())[i] ?? null,
      removeItem: (k) => { m.delete(k) },
      setItem: (k, v) => { m.set(k, v) },
    }
  }

  it("Hin und zurueck", () => {
    const s = memStorage()
    const tweaks: ThemeTweaks = {
      light: { tokens: { primary: { l: 0.5, c: 0.2, h: 150 } }, global: { ...IDENTITY, hue: 10 } },
      dark: { tokens: {}, global: IDENTITY },
    }
    storeTweaks(tweaks, s)
    expect(loadStoredTweaks(s)).toEqual(tweaks)
  })

  it("nichts zu speichern: Eintrag wird entfernt", () => {
    const s = memStorage()
    s.setItem(STORAGE_KEY, "{}")
    storeTweaks(EMPTY_TWEAKS, s)
    expect(s.getItem(STORAGE_KEY)).toBeNull()
    expect(hasTweaks(EMPTY_TWEAKS)).toBe(false)
  })

  it("verwirft Fremdes: unbekannte Tokens, kaputte Werte, Muell", () => {
    const s = memStorage()
    s.setItem(
      STORAGE_KEY,
      JSON.stringify({
        light: {
          tokens: { primary: { l: 0.5, c: 0.2, h: 1 }, nope: { l: 0.5, c: 0.2, h: 1 }, background: "red" },
          global: { lightness: "viel", hue: 5 },
        },
        dark: 42,
      }),
    )
    expect(loadStoredTweaks(s)).toEqual({
      light: { tokens: { primary: { l: 0.5, c: 0.2, h: 1 } }, global: { ...IDENTITY, hue: 5 } },
      dark: { tokens: {}, global: IDENTITY },
    })
    s.setItem(STORAGE_KEY, "{not json")
    expect(loadStoredTweaks(s)).toBeNull()
  })
})
