/**
 * Farbmathematik fuer die Design-Tokens: OKLCH als Arbeitsraum, sRGB nur zum
 * Messen und Anzeigen.
 *
 * Die Tokens des Toolkits stehen in `oklch()` (globals.css). Wer sie regelt,
 * regelt Helligkeit (L), Buntheit (C) und Farbton (H) getrennt — genau die
 * drei Achsen, die ein Mensch meint, wenn er "heller", "kraeftiger" oder
 * "waermer" sagt. In RGB oder HSL haengen diese Achsen aneinander: ein
 * helleres Blau in HSL wird zugleich blasser, und zwei Farben mit gleichem
 * HSL-L sind verschieden hell.
 *
 * Bewusst ohne Bibliothek: gebraucht werden zwei Matrizen und ein Parser.
 * Eine Abhaengigkeit fuer 100 Zeilen Mathematik waere mehr Gewicht als Nutzen.
 *
 * Quelle der Matrizen: Bjoern Ottosson, "A perceptual color space for image
 * processing" (2020) — dieselben Zahlen, die auch Browser verwenden.
 *
 * Herkunft: herausgeloest aus rls#361 (Design-Regler). Naechster Verwender ist
 * die Ableitung zwoelfstufiger Farbskalen aus einer frei gewaehlten Farbe —
 * dort braucht es alle drei Teile dieser Datei: die Umrechnung, um eine
 * Vorlagenskala zur Zielfarbe zu verschieben, `inGamut`, um Stufen zu
 * erkennen, die sich nicht darstellen lassen, und die Kontrastmessung, um zu
 * pruefen, dass Text auf den erzeugten Flaechen lesbar bleibt.
 */

export interface Oklch {
  /** Helligkeit 0..1 */
  l: number
  /** Buntheit, praktisch 0..0.4 */
  c: number
  /** Farbton in Grad 0..360 */
  h: number
  /** Deckkraft 0..1; fehlt sie, ist sie 1 */
  alpha?: number
}

/** Auf feste Nachkommastellen, ohne "-0" und ohne Gleitkomma-Schleppe. */
function fix(n: number, digits: number): string {
  const s = n.toFixed(digits)
  return s === "-0" || /^-0\.0+$/.test(s) ? s.slice(1) : s
}

/** In der Schreibweise der Token-Datei: `oklch(0.63 0.16 55)`. */
export function formatOklch({ l, c, h, alpha }: Oklch): string {
  const base = `${fix(l, 3)} ${fix(c, 3)} ${fix(h, 1)}`
  return alpha !== undefined && alpha < 1 ? `oklch(${base} / ${fix(alpha, 2)})` : `oklch(${base})`
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const cbrt = (n: number) => Math.cbrt(n)

/** Linear-sRGB -> OKLab. */
function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab -> Linear-sRGB. Kann ausserhalb 0..1 liegen (ausserhalb des Gamuts). */
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** sRGB (0..1 je Kanal) -> OKLCH. */
export function rgbToOklch(r: number, g: number, b: number, alpha?: number): Oklch {
  const [L, a, bb] = linearToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b))
  const c = Math.hypot(a, bb)
  // Unbunt hat keinen Farbton — 0 statt Rauschen aus der Rundung.
  let h = c < 1e-4 ? 0 : (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  return alpha === undefined ? { l: L, c, h } : { l: L, c, h, alpha }
}

/**
 * OKLCH -> sRGB (0..1 je Kanal), auf den Gamut beschnitten. `inGamut` sagt,
 * ob beschnitten werden musste — ein zu kraeftiges Orange bei hoher
 * Helligkeit existiert auf einem sRGB-Bildschirm nicht, und der Regler soll
 * das anzeigen statt stumm zu runden.
 */
export function oklchToRgb({ l, c, h }: Oklch): { r: number; g: number; b: number; inGamut: boolean } {
  const rad = (h * Math.PI) / 180
  const [lr, lg, lb] = oklabToLinear(l, c * Math.cos(rad), c * Math.sin(rad))
  // "Ausserhalb" heisst: das Beschneiden waere auf dem Bildschirm zu sehen,
  // also mindestens eine Stufe von 255. Gemessen in Gamma-sRGB, nicht linear —
  // linear liegt die Schwelle nahe Schwarz viel enger. Das Toolkit-Primaer
  // selbst steht um ein Haar neben dem Gamut; eine strengere Schwelle
  // markierte es als fehlerhaft, obwohl kein Auge den Unterschied saehe.
  const overshoot = (v: number) => (v < 0 ? linearToSrgb(-v) : v > 1 ? linearToSrgb(v) - 1 : 0)
  const inGamut = [lr, lg, lb].every((v) => overshoot(v) < 1 / 255)
  return {
    r: clamp01(linearToSrgb(clamp01(lr))),
    g: clamp01(linearToSrgb(clamp01(lg))),
    b: clamp01(linearToSrgb(clamp01(lb))),
    inGamut,
  }
}

/** `#rrggbb` — fuer Anzeige und Zwischenablage, nicht fuer die Token-Datei. */
export function oklchToHex(color: Oklch): string {
  const { r, g, b } = oklchToRgb(color)
  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0")
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * Gleich im Sinne der Token-Datei: gleiche Ausgabe bis auf die Stellen, die
 * `formatOklch` schreibt. Ohne Buntheit zaehlt der Farbton nicht — Weiss mit
 * H=10 ist dasselbe Weiss wie mit H=0, und ein Regler, der alle Farbtoene
 * dreht, darf daraus keine "Aenderung" machen.
 */
export function sameColor(a: Oklch, b: Oklch): boolean {
  const achromatic = a.c < 0.0005 && b.c < 0.0005
  const norm = (c: Oklch) => formatOklch(achromatic ? { ...c, h: 0 } : c)
  return norm(a) === norm(b)
}

/** Relative Leuchtdichte nach WCAG 2.x, aus OKLCH ueber Linear-sRGB. */
function luminance(color: Oklch): number {
  const rad = (color.h * Math.PI) / 180
  const [r, g, b] = oklabToLinear(color.l, color.c * Math.cos(rad), color.c * Math.sin(rad)).map(clamp01)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Kontrastverhaeltnis nach WCAG 2.x (1..21). Schwellen: 3 fuer grosse Schrift
 * und Bedienelemente, 4.5 fuer Fliesstext (AA), 7 fuer AAA.
 *
 * Deckkraft wird ignoriert: Ein halbtransparentes Token hat keinen eigenen
 * Kontrast, nur einen gegen das, worauf es liegt.
 */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Einstufung eines Kontrastverhaeltnisses — der Text, der neben der Zahl steht. */
export type ContrastLevel = "AAA" | "AA" | "AA-large" | "fail"

export function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return "AAA"
  if (ratio >= 4.5) return "AA"
  if (ratio >= 3) return "AA-large"
  return "fail"
}

// ---------------------------------------------------------------------------
// Parser
//
// Gelesen wird, was in einem Token stehen kann: oklch(), #hex, rgb(), hsl()
// und die Schluesselwoerter, die in globals.css vorkommen. Alles andere (ein
// `var()`, ein Gradient, `transparent`) ergibt `null` — das Panel zeigt den
// Wert dann roh und ohne Regler, statt ihn falsch zu deuten.
// ---------------------------------------------------------------------------

const NUM = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?"
const OKLCH_RE = new RegExp(
  `^oklch\\(\\s*(${NUM})(%?)\\s+(${NUM})(%?)\\s+(${NUM})(deg|rad|grad|turn)?\\s*(?:/\\s*(${NUM})(%?)\\s*)?\\)$`,
  "i",
)
const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FN_RE = /^(rgba?|hsla?)\(\s*(.+?)\s*\)$/i

function parseAlpha(v: string | undefined, pct: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = parseFloat(v)
  return clamp01(pct ? n / 100 : n)
}

function hueToDeg(v: number, unit: string | undefined): number {
  const deg =
    unit?.toLowerCase() === "rad" ? (v * 180) / Math.PI
    : unit?.toLowerCase() === "grad" ? v * 0.9
    : unit?.toLowerCase() === "turn" ? v * 360
    : v
  return ((deg % 360) + 360) % 360
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

/** Ein CSS-Farbwert als OKLCH, oder `null`, wenn er sich nicht lesen laesst. */
export function parseColor(input: string): Oklch | null {
  const v = input.trim()

  const ok = OKLCH_RE.exec(v)
  if (ok) {
    const l = parseFloat(ok[1]) / (ok[2] ? 100 : 1)
    // Prozent bei C meint "von 0.4" — so definiert es CSS Color 4.
    const c = parseFloat(ok[3]) * (ok[4] ? 0.004 : 1)
    const h = hueToDeg(parseFloat(ok[5]), ok[6])
    const alpha = parseAlpha(ok[7], ok[8])
    return alpha === undefined ? { l: clamp01(l), c: Math.max(0, c), h } : { l: clamp01(l), c: Math.max(0, c), h, alpha }
  }

  const hex = HEX_RE.exec(v)
  if (hex) {
    let s = hex[1]
    if (s.length <= 4) s = s.split("").map((ch) => ch + ch).join("")
    const n = (i: number) => parseInt(s.slice(i, i + 2), 16) / 255
    return rgbToOklch(n(0), n(2), n(4), s.length === 8 ? n(6) : undefined)
  }

  const fn = FN_RE.exec(v)
  if (fn) {
    // Beide Schreibweisen: `rgb(1 2 3 / 0.5)` und `rgb(1, 2, 3, 0.5)`.
    const parts = fn[2].split(/\s*[,/]\s*|\s+/).filter(Boolean)
    if (parts.length < 3) return null
    const num = (s: string, scale: number) => (s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s) / scale)
    const alpha = parts[3] !== undefined ? parseAlpha(parts[3], parts[3].endsWith("%") ? "%" : undefined) : undefined
    if (fn[1].toLowerCase().startsWith("rgb")) {
      const [r, g, b] = parts.slice(0, 3).map((p) => clamp01(num(p, 255)))
      if ([r, g, b].some(Number.isNaN)) return null
      return rgbToOklch(r, g, b, alpha)
    }
    const h = hueToDeg(parseFloat(parts[0]), /[a-z]+$/i.exec(parts[0])?.[0])
    const s = clamp01(parseFloat(parts[1]) / 100)
    const l = clamp01(parseFloat(parts[2]) / 100)
    if ([h, s, l].some(Number.isNaN)) return null
    const [r, g, b] = hslToRgb(h, s, l)
    return rgbToOklch(r, g, b, alpha)
  }

  const named: Record<string, [number, number, number]> = { white: [1, 1, 1], black: [0, 0, 0] }
  const rgb = named[v.toLowerCase()]
  return rgb ? rgbToOklch(...rgb) : null
}
