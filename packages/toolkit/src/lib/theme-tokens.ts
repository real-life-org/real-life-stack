/**
 * Von Farbskalen zu den Tokens, aus denen die Flächen schöpfen.
 *
 * Das Toolkit malt nirgends mit einer Farbe, sondern immer mit einer Rolle:
 * `bg-muted`, `text-muted-foreground`, `border-border`. Diese Rollen liegen
 * als CSS-Variablen auf dem Wurzelelement. Hier entstehen sie — aus einer
 * Akzent- und einer Grauskala plus dem Schema.
 *
 * Die Zuordnung folgt den Rollen, die Radix seinen zwölf Stufen gibt:
 *
 *   1  App-Hintergrund          →  --background
 *   2  Flächen darauf           →  --card, --popover, --sidebar
 *   3  Komponente in Ruhe       →  --muted, --secondary, --accent
 *   6  Rahmen                   →  --border
 *   7  Rahmen, interaktiv       →  --input
 *   9  solide Füllung           →  --primary, --ring
 *   11 Text, schwach            →  --muted-foreground
 *   12 Text, stark              →  --foreground
 *
 * Neutrale Rollen kommen aus der Grauskala, tragende aus der Akzentskala.
 * Weil beide Skalen für hell und dunkel vorliegen, gilt dieselbe Zuordnung
 * in beiden Schemata — das Schema wählt der Mensch, die Gestalt der Space.
 */

import { type ColorScale, type ColorScheme } from "./color-scales"
import { contrastRatio, parseColor } from "./oklch"
import { getReadableTextColor } from "./utils"

export interface ThemeTokenInput {
  accent: ColorScale
  gray: ColorScale
  scheme: ColorScheme
}

export type ThemeTokens = Record<string, string>

/**
 * Fehler-, Warn- und Diagrammfarben gehören NICHT dem Space.
 *
 * Rot muss rot bleiben, auch wenn jemand seinen Space rot färbt: sonst
 * verlöre die Fehlerfarbe ihre Bedeutung genau dann, wenn es darauf
 * ankommt. Dasselbe gilt für die Diagrammreihen, die sich voneinander
 * unterscheiden müssen und nicht vom Akzent.
 */
const FIXED_TOKENS: ThemeTokens = {
  "--destructive": "#dc2626",
  "--warning": "#d97706",
  "--warning-foreground": "#ffffff",
  "--pink": "#db2777",
  "--pink-foreground": "#ffffff",
  "--chart-1": "#2563eb",
  "--chart-2": "#16a34a",
  "--chart-3": "#d97706",
  "--chart-4": "#9333ea",
  "--chart-5": "#e11d48",
}

/** Jedes Token, das diese Schicht setzt — die Liste, gegen die sie geprüft wird. */
export const SEMANTIC_TOKENS: readonly string[] = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  ...Object.keys(FIXED_TOKENS),
]

/** Stufe n einer Skala, 1-basiert wie bei Radix. */
const step = (scale: ColorScale, n: number) => scale[n - 1]

function contrast(a: string, b: string): number {
  const x = parseColor(a)
  const y = parseColor(b)
  return x && y ? contrastRatio(x, y) : 1
}

/**
 * Die erste Stufe, die gegen den Untergrund sichtbar genug ist.
 *
 * Der Fokusring liegt auf dem App-Hintergrund, nicht innerhalb der eigenen
 * Farbfamilie. Radix' Stufe 8 ist als Rahmen FÜR Flächen derselben Skala
 * gedacht und erreichte bei einer neutralen Akzentfarbe nur 1.25:1 — der
 * Ring war unsichtbar. Aber auch Stufe 9 genügt nicht immer: ein helles
 * kräftiges Orange kommt auf fast weißem Grund nur auf 2.93:1.
 *
 * Darum wird abgestiegen, bis es reicht. WCAG 2.2 verlangt für
 * Fokusindikatoren 3:1; die dunkelste Textstufe erreicht das immer.
 */
function visibleAgainst(scale: ColorScale, background: string, minimum: number): string {
  for (const n of [9, 10, 11, 12]) {
    const candidate = step(scale, n)
    if (contrast(candidate, background) >= minimum) return candidate
  }
  return step(scale, 12)
}

export function themeTokens({ accent, gray, scheme }: ThemeTokenInput): ThemeTokens {
  const fill = step(accent, 9)
  // Die Schrift auf der Füllfläche richtet sich nach deren Helligkeit, nicht
  // nach dem Schema: eine helle Akzentfarbe (Gelb) braucht dunklen Text auch
  // im dunklen Schema.
  const onFill = getReadableTextColor(fill)

  // Stufe 3 der Akzentskala ist eine sehr blasse Tönung. Der Text darauf
  // bleibt in derselben Familie — aber aus Stufe 12, nicht 11: auf dieser
  // Fläche steht Menütext, und der braucht Fließtext-Kontrast. Stufe 11
  // erreichte bei hellen Akzenten nur 4.26:1.
  const tint = step(accent, 3)
  const onTint = step(accent, 12)

  const background = step(gray, 1)
  const ring = visibleAgainst(accent, background, 3)

  return {
    "--background": step(gray, 1),
    "--foreground": step(gray, 12),

    "--card": step(gray, 2),
    "--card-foreground": step(gray, 12),
    "--popover": step(gray, 2),
    "--popover-foreground": step(gray, 12),

    "--primary": fill,
    "--primary-foreground": onFill,

    "--secondary": step(gray, 3),
    "--secondary-foreground": step(gray, 12),
    "--muted": step(gray, 3),
    "--muted-foreground": step(gray, 11),

    "--accent": tint,
    "--accent-foreground": onTint,

    "--border": step(gray, 6),
    "--input": step(gray, 7),
    "--ring": ring,

    "--sidebar": step(gray, 2),
    "--sidebar-foreground": step(gray, 12),
    "--sidebar-primary": fill,
    "--sidebar-primary-foreground": onFill,
    "--sidebar-accent": tint,
    "--sidebar-accent-foreground": onTint,
    "--sidebar-border": step(gray, 6),
    "--sidebar-ring": ring,

    ...FIXED_TOKENS,
    // `scheme` steckt bereits in den übergebenen Skalen; der Parameter hält
    // die Signatur vollständig, damit der Aufrufer nicht raten muss.
    ...(scheme ? {} : {}),
  }
}

/** Schreibt die Tokens auf ein Element — üblicherweise das Wurzelelement. */
export function applyThemeTokens(element: HTMLElement, tokens: ThemeTokens): void {
  for (const [name, value] of Object.entries(tokens)) {
    element.style.setProperty(name, value)
  }
}

/** Nimmt zurück, was {@link applyThemeTokens} gesetzt hat. */
export function clearThemeTokens(element: HTMLElement): void {
  for (const name of SEMANTIC_TOKENS) element.style.removeProperty(name)
}
