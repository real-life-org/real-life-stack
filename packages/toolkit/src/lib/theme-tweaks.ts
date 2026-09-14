/**
 * Live-Anpassung der Farbtokens — das Modell hinter dem ThemeTweaker.
 *
 * Spec 11: Eine Instanz gestaltet ueber Tokens, nicht ueber Code. Dieses
 * Modul ist die Werkbank dafuer: Es liest die Tokens, die das Toolkit
 * definiert, legt Aenderungen daran live auf das Dokument und gibt am Ende
 * genau die Datei aus, die eine Instanz nach `branding/theme.json` legt.
 *
 * Zwei Ebenen, damit Grob- und Feinarbeit nicht kollidieren:
 *
 *   1. Einzelwerte — ein Token bekommt einen festen OKLCH-Wert.
 *   2. Globale Regler — Helligkeit, Kontrast, Saettigung, Farbton wirken
 *      danach auf ALLE Tokens des Schemas, auch die unveraenderten.
 *
 * Exportiert wird das Ergebnis beider Ebenen; die App liest spaeter nur
 * Werte, keine Regler.
 *
 * Angewendet wird ueber ein eigenes <style>, nicht ueber Inline-Styles — aus
 * demselben Grund wie in runtime-config.ts: Inline schluege beide Schemata
 * auf einmal. Die Selektoren sind dieselben wie beim Branding; das Element
 * steht dahinter im <head> und gewinnt darum bei gleicher Spezifitaet.
 */

import { contrastRatio, formatOklch, parseColor, sameColor, type Oklch } from "./oklch"

export type Scheme = "light" | "dark"

export interface TokenSpec {
  /** Name ohne `--`, wie in globals.css. */
  name: string
  /** Was das Token im Bild bedeutet. */
  label: string
}

export interface TokenGroup {
  id: string
  label: string
  tokens: TokenSpec[]
}

/**
 * Die Farbtokens des Toolkits, gruppiert wie im Bild: Flaechen, Marke,
 * Zustand, Seitenleiste, Diagramme. Die Liste ist bewusst gepflegt statt
 * aus dem CSS abgeleitet — der Regler braucht ein Label, und ein Schatten-
 * oder Radius-Token gehoert nicht hierher.
 *
 * `knownTokens()` in runtime-config.ts prueft beim Anwenden ohnehin gegen
 * das geladene CSS; ein hier genanntes Token, das dort fehlt, wird beim
 * Branding verworfen und gemeldet.
 */
export const TOKEN_GROUPS: readonly TokenGroup[] = [
  {
    id: "surfaces",
    label: "Flächen",
    tokens: [
      { name: "background", label: "Seite" },
      { name: "foreground", label: "Text" },
      { name: "card", label: "Karte" },
      { name: "card-foreground", label: "Karte · Text" },
      { name: "popover", label: "Popover" },
      { name: "popover-foreground", label: "Popover · Text" },
      { name: "muted", label: "Gedämpft" },
      { name: "muted-foreground", label: "Gedämpft · Text" },
      { name: "border", label: "Rahmen" },
      { name: "input", label: "Eingabefeld" },
    ],
  },
  {
    id: "brand",
    label: "Marke",
    tokens: [
      { name: "primary", label: "Primär" },
      { name: "primary-foreground", label: "Primär · Text" },
      { name: "secondary", label: "Sekundär" },
      { name: "secondary-foreground", label: "Sekundär · Text" },
      { name: "accent", label: "Akzent" },
      { name: "accent-foreground", label: "Akzent · Text" },
      { name: "ring", label: "Fokusring" },
    ],
  },
  {
    id: "state",
    label: "Zustände",
    tokens: [
      { name: "destructive", label: "Destruktiv" },
      { name: "warning", label: "Warnung" },
      { name: "warning-foreground", label: "Warnung · Text" },
      { name: "pink", label: "Rosa" },
      { name: "pink-foreground", label: "Rosa · Text" },
    ],
  },
  {
    id: "sidebar",
    label: "Seitenleiste",
    tokens: [
      { name: "sidebar", label: "Fläche" },
      { name: "sidebar-foreground", label: "Text" },
      { name: "sidebar-primary", label: "Primär" },
      { name: "sidebar-primary-foreground", label: "Primär · Text" },
      { name: "sidebar-accent", label: "Akzent" },
      { name: "sidebar-accent-foreground", label: "Akzent · Text" },
      { name: "sidebar-border", label: "Rahmen" },
      { name: "sidebar-ring", label: "Fokusring" },
    ],
  },
  {
    id: "charts",
    label: "Diagramme",
    tokens: [
      { name: "chart-1", label: "Reihe 1" },
      { name: "chart-2", label: "Reihe 2" },
      { name: "chart-3", label: "Reihe 3" },
      { name: "chart-4", label: "Reihe 4" },
      { name: "chart-5", label: "Reihe 5" },
    ],
  },
]

export const ALL_TOKEN_NAMES: readonly string[] = TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name))

/**
 * Paare, deren Kontrast zaehlt: Text auf seiner Flaeche. `min` ist die
 * Schwelle, ab der das Paar als tauglich gilt — 4.5 fuer Fliesstext, 3 fuer
 * Rahmen und grosse Bedienelemente (WCAG 1.4.3 / 1.4.11).
 */
export interface ContrastPair {
  fg: string
  bg: string
  label: string
  min: number
}

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: "foreground", bg: "background", label: "Text auf Seite", min: 4.5 },
  { fg: "muted-foreground", bg: "background", label: "Gedämpfter Text auf Seite", min: 4.5 },
  { fg: "card-foreground", bg: "card", label: "Text auf Karte", min: 4.5 },
  { fg: "muted-foreground", bg: "muted", label: "Text auf gedämpfter Fläche", min: 4.5 },
  { fg: "popover-foreground", bg: "popover", label: "Text im Popover", min: 4.5 },
  { fg: "primary-foreground", bg: "primary", label: "Text auf Primär", min: 4.5 },
  { fg: "secondary-foreground", bg: "secondary", label: "Text auf Sekundär", min: 4.5 },
  { fg: "accent-foreground", bg: "accent", label: "Text auf Akzent", min: 4.5 },
  { fg: "warning-foreground", bg: "warning", label: "Text auf Warnung", min: 4.5 },
  { fg: "pink-foreground", bg: "pink", label: "Text auf Rosa", min: 4.5 },
  { fg: "destructive", bg: "background", label: "Destruktiv auf Seite", min: 4.5 },
  { fg: "primary", bg: "background", label: "Primär auf Seite", min: 3 },
  { fg: "border", bg: "background", label: "Rahmen auf Seite", min: 3 },
  { fg: "sidebar-foreground", bg: "sidebar", label: "Text in Seitenleiste", min: 4.5 },
]

/** Globale Regler eines Schemas. `IDENTITY` heisst: nichts veraendert. */
export interface GlobalAdjust {
  /** Wird auf L addiert: -0.3..0.3 */
  lightness: number
  /** Streckt L um 0.5: 0.5..1.5 */
  contrast: number
  /** Faktor auf C: 0..2 */
  chroma: number
  /** Wird auf H addiert, in Grad: -180..180 */
  hue: number
}

export const IDENTITY: GlobalAdjust = Object.freeze({ lightness: 0, contrast: 1, chroma: 1, hue: 0 })

export interface SchemeTweaks {
  /** Feste Einzelwerte, Token-Name -> OKLCH. */
  tokens: Record<string, Oklch>
  global: GlobalAdjust
}

export interface ThemeTweaks {
  light: SchemeTweaks
  dark: SchemeTweaks
}

export const EMPTY_TWEAKS: ThemeTweaks = Object.freeze({
  light: { tokens: {}, global: IDENTITY },
  dark: { tokens: {}, global: IDENTITY },
})

export function isIdentity(g: GlobalAdjust): boolean {
  return g.lightness === 0 && g.contrast === 1 && g.chroma === 1 && g.hue === 0
}

export function hasTweaks(t: ThemeTweaks): boolean {
  return (["light", "dark"] as const).some(
    (s) => Object.keys(t[s].tokens).length > 0 || !isIdentity(t[s].global),
  )
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Die globalen Regler auf einen Wert angewandt. Reine Funktion, testbar. */
export function adjust(color: Oklch, g: GlobalAdjust): Oklch {
  if (isIdentity(g)) return color
  const l = clamp(0.5 + (color.l - 0.5) * g.contrast + g.lightness, 0, 1)
  const c = Math.max(0, color.c * g.chroma)
  const h = (((color.h + g.hue) % 360) + 360) % 360
  return color.alpha === undefined ? { l, c, h } : { l, c, h, alpha: color.alpha }
}

// ---------------------------------------------------------------------------
// Lesen: die Werte, die OHNE unsere Anpassung gelten.
// ---------------------------------------------------------------------------

export const STYLE_ID = "rls-theme-tweaks"

/**
 * Die Basiswerte aller Tokens fuer das gerade aktive Schema, gelesen aus dem
 * berechneten Stil — also inklusive Branding, aber OHNE unsere Anpassung:
 * Das eigene <style> wird fuer die Dauer der Messung ausgeschaltet, sonst
 * laese man die eigenen Aenderungen als Ausgangspunkt und jede Bewegung
 * baute auf der vorigen auf.
 *
 * Tokens, deren Wert sich nicht als Farbe lesen laesst, fehlen im Ergebnis;
 * der rohe Text steht in `raw`.
 */
export function readBaseTokens(doc: Document = document): {
  colors: Record<string, Oklch>
  raw: Record<string, string>
} {
  const style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null
  const wasDisabled = style?.disabled ?? false
  if (style) style.disabled = true
  try {
    const computed = doc.defaultView?.getComputedStyle(doc.documentElement)
    const colors: Record<string, Oklch> = {}
    const raw: Record<string, string> = {}
    for (const name of ALL_TOKEN_NAMES) {
      const value = computed?.getPropertyValue(`--${name}`).trim() ?? ""
      raw[name] = value
      const parsed = value ? parseColor(value) : null
      if (parsed) colors[name] = parsed
    }
    return { colors, raw }
  } finally {
    if (style) style.disabled = wasDisabled
  }
}

// ---------------------------------------------------------------------------
// Aufloesen und Anwenden
// ---------------------------------------------------------------------------

/**
 * Der Wert, den ein Token nach beiden Ebenen hat: Einzelwert oder Basis,
 * danach die globalen Regler.
 */
export function resolveToken(name: string, base: Record<string, Oklch>, tweaks: SchemeTweaks): Oklch | undefined {
  const start = tweaks.tokens[name] ?? base[name]
  return start ? adjust(start, tweaks.global) : undefined
}

/**
 * Alle Tokens eines Schemas nach den Anpassungen — nur die, die sich von der
 * Basis unterscheiden. Eine unveraenderte Zeile in theme.json waere ein
 * Versprechen ohne Inhalt und wuerde spaetere Toolkit-Werte einfrieren.
 */
export function resolveScheme(base: Record<string, Oklch>, tweaks: SchemeTweaks): Record<string, string> {
  const out: Record<string, string> = {}
  for (const name of ALL_TOKEN_NAMES) {
    const resolved = resolveToken(name, base, tweaks)
    if (!resolved) continue
    const before = base[name]
    if (before && sameColor(before, resolved)) continue
    out[name] = formatOklch(resolved)
  }
  return out
}

/**
 * Legt die aufgeloesten Werte auf das Dokument. `bases` traegt die Basiswerte
 * je Schema, soweit schon gelesen — ein Schema, das noch nie aktiv war, hat
 * keine, und seine globalen Regler koennen erst wirken, wenn es einmal
 * sichtbar war. Einzelwerte wirken auch ohne Basis.
 */
export function applyTweaks(
  tweaks: ThemeTweaks,
  bases: Partial<Record<Scheme, Record<string, Oklch>>>,
  doc: Document = document,
): void {
  const block = (selector: string, values: Record<string, string>) => {
    const entries = Object.entries(values)
    return entries.length > 0
      ? `${selector} { ${entries.map(([n, v]) => `--${n}: ${v};`).join(" ")} }`
      : ""
  }
  const css = [
    block(":root:not(.dark)", resolveScheme(bases.light ?? {}, tweaks.light)),
    block(":root.dark", resolveScheme(bases.dark ?? {}, tweaks.dark)),
  ]
    .filter(Boolean)
    .join("\n")

  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!css) {
    style?.remove()
    return
  }
  if (!style) {
    style = doc.head.appendChild(Object.assign(doc.createElement("style"), { id: STYLE_ID }))
  }
  style.disabled = false
  if (style.textContent !== css) style.textContent = css
}

/** Entfernt jede Anpassung vom Dokument. */
export function clearTweaks(doc: Document = document): void {
  doc.getElementById(STYLE_ID)?.remove()
}

// ---------------------------------------------------------------------------
// Export: die Datei fuer branding/theme.json
// ---------------------------------------------------------------------------

/**
 * Genau das Format, das `applyBranding` liest (Spec 11, `colors`): je Schema
 * ein Objekt Token -> Wert. Leere Schemata fallen weg.
 */
export function toThemeJson(
  tweaks: ThemeTweaks,
  bases: Partial<Record<Scheme, Record<string, Oklch>>>,
): { light?: Record<string, string>; dark?: Record<string, string> } {
  const out: { light?: Record<string, string>; dark?: Record<string, string> } = {}
  for (const scheme of ["light", "dark"] as const) {
    const values = resolveScheme(bases[scheme] ?? {}, tweaks[scheme])
    if (Object.keys(values).length > 0) out[scheme] = values
  }
  return out
}

// ---------------------------------------------------------------------------
// Kontrast
// ---------------------------------------------------------------------------

export interface ContrastReport extends ContrastPair {
  ratio: number
  ok: boolean
}

/** Alle Paare gegen die aufgeloesten Werte; Paare mit unlesbarem Token fehlen. */
export function contrastReport(base: Record<string, Oklch>, tweaks: SchemeTweaks): ContrastReport[] {
  const out: ContrastReport[] = []
  for (const pair of CONTRAST_PAIRS) {
    const fg = resolveToken(pair.fg, base, tweaks)
    const bg = resolveToken(pair.bg, base, tweaks)
    if (!fg || !bg) continue
    const ratio = contrastRatio(fg, bg)
    out.push({ ...pair, ratio, ok: ratio >= pair.min })
  }
  return out
}

// ---------------------------------------------------------------------------
// Ablage: ueber einen Neuladen hinweg, im Browser der Person, die gestaltet.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "rls-theme-tweaks"

function isOklch(v: unknown): v is Oklch {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.l === "number" && typeof o.c === "number" && typeof o.h === "number"
}

function readScheme(v: unknown): SchemeTweaks {
  const o = typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {}
  const tokens: Record<string, Oklch> = {}
  if (typeof o.tokens === "object" && o.tokens !== null) {
    for (const [name, value] of Object.entries(o.tokens as Record<string, unknown>)) {
      if (ALL_TOKEN_NAMES.includes(name) && isOklch(value)) tokens[name] = value
    }
  }
  const g = typeof o.global === "object" && o.global !== null ? (o.global as Record<string, unknown>) : {}
  const num = (k: keyof GlobalAdjust) => (typeof g[k] === "number" && Number.isFinite(g[k]) ? (g[k] as number) : IDENTITY[k])
  return {
    tokens,
    global: { lightness: num("lightness"), contrast: num("contrast"), chroma: num("chroma"), hue: num("hue") },
  }
}

/** Was im Speicher liegt — geprueft, damit ein alter oder fremder Stand nichts kaputt macht. */
export function loadStoredTweaks(storage: Storage | undefined = safeStorage()): ThemeTweaks | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const o = parsed as Record<string, unknown>
    return { light: readScheme(o.light), dark: readScheme(o.dark) }
  } catch {
    return null
  }
}

export function storeTweaks(tweaks: ThemeTweaks, storage: Storage | undefined = safeStorage()): void {
  try {
    if (hasTweaks(tweaks)) storage?.setItem(STORAGE_KEY, JSON.stringify(tweaks))
    else storage?.removeItem(STORAGE_KEY)
  } catch {
    // Nicht speicherbar (privates Fenster) — die Anpassung wirkt trotzdem, nur nicht ueber ein Neuladen hinaus.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined
  } catch {
    return undefined
  }
}

/**
 * Beim Start: gespeicherte Anpassungen wieder anlegen, damit ein Neuladen die
 * Arbeit nicht verwirft. Nur Einzelwerte koennen sofort wirken; globale
 * Regler brauchen die Basis des Schemas und greifen, sobald das Panel sie
 * gelesen hat. Aufruf NACH `applyBranding`, damit das Branding die Basis ist.
 */
export function applyStoredTweaks(doc: Document = document): ThemeTweaks | null {
  const stored = loadStoredTweaks()
  if (!stored || !hasTweaks(stored)) return null
  // Die Basis des aktiven Schemas ist lesbar; das andere folgt, wenn es aktiv wird.
  const scheme: Scheme = doc.documentElement.classList.contains("dark") ? "dark" : "light"
  applyTweaks(stored, { [scheme]: readBaseTokens(doc).colors }, doc)
  return stored
}
