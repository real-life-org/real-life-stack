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

export function themeTokens({ accent, gray }: ThemeTokenInput): ThemeTokens {
  const fill = step(accent, 9)
  // Die Schrift auf der Füllfläche ist WEISS — reines Weiß, nicht das helle
  // Ende der Grauskala (im dunklen Schema wäre das ein sichtbares Grau).
  // Schwarz nur auf einer sehr hellen Füllung wie Gelb, nach derselben Regel
  // wie überall sonst. Nicht nach Kontrast gewählt: auf Orange gewänne Schwarz
  // die Zahl (7:1 gegen 3:1) und verlöre den Look — Antons Entscheidung,
  // begründet bei `getReadableTextColor`. Die Kontrastzeilen zeigen die Zahl.
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
  }
}

/**
 * Welcher Text auf welcher Flaeche steht — und wie viel Kontrast er braucht.
 *
 * WCAG 2 unterscheidet: Fliesstext 4.5:1, Bedienelemente und grosse Schrift
 * 3:1. Die Fuellflaeche (Stufe 9) traegt Knoepfe und Abzeichen, dort ist 3:1
 * die richtige Latte — eine pauschale 4.5 waere kein Mehr an Strenge,
 * sondern ein falscher Massstab: sie verboete jede kraeftige Akzentfarbe.
 *
 * Die Liste steht hier und nicht im Test, weil zwei Seiten sie brauchen: die
 * Zusicherung, dass eine frei gewaehlte Farbe nichts unlesbar macht, und die
 * Anzeige im Space, die beim Setzen einzelner Stufen zeigt, was gerade kippt.
 * `accent` markiert die Paare, an denen die Akzentskala haengt.
 */
export interface TokenPair {
  label: string
  foreground: string
  background: string
  minimum: number
  /** Haengt dieses Paar an der Akzentskala? */
  accent: boolean
  /**
   * Haelt die Ableitung die Latte fuer JEDE Farbe? Fuer Text und Fokusring
   * ja — dafuer steht sie ein. Fuer die Knopfschrift nein: dort ist Weiss
   * gesetzt (siehe `getReadableTextColor`), und auf dem orangen Akzent liegt
   * das bei 2.9:1. Gemessen und gezeigt wird es trotzdem.
   */
  guaranteed: boolean
}

export const TOKEN_PAIRS: readonly TokenPair[] = [
  { label: "Text", foreground: "--foreground", background: "--background", minimum: 4.5, accent: false, guaranteed: true },
  { label: "Text auf Karten", foreground: "--card-foreground", background: "--card", minimum: 4.5, accent: false, guaranteed: true },
  { label: "Text in Aufklappern", foreground: "--popover-foreground", background: "--popover", minimum: 4.5, accent: false, guaranteed: true },
  { label: "Schwacher Text", foreground: "--muted-foreground", background: "--background", minimum: 4.5, accent: false, guaranteed: true },
  { label: "Schwacher Text auf Flaeche", foreground: "--muted-foreground", background: "--muted", minimum: 4.5, accent: false, guaranteed: true },
  { label: "Text auf Nebenflaeche", foreground: "--secondary-foreground", background: "--secondary", minimum: 4.5, accent: false, guaranteed: true },
  { label: "Knopfbeschriftung", foreground: "--primary-foreground", background: "--primary", minimum: 3, accent: true, guaranteed: false },
  { label: "Text auf Akzentflaeche", foreground: "--accent-foreground", background: "--accent", minimum: 4.5, accent: true, guaranteed: true },
  { label: "Text im Seitenmenue", foreground: "--sidebar-foreground", background: "--sidebar", minimum: 4.5, accent: false, guaranteed: true },
  { label: "Knopf im Seitenmenue", foreground: "--sidebar-primary-foreground", background: "--sidebar-primary", minimum: 3, accent: true, guaranteed: false },
  { label: "Auswahl im Seitenmenue", foreground: "--sidebar-accent-foreground", background: "--sidebar-accent", minimum: 4.5, accent: true, guaranteed: true },
  // WCAG 2.2: Fokusindikatoren brauchen 3:1 gegen ihre Umgebung.
  { label: "Fokusring", foreground: "--ring", background: "--background", minimum: 3, accent: true, guaranteed: true },
]

export interface ContrastCheck extends TokenPair {
  ratio: number
  ok: boolean
}

/**
 * Was die Paare in einem konkreten Tokensatz erreichen.
 *
 * Fuer die Anzeige im Space gedacht: wer eine Stufe von Hand setzt, sieht
 * sofort, ob dabei etwas unlesbar wird — statt es erst im Betrieb zu merken.
 */
export function contrastChecks(
  tokens: ThemeTokens,
  options: { accentOnly?: boolean } = {},
): ContrastCheck[] {
  return TOKEN_PAIRS.filter((pair) => !options.accentOnly || pair.accent).map((pair) => {
    const ratio = contrast(tokens[pair.foreground], tokens[pair.background])
    return { ...pair, ratio, ok: ratio >= pair.minimum }
  })
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
