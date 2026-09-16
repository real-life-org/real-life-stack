import { describe, expect, it } from "vitest"

import {
  ACCENT_SCALE_NAMES,
  colorDistance,
  deriveColorScale,
  namedScale,
  pickTemplate,
  type ColorScheme,
} from "../src/lib/color-scales"
import { parseColor } from "../src/lib/oklch"

const oklch = (hex: string) => {
  const c = parseColor(hex)
  if (!c) throw new Error(`Unlesbar: ${hex}`)
  return c
}

/**
 * Der Massstab fuer "nah genug": der Abstand zwischen zwei BENACHBARTEN
 * Stufen derselben Skala. Bleibt der Fehler darunter, liegt jede abgeleitete
 * Stufe naeher an ihrem Ziel als an der Nachbarstufe — dann traegt sie ihre
 * Rolle (Flaeche, Rahmen, Text) noch richtig.
 */
function meanStepDistance(scheme: ColorScheme): number {
  let sum = 0
  let count = 0
  for (const name of ACCENT_SCALE_NAMES) {
    const scale = namedScale(name, scheme).map(oklch)
    for (let i = 0; i < 11; i++) {
      sum += colorDistance(scale[i], scale[i + 1])
      count++
    }
  }
  return sum / count
}

/**
 * Der Pruefstein, absichtlich strenger als die Wirklichkeit.
 *
 * Fuer jede Radix-Skala wird ihre Stufe 9 durch die Ableitung geschickt —
 * ABER die Skala selbst ist als Vorlage gesperrt. Sonst waere der Test
 * bedeutungslos: die naechstliegende Vorlage zu einer Radix-Farbe ist ihre
 * eigene Skala, und das Ergebnis kaeme unveraendert zurueck.
 *
 * Gemessen wird also, wie gut die Ableitung eine Skala rekonstruiert, die
 * sie nie gesehen hat. In der Anwendung ist der Fehler kleiner, weil dort
 * die wirklich naechste Vorlage zur Verfuegung steht.
 */
function measureLeaveOneOut(scheme: ColorScheme) {
  let sum = 0
  let count = 0
  let worst = 0
  let worstAt = ""
  for (const name of ACCENT_SCALE_NAMES) {
    const want = namedScale(name, scheme)
    const derived = deriveColorScale(want[8], scheme, { excludeTemplate: name })
    for (let i = 0; i < 12; i++) {
      const d = colorDistance(oklch(derived[i]), oklch(want[i]))
      sum += d
      count++
      if (d > worst) {
        worst = d
        worstAt = `${name}${i + 1}`
      }
    }
  }
  return { mean: sum / count, worst, worstAt }
}

describe("deriveColorScale — Pruefstein an allen Radix-Skalen", () => {
  it("kennt ueberhaupt genug Vorlagen", () => {
    expect(ACCENT_SCALE_NAMES.length).toBeGreaterThanOrEqual(20)
    expect(ACCENT_SCALE_NAMES).toContain("jade")
    // Die neutralen Skalen gehoeren NICHT dazu: ihre Stufe 9 ist beinahe
    // unbunt, jede bunte Wunschfarbe wuerde beim Verschieben entgleisen.
    expect(ACCENT_SCALE_NAMES).not.toContain("slate")
    expect(ACCENT_SCALE_NAMES).not.toContain("sand")
  })

  for (const scheme of ["light", "dark"] as const) {
    it(`rekonstruiert ${scheme} deutlich genauer als einen Stufenabstand`, () => {
      const { mean, worst, worstAt } = measureLeaveOneOut(scheme)
      const step = meanStepDistance(scheme)

      // Im Mittel um ein Vielfaches besser als der Stufenabstand.
      expect(mean, `Mittel ${mean.toFixed(4)} gegen Stufenabstand ${step.toFixed(4)}`)
        .toBeLessThan(step / 4)
      // Und auch der schlechteste Fall bleibt darunter.
      expect(worst, `schlechtester Fall bei ${worstAt}`).toBeLessThan(step)
    })
  }
})

describe("deriveColorScale — Form der Skala", () => {
  it("trifft eine Wunschfarbe, die als Fuellflaeche taugt, auf Stufe 9", () => {
    for (const hex of ["#e87520", "#2d5a3d", "#16a34a"]) {
      const scale = deriveColorScale(hex, "light")
      expect(colorDistance(oklch(scale[8]), oklch(hex)), hex).toBeLessThan(0.01)
    }
  })

  /**
   * Eine Fuellflaeche kann nicht fast schwarz sein — sie traegt Text, und
   * unter ihr liegen weitere Stufen. Eine solche Wunschfarbe wird in der
   * HELLIGKEIT angehoben; Farbton und Buntheit bleiben, denn sie machen die
   * Identitaet aus.
   */
  it("hebt eine zu dunkle Wunschfarbe an, behaelt aber ihren Ton", () => {
    const wish = oklch("#123456")
    const got = oklch(deriveColorScale("#123456", "light")[8])
    expect(got.l, "heller geworden").toBeGreaterThan(wish.l)
    expect(Math.abs(got.h - wish.h), "Farbton gehalten").toBeLessThan(6)
  })

  it("laesst die Enden bei der Vorlage — sonst liefe die Skala aus dem Bereich", () => {
    const hex = "#ffff00"
    const template = pickTemplate(oklch(hex))
    const derived = deriveColorScale(hex, "light")
    const original = namedScale(template, "light")
    expect(colorDistance(oklch(derived[0]), oklch(original[0]))).toBeLessThan(0.01)
    expect(colorDistance(oklch(derived[11]), oklch(original[11]))).toBeLessThan(0.01)
  })

  it("liefert in beiden Schemata zwoelf lesbare Hex-Werte", () => {
    for (const scheme of ["light", "dark"] as const) {
      const scale = deriveColorScale("#e87520", scheme)
      expect(scale).toHaveLength(12)
      for (const step of scale) expect(step).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it("wird von hell nach dunkel durchgehend dunkler", () => {
    // Die Rollen haengen daran: Stufe 1 traegt Flaechen, Stufe 12 den Text.
    const scale = deriveColorScale("#e87520", "light").map(oklch)
    expect(scale[0].l).toBeGreaterThan(scale[11].l)
  })

  /** Ein blasses Braun darf nicht bei `orange` landen, das ebenso heisst. */
  it("waehlt die Vorlage nach Buntheit, nicht nur nach Farbton", () => {
    const bronze9 = namedScale("bronze", "light")[8]
    const orange9 = namedScale("orange", "light")[8]
    expect(pickTemplate(oklch(bronze9))).toBe("bronze")
    expect(pickTemplate(oklch(orange9))).toBe("orange")
    // Beide liegen im Farbton dicht beieinander, in der Buntheit weit.
    expect(Math.abs(oklch(bronze9).h - oklch(orange9).h)).toBeLessThan(5)
  })
})

/**
 * Der Pruefstein oben misst nur Radix-Farben — die sind allesamt bunt und
 * mittelhell. Eine frei gewaehlte Farbe ist das nicht: Weiss, Schwarz und
 * Grau liegen ausserhalb von allem, was dort vorkommt, und genau dort brach
 * die Ableitung.
 */
describe("deriveColorScale — Randfaelle freier Farben", () => {
  const chroma = (hex: string) => oklch(hex).c

  it("bleibt bei unbunten Eingaben unbunt", () => {
    // Die Vorlage brachte ihre eigene Buntheit mit: aus Weiss wurde eine
    // Skala, deren Textstufe rosa war (#512f38).
    for (const neutral of ["#ffffff", "#000000", "#808080", "#f5f5f5"]) {
      for (const scheme of ["light", "dark"] as const) {
        const scale = deriveColorScale(neutral, scheme)
        for (const [i, step] of scale.entries()) {
          expect(chroma(step), `${neutral} ${scheme} Stufe ${i + 1} = ${step}`).toBeLessThan(0.03)
        }
      }
    }
  })

  it("haelt die Stufen auch bei extremen Eingaben auseinander", () => {
    // Bei Schwarz in Dunkel fielen Stufe 7 und 8 auf denselben Wert: der
    // normale und der hervorgehobene Rahmen waren nicht zu unterscheiden.
    for (const extreme of ["#000000", "#ffffff", "#0d0d0d", "#fdfdfd"]) {
      for (const scheme of ["light", "dark"] as const) {
        const scale = deriveColorScale(extreme, scheme)
        const seen = new Set(scale)
        expect(seen.size, `${extreme} ${scheme}: ${scale.join(" ")}`).toBe(12)
      }
    }
  })

  it("bleibt in der Helligkeit durchgehend gerichtet", () => {
    for (const hex of ["#000000", "#ffffff", "#808080", "#e87520"]) {
      for (const scheme of ["light", "dark"] as const) {
        const steps = deriveColorScale(hex, scheme).map(oklch)
        for (let i = 0; i < 11; i++) {
          // Hell laeuft von hell nach dunkel, Dunkel andersherum.
          const ordered = scheme === "light" ? steps[i].l > steps[i + 1].l : steps[i].l < steps[i + 1].l
          expect(ordered, `${hex} ${scheme} Stufe ${i + 1}→${i + 2}`).toBe(true)
        }
      }
    }
  })
})
