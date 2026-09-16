import { describe, expect, it } from "vitest"

import {
  ACCENT_SCALE_NAMES,
  colorDistance,
  deriveColorScale,
  grayFor,
  GRAY_SCALE_OPTIONS,
  namedScale,
  pickTemplate,
  scalesForColor,
  withOverrides,
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

/**
 * Radix paart jede Akzentfarbe mit einem Grauton, der sie ergaenzt
 * ("Your accent color will be automatically paired with a gray shade that
 * complements it"). Die sechs Neutralen tragen dafuer je einen Hauch
 * Farbton — mauve roetlich, slate blaeulich, sage gruenlich, sand gelblich
 * — und `gray` gar keinen.
 *
 * Der Unterschied ist klein: die Neutralen liegen untereinander rund
 * siebenmal enger als zwei benachbarte Stufen einer Skala. Radix nennt ihn
 * selbst "subtil, aber wirkungsvoll bei textlastigen Seiten". Er ersetzt
 * keine Gestaltung — er verhindert, dass warme Akzente auf kalten Flaechen
 * stehen.
 */
describe("grayFor — Paarung von Akzent und Neutral", () => {
  it("waehlt ein Grau, das es wirklich gibt", () => {
    for (const hex of ["#e87520", "#2d5a3d", "#3b82f6", "#9333ea", "#dc2626"]) {
      expect(GRAY_SCALE_OPTIONS).toContain(grayFor(oklch(hex)))
    }
  })

  it("paart nach Farbton: warm zu warm, kuehl zu kuehl", () => {
    // Gelb/Orange → sand (h≈106), Gruen → sage/olive, Blau/Violett → slate,
    // Rot/Pink → mauve. Geprueft wird die Richtung, nicht der Einzelfall.
    const warm = grayFor(oklch("#e87520"))
    const cool = grayFor(oklch("#3b82f6"))
    expect(warm).not.toBe(cool)
    expect(["sand", "olive"]).toContain(warm)
    expect(["slate", "mauve"]).toContain(cool)
  })

  it("nimmt fuer eine unbunte Farbe das reine Grau", () => {
    // Ohne Farbton gibt es nichts zu ergaenzen.
    for (const neutral of ["#ffffff", "#000000", "#808080"]) {
      expect(grayFor(oklch(neutral))).toBe("gray")
    }
  })

  it("bleibt ueber den Farbkreis hinweg stetig", () => {
    // Benachbarte Farbtoene duerfen nicht wild zwischen Neutralen springen.
    const picks = Array.from({ length: 36 }, (_, i) =>
      grayFor({ l: 0.6, c: 0.15, h: i * 10 }))
    const wechsel = picks.filter((g, i) => i > 0 && g !== picks[i - 1]).length
    expect(wechsel, `Wechsel: ${picks.join(" ")}`).toBeLessThanOrEqual(GRAY_SCALE_OPTIONS.length)
  })
})

/**
 * Einzelne Stufen von Hand setzen.
 *
 * Die Ableitung trifft nicht jeden Geschmack, und manchmal will ein Space
 * genau diesen einen Ton. Ueberschrieben wird darum stufenweise: was
 * gesetzt ist, gilt; was fehlt, kommt weiter aus der Ableitung. So bleibt
 * eine Aenderung der Ableitung auch spaeter noch wirksam — anders als beim
 * Einfrieren aller zwoelf Werte.
 */
describe("withOverrides — einzelne Stufen von Hand", () => {
  const base = deriveColorScale("#e87520", "light")

  it("laesst ohne Ueberschreibungen alles, wie es war", () => {
    expect(withOverrides(base, {})).toEqual(base)
    expect(withOverrides(base, undefined)).toEqual(base)
  })

  it("setzt genau die genannte Stufe", () => {
    const got = withOverrides(base, { 9: "#123456" })
    expect(got[8]).toBe("#123456")
    for (let i = 0; i < 12; i++) if (i !== 8) expect(got[i], `Stufe ${i + 1}`).toBe(base[i])
  })

  it("nimmt mehrere Stufen auf einmal", () => {
    const got = withOverrides(base, { 1: "#ffffff", 12: "#000000" })
    expect(got[0]).toBe("#ffffff")
    expect(got[11]).toBe("#000000")
    expect(got[5]).toBe(base[5])
  })

  it("ignoriert Stufen, die es nicht gibt, und unlesbare Werte", () => {
    // Die Werte kommen aus `Group.data` und damit aus dem Sync — was dort
    // steht, ist nicht geprueft.
    const got = withOverrides(base, { 0: "#fff", 13: "#000", 99: "#abc", 5: "kein hex" } as never)
    expect(got).toEqual(base)
  })

  it("nimmt auch Schluessel als Zeichenkette", () => {
    // Aus JSON kommen Objektschluessel immer als Zeichenketten zurueck.
    expect(withOverrides(base, { "9": "#123456" } as never)[8]).toBe("#123456")
  })
})

/**
 * Toenung: die neutrale Skala traegt den Farbton des Akzents, so stark, wie
 * der Space es will. 0 ist Radix' Paarung, unveraendert; 1 ist die kraeftigste
 * Toenung, die noch als "neutral" durchgeht.
 *
 * Gemessen an reallife.network/app: deren Creme (#F6F1E7) hat C 0.014, das
 * ist ungefaehr die Haelfte des Maximums. Die Helligkeit jeder Stufe bleibt
 * dabei, wie Radix sie gesetzt hat — getoent wird, nicht verschoben.
 */
describe("scalesForColor — Toenung der neutralen Skala", () => {
  const accent = "#3e5e2e"

  it("laesst bei 0 die Radix-Paarung unangetastet", () => {
    expect(scalesForColor(accent, "light", { tint: 0 }).gray)
      .toEqual(scalesForColor(accent, "light").gray)
  })

  it("faerbt bei 1 jede Stufe im Farbton des Akzents", () => {
    const { gray } = scalesForColor(accent, "light", { tint: 1 })
    const h = parseColor(accent)!.h
    for (const hex of gray) {
      const c = parseColor(hex)!
      expect(c.c, `${hex} ist getoent`).toBeGreaterThan(0.02)
      expect(Math.abs(c.h - h), `${hex} traegt den Akzentton`).toBeLessThan(12)
    }
  })

  it("aendert die Helligkeit der Stufen nicht", () => {
    const plain = scalesForColor(accent, "dark").gray
    const tinted = scalesForColor(accent, "dark", { tint: 1 }).gray
    for (let i = 0; i < 12; i++) {
      expect(Math.abs(parseColor(tinted[i])!.l - parseColor(plain[i])!.l), `Stufe ${i + 1}`)
        .toBeLessThan(0.012)
    }
  })

  it("liefert gueltige Farben, auch wenn die Toenung den Farbraum ankratzt", () => {
    for (const seed of ["#ffff00", "#0000ff", "#ff00ff"]) {
      for (const scheme of ["light", "dark"] as const) {
        for (const hex of scalesForColor(seed, scheme, { tint: 1 }).gray) {
          expect(hex).toMatch(/^#[0-9a-f]{6}$/)
        }
      }
    }
  })

  it("kappt auf 0 bis 1 und nimmt Nicht-Zahlen als 0", () => {
    // Der Wert kommt aus `Group.data` und ist ungeprueft. Ausserhalb des
    // Bereichs wird gekappt — ein Regler, der 1.2 meldet, meint "voll",
    // nicht "gar nicht". Was keine Zahl ist, meint gar nichts.
    const plain = scalesForColor(accent, "light").gray
    const full = scalesForColor(accent, "light", { tint: 1 }).gray
    expect(scalesForColor(accent, "light", { tint: -1 }).gray).toEqual(plain)
    expect(scalesForColor(accent, "light", { tint: 2 }).gray).toEqual(full)
    for (const tint of [Number.NaN, undefined, "0.5"]) {
      expect(scalesForColor(accent, "light", { tint: tint as number }).gray, String(tint)).toEqual(plain)
    }
  })
})

/**
 * Eine dunkle Akzentfarbe auf dunklem Grund ist dumpf. Radix umgeht das,
 * indem seine kuratierten Skalen Stufe 9 nie unter L 0.54 legen; wir lassen
 * jede Farbe zu, also muss die Regel hier stehen: im dunklen Schema wird die
 * Fuellung angehoben, im hellen bleibt sie, wie gewaehlt.
 *
 * reallife.network/app macht genau das von Hand — hell Forest (L 0.42),
 * dunkel Sage (L 0.64).
 */
describe("deriveColorScale — dunkle Fuellung im dunklen Schema", () => {
  const forest = "#3e5e2e"

  it("hebt eine dunkle Farbe im dunklen Schema an", () => {
    const l = parseColor(deriveColorScale(forest, "dark")[8])!.l
    expect(l).toBeGreaterThanOrEqual(0.58)
  })

  it("behaelt den Farbton dabei", () => {
    const seed = parseColor(forest)!
    const fill = parseColor(deriveColorScale(forest, "dark")[8])!
    expect(Math.abs(fill.h - seed.h)).toBeLessThan(8)
  })

  it("laesst sie im hellen Schema exakt, wie gewaehlt", () => {
    expect(deriveColorScale(forest, "light")[8]).toBe(forest)
  })

  it("laesst eine ohnehin helle Farbe auch dunkel in Ruhe", () => {
    const sage = "#8c9a5b"
    expect(deriveColorScale(sage, "dark")[8]).toBe(sage)
  })

  it("haelt die Reihenfolge der Stufen", () => {
    const l = deriveColorScale(forest, "dark").map((h) => parseColor(h)!.l)
    for (let i = 1; i < 12; i++) expect(l[i], `Stufe ${i + 1} > ${i}`).toBeGreaterThan(l[i - 1])
  })
})
