// Wert-Widgets (S4a): der gemeinsame Datenvertrag von Lese- und Schreibform.
//
// Spec: docs/spec/modules/shared-components.md → „Item-Detail aus dem
// Register", Widget-Paare B6–B12; docs/spec/06-schema-composition.md →
// „Feld- und Kantenregister" (FieldEntry).
//
// React-frei: Was die Schreibform prüft und speichert, liest die Leseform
// mit denselben Funktionen. Ein Widget je Datentyp, nicht je Fachfeld.

// ---------------------------------------------------------------------------
// url (B9)

const SCHEME = /^([a-z][a-z0-9+.-]*):/i

/**
 * Eine Adresse, die ein Link werden darf: `http` oder `https`, sonst `null`.
 * Eine bloße Domain („gartenprojekt.org") bekommt `https://` — so tippt man
 * sie. Jedes andere Schema (`javascript:`, `data:`, `mailto:` …) wird
 * abgelehnt, nicht umgeschrieben.
 */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim()
  if (raw === "" || /\s/.test(raw)) return null
  const scheme = SCHEME.exec(raw)?.[1]?.toLowerCase()
  if (scheme && scheme !== "http" && scheme !== "https") return null
  const candidate = scheme ? raw : `https://${raw}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  // Ohne Schema nur echte Domains („hallo" ist kein Link).
  if (!scheme && !url.hostname.includes(".")) return null
  return url.href
}

/** Der Link der Leseform, oder `null`: dann steht der Wert als Text da. */
export function safeHref(value: unknown): string | null {
  return typeof value === "string" ? normalizeUrl(value) : null
}

/** Die Adresse zum Lesen: ohne Schema, ohne `www.`, ohne `/` am Ende. */
export function urlLabel(href: string): string {
  return href.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "")
}

/** Fehler der Schreibform, oder `null`. Leer ist kein Fehler. */
export function urlError(input: string): string | null {
  if (input.trim() === "") return null
  return normalizeUrl(input) ? null : "Nur Adressen mit http oder https, z. B. gartenprojekt.org"
}

// ---------------------------------------------------------------------------
// contact (B12)

export type ContactKind = "phone" | "email"

const EMAIL = /^[^\s@?&/:#<>"]+@[^\s@?&/:#<>"]+\.[^\s@?&/:#<>".]+$/
const PHONE = /^\+?[\d\s()./-]+$/

/** Telefon oder E-Mail, am Wert erkannt; `null`, wenn keins von beiden. */
export function contactKind(value: string): ContactKind | null {
  const v = value.trim()
  if (EMAIL.test(v)) return "email"
  if (PHONE.test(v) && (v.match(/\d/g)?.length ?? 0) >= 5) return "phone"
  return null
}

/** Der Sprung `tel:` oder `mailto:`, oder `null`. */
export function contactHref(value: unknown): string | null {
  if (typeof value !== "string") return null
  const kind = contactKind(value)
  if (kind === "email") return `mailto:${value.trim()}`
  if (kind === "phone") return `tel:${value.trim().replace(/[^\d+]/g, "")}`
  return null
}

export function contactError(input: string): string | null {
  if (input.trim() === "") return null
  return contactKind(input) ? null : "Eine Telefonnummer oder E-Mail-Adresse"
}

// ---------------------------------------------------------------------------
// number (B7)

/**
 * Eine Eingabe als Zahl: `undefined` ohne Wert, `NaN`, wenn sie keine Zahl
 * ist. Punkt und Komma gelten beide als Dezimaltrenner.
 */
export function parseNumberInput(value: unknown): number | undefined {
  if (typeof value === "number") return value
  if (typeof value !== "string" || value.trim() === "") return undefined
  const n = Number(value.trim().replace(",", "."))
  return Number.isFinite(n) ? n : Number.NaN
}

export function numberError(input: unknown, range: { min?: number; max?: number }): string | null {
  const n = parseNumberInput(input)
  if (n === undefined) return null
  if (Number.isNaN(n)) return "Eine Zahl"
  if (range.min !== undefined && n < range.min) return `Mindestens ${formatNumber(range.min)}`
  if (range.max !== undefined && n > range.max) return `Höchstens ${formatNumber(range.max)}`
  return null
}

/** Deutsch geschrieben, mit Einheit dahinter („1.500 €"). */
export function formatNumber(value: number, unit?: string): string {
  const text = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)
  return unit ? `${text} ${unit}` : text
}

// ---------------------------------------------------------------------------
// chips (B10)

/** Eine Stringliste ohne Leeres und ohne Doppelte, in ihrer Reihenfolge. */
export function chipValues(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of value) {
    if (typeof v !== "string") continue
    const t = v.trim()
    if (t === "" || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

// ---------------------------------------------------------------------------
// Ton eines Chips (status B6, select B8)

/**
 * Die Töne, die eine Option im Register tragen darf (`options[].tone`). Die
 * Spec lässt den Wertebereich offen; das Toolkit bietet eine feste Palette
 * mit Hell und Dunkel. Ein unbekannter Ton ist neutral.
 */
const TONES: Readonly<Record<string, string>> = {
  neutral: "bg-muted text-muted-foreground",
  // Dieselben Klassen wie die Tag-Palette: Die Apps scannen im Toolkit nur
  // `.tsx`, diese Datei nicht; globals.css meldet sie per `@source inline` an.
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
}

export const CHIP_TONES: readonly string[] = Object.keys(TONES)

export function toneClass(tone: string | undefined): string {
  return (tone && TONES[tone]) || TONES.neutral!
}
