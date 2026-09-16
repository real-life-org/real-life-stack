/**
 * Zwölfstufige Farbskalen aus einer frei gewählten Farbe.
 *
 * Eine Skala ist kein Farbverlauf, sondern ein Satz Rollen: Stufe 1–2 tragen
 * Flächen, 3–5 Komponenten in Ruhe/Hover/aktiv, 6–8 Rahmen und Fokus, 9–10
 * die solide Füllung, 11–12 Text. Radix hat diese Abstufungen über Jahre
 * abgestimmt; frei zu interpolieren führte zu Skalen, die rechnerisch
 * stimmen und trotzdem schlecht aussehen.
 *
 * Darum wird hier nicht interpoliert, sondern eine erprobte Skala als
 * VORLAGE genommen und zur Wunschfarbe verschoben:
 *
 *  1. Die Vorlage ist die Skala, deren Stufe 9 der Wunschfarbe am nächsten
 *     liegt — gemessen über alle drei Achsen, nicht nur den Farbton. Nur so
 *     landet ein blasses Braun bei `bronze` und nicht bei `orange`, das
 *     denselben Farbton trägt, aber die vierfache Buntheit hat.
 *  2. Stufe 9 trifft die Wunschfarbe exakt.
 *  3. Die Enden bleiben, wo sie sind: Stufe 1 ist beinahe die Hintergrund-
 *     farbe des Schemas, Stufe 12 die Textfarbe. Verschöbe man sie mit,
 *     liefen helle Farben oben aus dem Bereich und die Skala verlöre ihren
 *     Zweck.
 *  4. Dazwischen wird die Verschiebung linear ausgeblendet.
 *
 * Gemessen an allen 25 Akzentskalen, und zwar strenger als im Betrieb: jede
 * Skala wird aus ihrer eigenen Stufe 9 rekonstruiert, ohne sich selbst als
 * Vorlage nehmen zu dürfen (siehe `color-scales.test.ts`).
 *
 *   hell    Mittel 0.0103, schlechtester Fall 0.0567 (orange8)
 *   dunkel  Mittel 0.0111, schlechtester Fall 0.0588 (amber8)
 *   Abstand zweier benachbarter Stufen: 0.0699 (hell) / 0.0747 (dunkel)
 *
 * Der mittlere Fehler ist also rund ein Siebtel eines Stufenabstands, und
 * auch der schlechteste Fall bleibt darunter: jede abgeleitete Stufe liegt
 * näher an ihrem Ziel als an der Nachbarstufe und trägt damit ihre Rolle
 * noch richtig. Im Betrieb ist der Fehler kleiner, weil dort die wirklich
 * nächste Vorlage zur Verfügung steht.
 */

import * as radix from "@radix-ui/colors"

import { oklchToHex, parseColor, type Oklch } from "./oklch"

/** Die zwölf Stufen einer Skala, Stufe 1 zuerst. */
export type ColorScale = readonly [
  string, string, string, string, string, string,
  string, string, string, string, string, string,
]

export type ColorScheme = "light" | "dark"

/**
 * Die neutralen Skalen. Sie stehen NEBEN den Akzentfarben und kommen als
 * Vorlage nicht in Frage: ihre Stufe 9 ist beinahe unbunt, jede bunte
 * Wunschfarbe würde beim Verschieben grotesk übersättigt.
 */
const GRAY_SCALE_NAMES = ["gray", "mauve", "slate", "sage", "olive", "sand"] as const

export type GrayScaleName = (typeof GRAY_SCALE_NAMES)[number]

/** Alle Akzentskalen, die Radix mitbringt — die möglichen Vorlagen. */
export const ACCENT_SCALE_NAMES: readonly string[] = Object.keys(radix)
  .filter((key) => /^[a-z]+$/.test(key))
  .filter((key) => !(GRAY_SCALE_NAMES as readonly string[]).includes(key))
  .filter((key) => `${key}1` in (radix as Record<string, Record<string, string>>)[key])
  .sort()

export const GRAY_SCALE_OPTIONS: readonly GrayScaleName[] = GRAY_SCALE_NAMES

/**
 * Eine benannte Radix-Skala als Hex-Werte.
 *
 * Die Dark-Variante nutzt DIESELBEN Schlüsselnamen wie die helle
 * (`jadeDark` enthält `jade1`…`jade12`) — sie ist als Überschreibung
 * derselben CSS-Variablen gedacht.
 */
export function namedScale(name: string, scheme: ColorScheme): ColorScale {
  const table = (radix as Record<string, Record<string, string>>)[
    scheme === "dark" ? `${name}Dark` : name
  ]
  if (!table) throw new Error(`Unbekannte Farbskala: ${name}`)
  return Array.from({ length: 12 }, (_, i) => table[`${name}${i + 1}`]) as unknown as ColorScale
}

/** Kürzester Abstand zweier Farbtöne auf dem Kreis, in Grad. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Abstand zweier Farben. Der Farbton zählt nach Buntheit gewichtet: bei
 * zwei nahezu unbunten Farben ist er bedeutungslos, bei zwei kräftigen
 * entscheidet er.
 */
export function colorDistance(a: Oklch, b: Oklch): number {
  const hueWeight = (hueDistance(a.h, b.h) / 180) * Math.min(a.c, b.c) * 2
  return Math.hypot(a.l - b.l, a.c - b.c, hueWeight)
}

function toOklch(hex: string): Oklch {
  const parsed = parseColor(hex)
  if (!parsed) throw new Error(`Unlesbare Farbe: ${hex}`)
  return parsed
}

/**
 * Die Vorlage für eine Wunschfarbe: die Skala mit der ähnlichsten Stufe 9.
 *
 * `exclude` dient dem Prüfstein — er misst, wie gut die Ableitung eine
 * Skala trifft, die sie NICHT als Vorlage haben darf.
 */
export function pickTemplate(target: Oklch, exclude?: string): string {
  let best = ACCENT_SCALE_NAMES[0]
  let bestDistance = Infinity
  for (const name of ACCENT_SCALE_NAMES) {
    if (name === exclude) continue
    const distance = colorDistance(target, toOklch(namedScale(name, "light")[8]))
    if (distance < bestDistance) {
      bestDistance = distance
      best = name
    }
  }
  return best
}

/**
 * Wie stark eine Stufe der Verschiebung folgt. Stufe 9 ganz, die beiden
 * Enden gar nicht, dazwischen linear.
 *
 * Nach unten sind es acht Stufen bis zum Ende, nach oben nur drei — die
 * Textstufen 11 und 12 liegen dichter an der Füllung und müssen schneller
 * zur Ruhe kommen, sonst färbt eine kräftige Wunschfarbe den Fließtext ein.
 */
function weightFor(index: number): number {
  const anchor = 8
  const span = index < anchor ? anchor : 11 - anchor
  return 1 - Math.min(1, Math.abs(index - anchor) / span)
}

export interface DeriveOptions {
  /** Nur für den Prüfstein: diese Skala nicht als Vorlage zulassen. */
  excludeTemplate?: string
}

/**
 * Leitet aus einer Farbe eine zwölfstufige Skala ab. Die Farbe landet auf
 * Stufe 9, der soliden Füllung — dort, wo eine Akzentfarbe wirkt.
 */
export function deriveColorScale(
  color: string,
  scheme: ColorScheme,
  options: DeriveOptions = {},
): ColorScale {
  const target = toOklch(color)
  const templateName = pickTemplate(target, options.excludeTemplate)
  const template = namedScale(templateName, scheme).map(toOklch)
  const anchor = template[8]

  const deltaL = target.l - anchor.l
  const deltaH = target.h - anchor.h
  // Buntheit wird verhältnismäßig verschoben; eine Vorlage mit nahezu
  // unbunter Stufe 9 hat kein brauchbares Verhältnis und bleibt, wie sie ist.
  const ratioC = anchor.c > 0.001 ? target.c / anchor.c : 1

  return template.map((step, index) => {
    const weight = weightFor(index)
    return oklchToHex({
      l: Math.max(0, Math.min(1, step.l + deltaL * weight)),
      c: Math.max(0, step.c * (1 + (ratioC - 1) * weight)),
      // Der Farbton dreht UNGEDAEMPFT mit: eine Skala ist eine Farbfamilie,
      // und ihre Textstufen gehoeren derselben an wie ihre Flaechen. Gedaempft
      // behielten Stufe 11 und 12 den Ton der Vorlage — der Fliesstext eines
      // rosa Space schimmerte dann rot.
      h: (step.h + deltaH + 360) % 360,
    })
  }) as unknown as ColorScale
}
