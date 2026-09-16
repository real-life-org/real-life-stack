/**
 * Die Achsen, an denen ein Space sein Aussehen einstellt — als reine
 * Funktionen, damit Dialog und Panel dieselben Regeln tragen.
 */
import { oklchToHex, parseColor } from "./oklch"

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
