/**
 * Die Achsen, an denen ein Space sein Aussehen einstellt — als reine
 * Funktionen, damit Dialog und Panel dieselben Regeln tragen.
 */
import { oklchToHex, parseColor } from "./oklch"
import { ACCENT_SCALE_NAMES, GRAY_SCALE_OPTIONS, namedScale, type ColorScheme, type GrayScaleName } from "./color-scales"

/**
 * Was in `data.tint` steht, als Zahl 0–1 — oder null, wenn nichts Brauchbares.
 *
 * Eine explizite 0 ist ein WERT: "keine Toenung, obwohl die Instanz eine
 * hat". Erst `null` (kein Schluessel) heisst "erbt von der Instanz". Wuerde
 * 0 zu null, liesse sich eine geerbte Toenung nie ausschalten — der Regler
 * spraenge nach 0 sofort wieder auf den geerbten Wert (Review #389).
 */
export function readTint(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}

/** Größte Buntheit, die ein Regler anbietet — jenseits davon ist kaum etwas im Farbraum. */
export const CHROMA_MAX = 0.37

export interface ColorAxes {
  hue: number
  chroma: number
  lightness: number
}

/**
 * Die drei Achsen der Akzentfarbe als Reglerstellungen, 0–100 (Farbton 0–360).
 *
 * Kein eigener Zustand: die Regler zeigen die Farbe, die gilt, und schreiben
 * sie zurück. So gibt es genau EINEN Wert (`primaryColor`) und einen Reset.
 */
export function colorAxes(hex: string): ColorAxes {
  const c = parseColor(hex) ?? { l: 0.5, c: 0, h: 0 }
  return {
    hue: Math.round(c.h),
    chroma: Math.round(Math.min(1, c.c / CHROMA_MAX) * 100),
    lightness: Math.round(c.l * 100),
  }
}

/** Die Umkehrung: aus Reglerstellungen wieder eine Farbe (im Farbraum gehalten). */
export function colorFromAxes(axes: ColorAxes): string {
  return oklchToHex({
    l: Math.min(1, Math.max(0, axes.lightness / 100)),
    c: Math.min(1, Math.max(0, axes.chroma / 100)) * CHROMA_MAX,
    h: ((axes.hue % 360) + 360) % 360,
  })
}

/**
 * Rundung — fünf Stufen in Radix' Wortlaut. `--radius` ist bereits die eine
 * Variable, aus der das Toolkit `sm`/`md`/`lg`/`xl` ableitet; die Stufe
 * setzt nur diese eine.
 */
export const RADIUS_STEPS = {
  none: "0rem",
  small: "0.25rem",
  medium: "0.5rem",
  large: "0.75rem",
  full: "1.25rem",
} as const
export type RadiusStep = keyof typeof RADIUS_STEPS
export const RADIUS_ORDER: readonly RadiusStep[] = ["none", "small", "medium", "large", "full"]

/** Flächen der App-Hülle (Navbar, Bottom-Nav, schwebende Leisten): durchscheinend oder deckend. */
export const SURFACES = ["translucent", "solid"] as const
export type Surfaces = (typeof SURFACES)[number]

/** Was in `data.radius` steht — oder null, wenn keine bekannte Stufe. */
export function readRadius(value: unknown): RadiusStep | null {
  // hasOwn, nicht `in`: `in` faende auch "constructor" oder "toString" im
  // Prototyp und liesse eine Funktion als Rundung durch (Review #391).
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RADIUS_STEPS, value) ? (value as RadiusStep) : null
}

/** Was in `data.surfaces` steht — oder null, wenn kein bekannter Wert. */
export function readSurfaces(value: unknown): Surfaces | null {
  return typeof value === "string" && (SURFACES as readonly string[]).includes(value) ? (value as Surfaces) : null
}

/**
 * Die Variablen, die Rundung und Flächen tragen. Neben den Farbtokens die
 * zweite Gruppe, die ein Space (oder die Instanz) am Wurzelelement setzt.
 *
 *   --radius          die eine Rundung, aus der alle anderen entstehen
 *   --surface-alpha        Deckkraft durchscheinender Flächen (1 = deckend)
 *   --surface-inner-alpha  Flächen IN einem Glasrahmen: 0, sonst stapeln sich zwei Schichten
 *   --surface-blur         Weichzeichnung dahinter (0 = keine)
 */
export const LAYOUT_TOKENS: readonly string[] = ["--radius", "--surface-alpha", "--surface-inner-alpha", "--surface-blur"]

export function layoutTokens(axes: { radius?: RadiusStep | null; surfaces?: Surfaces | null }): Record<string, string> {
  const out: Record<string, string> = {}
  if (axes.radius) out["--radius"] = RADIUS_STEPS[axes.radius]
  if (axes.surfaces) {
    const solid = axes.surfaces === "solid"
    out["--surface-alpha"] = solid ? "1" : "0.8"
    out["--surface-inner-alpha"] = solid ? "1" : "0"
    out["--surface-blur"] = solid ? "0px" : "12px"
  }
  return out
}

/**
 * Die Grauwahl eines Space: eine der sechs Neutralen, oder ausdruecklich
 * `"auto"` (Radix' Paarung). `null` heisst dagegen "nichts gesetzt" und
 * erbt von der Instanz — erbte die ein Grau, liesse sich "auto" sonst nie
 * waehlen (Review #391).
 */
export type GrayChoice = GrayScaleName | "auto"

/** Was in `data.gray` steht — Neutrale oder "auto", sonst null (= erbt). */
export function readGray(value: unknown): GrayChoice | null {
  if (value === "auto") return "auto"
  return typeof value === "string" && (GRAY_SCALE_OPTIONS as readonly string[]).includes(value)
    ? (value as GrayScaleName)
    : null
}

/**
 * Das Akzent-Raster wie im Radix-Playground: jede benannte Skala mit ihrer
 * Füllfarbe (Stufe 9). Wer eine waehlt, bekommt genau diese Skala — die
 * Ableitung erkennt Stufe 9 als Vorlage wieder.
 */
export function accentSwatches(scheme: ColorScheme): { name: string; hex: string }[] {
  // Nach Farbton geordnet, beginnend bei Rot — wie im Playground. Alphabetisch
  // (amber, blue, bronze …) findet niemand eine Farbe.
  return ACCENT_SCALE_NAMES.map((name) => {
    const hex = namedScale(name, scheme)[8]
    const h = parseColor(hex)?.h ?? 0
    return { name, hex, hue: (h - 20 + 360) % 360 }
  })
    .sort((a, b) => a.hue - b.hue)
    .map(({ name, hex }) => ({ name, hex }))
}

/** Welche Radix-Skala eine Farbe IST (Stufe 9 trifft exakt) — oder null: eigene Farbe. */
export function matchAccentScale(hex: string, scheme: ColorScheme): string | null {
  const wanted = hex.toLowerCase()
  return accentSwatches(scheme).find((s) => s.hex.toLowerCase() === wanted)?.name ?? null
}

/** Die Neutralen fuer das Grau-Raster, mit ihrer Stufe 9 als Farbprobe. */
export function graySwatches(scheme: ColorScheme): { name: GrayScaleName; hex: string }[] {
  return GRAY_SCALE_OPTIONS.map((name) => ({ name, hex: namedScale(name, scheme)[8] }))
}
