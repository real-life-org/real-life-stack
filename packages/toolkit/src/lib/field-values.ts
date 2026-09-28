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
// Bildadressen (media B5, avatar B11)

// Ein Bild im Browser: data:image mit Base64 oder Prozent-Kodierung, keine
// Zeilenumbrüche, kein Leerraum davor.
const DATA_IMAGE = /^data:image\/[a-z0-9.+-]+(;[a-z0-9=.+-]+)*,[^\s]*$/i

/**
 * Die Adresse eines Bilds zum Anzeigen, oder `null`: http(s), `blob:` (ein
 * Bild, das diese Sitzung gerade gewählt hat), `data:image/…` (ein
 * verkleinertes Bild im Item) und ein Pfad der eigenen Auslieferung
 * (`/personas/anna.png`, aufgelöst über `resolveAssetUrl`). Nie
 * `javascript:`, kein anderes `data:` und kein `//fremder-host`.
 */
export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null
  const v = value.trim()
  if (v === "") return null
  if (DATA_IMAGE.test(v)) return v
  if (/^blob:https?:\/\//i.test(v)) return v
  if (/^\/(?![\/\\])/.test(v)) return v
  if (!/^https?:\/\//i.test(v)) return null
  try {
    const url = new URL(v)
    return url.protocol === "http:" || url.protocol === "https:" ? v : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// contact (B12)

export type ContactKind = "phone" | "email"

// Eine schlichte Einzeladresse: kein `%` (keine URI-Escapes, RFC 6068 §2),
// keine Steuerzeichen, keine Trenner, die ein mailto-URI anders läse.
// eslint-disable-next-line no-control-regex
const EMAIL = /^[^\s\x00-\x1f\x7f@?&/:#<>"%,;]+@[^\s\x00-\x1f\x7f@?&/:#<>"%,;]+\.[^\s\x00-\x1f\x7f@?&/:#<>"%,;.]+$/
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

/**
 * Deutsch geschrieben, mit Einheit dahinter („1.500 €"). Werttreu: Das
 * Register kennt keine Genauigkeit, also steht die Zahl so da, wie sie
 * gespeichert ist — aus ihrer kürzesten exakten Schreibweise (`String`),
 * nie gerundet (#544). 0,001 kg bleibt 0,001 kg; ein Wert ungleich 0 wird
 * nie „0". Sehr kleine und sehr große Zahlen stehen mit Exponent („1e-21").
 */
export function formatNumber(value: number, unit?: string): string {
  const text = formatExact(value)
  return unit ? `${text} ${unit}` : text
}

/**
 * Längste Ziffernfolge, die eine Zahl in Exponentschreibweise (`1e-7`)
 * ausgeschrieben erscheint; darüber bleibt der Exponent.
 */
const MAX_PLAIN = 21

function formatExact(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return "0" // auch -0
  const sign = value < 0 ? "-" : ""
  const raw = String(Math.abs(value)) // kürzeste Schreibweise, die exakt zurückliest
  const [mantissa, expPart] = raw.split("e")
  const exp = expPart ? Number(expPart) : 0
  const [intDigits, fracDigits = ""] = mantissa!.split(".")
  const digits = intDigits! + fracDigits
  const point = intDigits!.length + exp // Stelle des Kommas in `digits`
  let int: string
  let frac: string
  if (point <= 0) {
    int = "0"
    frac = "0".repeat(-point) + digits
  } else if (point >= digits.length) {
    int = digits + "0".repeat(point - digits.length)
    frac = ""
  } else {
    int = digits.slice(0, point)
    frac = digits.slice(point)
  }
  int = int.replace(/^0+(?=\d)/, "")
  frac = frac.replace(/0+$/, "")
  if (expPart && int.length + frac.length > MAX_PLAIN) {
    // Exponent statt hunderter Nullen; die Mantisse bleibt vollständig.
    const lead = digits.replace(/^0+/, "")
    const e = exp + intDigits!.length - 1 - (digits.length - lead.length)
    const m = lead.replace(/0+$/, "")
    return `${sign}${m[0]}${m.length > 1 ? "," + m.slice(1) : ""}e${e}`
  }
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${sign}${grouped}${frac ? "," + frac : ""}`
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
// Ton einer Option (status B6, select B8; Design 27.09.2026)

/**
 * Die Töne, die eine Option im Register tragen darf (`options[].tone`):
 * semantisch, nie eine Farbe. Gemalt wird über die Theme-Tokens
 * (`--muted-foreground`, `--warning`, `--success`, `--destructive`, `--info`).
 */
export const OPTION_TONES = ["neutral", "warning", "success", "danger", "info"] as const
export type OptionTone = (typeof OPTION_TONES)[number]

/**
 * Der Ton einer Option: ihr `tone`; ohne ihn beim Status die Rolle (open
 * neutral, active warning, done success; Spec 06, Regel 18); sonst die
 * Typfarbe des Items (`"type"`). Ohne Option (unbekannter Wert) neutral.
 */
export function optionTone(widget: string, option: { tone?: string; role?: string } | undefined): OptionTone | "type" {
  if (!option) return "neutral"
  if (option.tone && (OPTION_TONES as readonly string[]).includes(option.tone)) return option.tone as OptionTone
  if (widget === "status") {
    if (option.role === "open") return "neutral"
    if (option.role === "active") return "warning"
    if (option.role === "done") return "success"
  }
  return "type"
}
