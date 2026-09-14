import { describe, expect, it } from "vitest"
import {
  contrastLevel,
  contrastRatio,
  formatOklch,
  oklchToHex,
  oklchToRgb,
  parseColor,
  rgbToOklch,
} from "../src/lib/oklch"

/**
 * Referenzwerte aus Bjoern Ottossons Veroeffentlichung und aus dem, was
 * Chrome fuer dieselben Farben rechnet. Toleranzen sind grosszuegig genug
 * fuer Gleitkomma, eng genug, dass eine vertauschte Matrixzeile auffiele.
 */
describe("oklch: Konversion", () => {
  it("Weiss ist L=1 ohne Buntheit", () => {
    const w = rgbToOklch(1, 1, 1)
    expect(w.l).toBeCloseTo(1, 3)
    expect(w.c).toBeCloseTo(0, 3)
    expect(w.h).toBe(0)
  })

  it("Schwarz ist L=0", () => {
    expect(rgbToOklch(0, 0, 0).l).toBeCloseTo(0, 3)
  })

  it("sRGB-Rot liegt bei oklch(0.628 0.258 29.2)", () => {
    const r = rgbToOklch(1, 0, 0)
    expect(r.l).toBeCloseTo(0.628, 2)
    expect(r.c).toBeCloseTo(0.258, 2)
    expect(r.h).toBeCloseTo(29.2, 0)
  })

  it("Hin und zurueck landet bei derselben Farbe", () => {
    for (const [r, g, b] of [[0.2, 0.5, 0.8], [0.9, 0.1, 0.4], [0.5, 0.5, 0.5], [0.05, 0.95, 0.3]]) {
      const back = oklchToRgb(rgbToOklch(r, g, b))
      expect(back.r).toBeCloseTo(r, 3)
      expect(back.g).toBeCloseTo(g, 3)
      expect(back.b).toBeCloseTo(b, 3)
      expect(back.inGamut).toBe(true)
    }
  })

  it("meldet Farben ausserhalb des sRGB-Gamuts", () => {
    // Ein sehr helles, sehr kraeftiges Orange gibt es auf sRGB nicht.
    expect(oklchToRgb({ l: 0.9, c: 0.3, h: 55 }).inGamut).toBe(false)
    expect(oklchToRgb({ l: 0.55, c: 0.21, h: 264 }).inGamut).toBe(true)
    expect(oklchToRgb({ l: 0.5, c: 0, h: 0 }).inGamut).toBe(true)
  })

  it("das Toolkit-Primaer steht knapp neben dem Gamut — der Browser mappt es", () => {
    // oklch(0.63 0.16 55) ergibt einen Blaukanal von etwa -14/255. Chrome
    // zieht dafuer die Buntheit zurueck (CSS Color 4). Das Panel zeigt dazu
    // ein Warndreieck — richtig so: wer die Farbe uebernimmt, soll wissen,
    // dass der Bildschirm eine Naeherung malt.
    expect(oklchToRgb({ l: 0.63, c: 0.16, h: 55 }).inGamut).toBe(false)
  })

  it("hex-Ausgabe", () => {
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe("#ffffff")
    expect(oklchToHex({ l: 0, c: 0, h: 0 })).toBe("#000000")
    expect(oklchToHex(parseColor("#2563eb")!)).toBe("#2563eb")
  })
})

describe("oklch: Formatierung", () => {
  it("schreibt wie die Token-Datei", () => {
    expect(formatOklch({ l: 0.63, c: 0.16, h: 55 })).toBe("oklch(0.630 0.160 55.0)")
    expect(formatOklch({ l: 1, c: 0, h: 0 })).toBe("oklch(1.000 0.000 0.0)")
  })
  it("Deckkraft nur, wenn sie unter 1 liegt", () => {
    expect(formatOklch({ l: 0.5, c: 0.1, h: 10, alpha: 0.5 })).toBe("oklch(0.500 0.100 10.0 / 0.50)")
    expect(formatOklch({ l: 0.5, c: 0.1, h: 10, alpha: 1 })).toBe("oklch(0.500 0.100 10.0)")
  })
  it("kein -0", () => {
    expect(formatOklch({ l: 0.5, c: -0.0001, h: -0.001 })).toBe("oklch(0.500 0.000 0.0)")
  })
})

describe("oklch: Parser", () => {
  it("oklch() in der Schreibweise des Toolkits", () => {
    expect(parseColor("oklch(0.63 0.16 55)")).toEqual({ l: 0.63, c: 0.16, h: 55 })
    expect(parseColor("  oklch(0.975 0.003 70)  ")).toEqual({ l: 0.975, c: 0.003, h: 70 })
  })
  it("oklch() mit Prozent, Einheiten und Deckkraft", () => {
    expect(parseColor("oklch(50% 25% 180deg / 50%)")).toEqual({ l: 0.5, c: 0.1, h: 180, alpha: 0.5 })
    expect(parseColor("oklch(0.5 0.1 0.5turn)")).toEqual({ l: 0.5, c: 0.1, h: 180 })
  })
  it("hex in drei Laengen", () => {
    const long = parseColor("#2563eb")!
    const short = parseColor("#fff")!
    expect(short.l).toBeCloseTo(1, 3)
    expect(long.h).toBeCloseTo(parseColor("rgb(37, 99, 235)")!.h, 3)
    expect(parseColor("#ff000080")?.alpha).toBeCloseTo(0.5, 2)
  })
  it("rgb() und hsl() in beiden Schreibweisen", () => {
    const a = parseColor("rgb(255 0 0)")!
    const b = parseColor("rgba(255, 0, 0, 1)")!
    expect(a.h).toBeCloseTo(b.h, 3)
    const c = parseColor("hsl(0 100% 50%)")!
    expect(c.l).toBeCloseTo(a.l, 3)
    expect(c.c).toBeCloseTo(a.c, 3)
  })
  it("verwirft, was keine Farbe ist", () => {
    expect(parseColor("var(--primary)")).toBeNull()
    expect(parseColor("transparent")).toBeNull()
    expect(parseColor("linear-gradient(red, blue)")).toBeNull()
    expect(parseColor("")).toBeNull()
    expect(parseColor("oklch(0.5)")).toBeNull()
  })
})

describe("oklch: Kontrast", () => {
  const white = { l: 1, c: 0, h: 0 }
  const black = { l: 0, c: 0, h: 0 }
  it("Schwarz auf Weiss ist 21:1, gleich ist 1:1", () => {
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1)
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1)
    expect(contrastRatio(white, white)).toBeCloseTo(1, 3)
  })
  it("Toolkit-Primaer auf Weiss liegt unter AA fuer Fliesstext", () => {
    // oklch(0.63 0.16 55) auf Weiss: ca. 3.4 — reicht fuer grosse Schrift, nicht fuer Fliesstext.
    const ratio = contrastRatio(parseColor("oklch(0.63 0.16 55)")!, white)
    expect(ratio).toBeGreaterThan(3)
    expect(ratio).toBeLessThan(4.5)
    expect(contrastLevel(ratio)).toBe("AA-large")
  })
  it("Einstufung an den Schwellen", () => {
    expect(contrastLevel(7)).toBe("AAA")
    expect(contrastLevel(4.5)).toBe("AA")
    expect(contrastLevel(3)).toBe("AA-large")
    expect(contrastLevel(2.99)).toBe("fail")
  })
})
