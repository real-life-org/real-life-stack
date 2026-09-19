/**
 * Dark-mode detection for consumers that cannot express their theme in CSS.
 *
 * RLS drives dark mode through a `dark` class on `document.documentElement`
 * (Tailwind's `@custom-variant dark (&:is(.dark *))`, toggled by the app shell).
 * Everything styled in CSS follows along for free. A WebGL map does not: its
 * vector style is JSON fetched at runtime, so it has to *read* the same signal.
 * That read lives here once instead of being re-sniffed per component.
 *
 * Die Klasse ist das EINZIGE Signal, an dem sich Bestandteile ausrichten;
 * `prefers-color-scheme` ist kein zweites. Gelesen wird die Systemvorgabe nur
 * einmal, beim Start, um die Klasse zu setzen (`initialDarkMode` unten) — und
 * genau deshalb folgen Oberfläche und Karte danach gemeinsam derselben Klasse.
 *
 * (Bis 19.09.2026 stand hier, die Hülle setze die Klasse NICHT aus der
 * Systemvorgabe. Das stimmte nicht mehr: `applyInitialColorScheme` tut es seit
 * Längerem, und ohne das startete die App immer hell.)
 */

export type ColorScheme = "light" | "dark"

/** `"auto"` follows the app's `dark` class; the explicit values pin the scheme. */
export type ColorSchemePreference = ColorScheme | "auto"

const DARK_CLASS = "dark"

/** Current scheme for a preference. `"auto"` resolves to `"light"` off-DOM (SSR). */
export function resolveColorScheme(preference: ColorSchemePreference = "auto"): ColorScheme {
  if (preference !== "auto") return preference
  if (typeof document === "undefined") return "light"
  return document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light"
}

/**
 * Call `callback` whenever the resolved `"auto"` scheme flips. Fires on change
 * only (never with the initial value) — callers already have that from
 * `resolveColorScheme()`. Returns an unsubscribe.
 *
 * Only the `class` attribute of `document.documentElement` is watched, matching
 * where the app shell toggles it. A `dark` class set on some inner wrapper
 * instead (a Storybook decorator, say) is not observed.
 */
export function observeColorScheme(callback: (scheme: ColorScheme) => void): () => void {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => {}
  }
  let last = resolveColorScheme("auto")
  const observer = new MutationObserver(() => {
    const next = resolveColorScheme("auto")
    if (next === last) return
    last = next
    callback(next)
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

// ── Der Startwert ───────────────────────────────────────────────────────────

/**
 * Erscheinungsbild beim Start: eine bewusst getroffene Wahl gewinnt, sonst
 * gilt die Systemvorgabe.
 *
 * Ohne das startete eine App IMMER hell — auch auf einem dunkel eingestellten
 * System und auch dann, wenn beim letzten Besuch dunkel gewählt worden war.
 * Wer von einer Landingpage kommt, die der Systemvorgabe folgt, fiel damit
 * beim Klick aus dem Dunkeln ins Helle.
 *
 * Stand bis 19.09.2026 zweimal im Monorepo, mit verschiedenen Schlüsseln und
 * unterschiedlicher Behandlung von Fremdwerten.
 */

/**
 * Bewusst instanzweit und nicht app-spezifisch: Landingpage und App einer
 * Instanz liegen auf derselben Domain und teilen sich damit den Speicher —
 * eine Wahl auf der einen Seite gilt auf der anderen mit. Eine App mit eigenem
 * Erscheinungsbild gibt einen eigenen Schlüssel an.
 */
export const STORAGE_KEY_THEME = "rls-theme"

/**
 * Die gespeicherte Wahl, oder `null`, wenn keine vorliegt.
 *
 * Alles, was weder `"dark"` noch `"light"` ist, zählt als KEINE Wahl. Ein
 * Fremdwert (etwa ein später ergänztes `"auto"`) darf nicht stillschweigend
 * als hell gelten — dann folgte die App der Systemvorgabe nicht mehr, ohne
 * dass jemand das je gewählt hätte.
 */
export function storedColorScheme(storageKey = STORAGE_KEY_THEME): ColorScheme | null {
  try {
    const wert = window.localStorage.getItem(storageKey)
    return wert === "dark" || wert === "light" ? wert : null
  } catch {
    // In privaten Fenstern kann schon der Zugriff werfen.
    return null
  }
}

/**
 * LIEST nur. Schreibt bewusst nichts: Würde der Startwert die Systemvorgabe
 * gleich festschreiben, wäre sie ab dem ersten Besuch eine feste Wahl — ein
 * späterer Wechsel des Systems auf hell bliebe wirkungslos.
 */
export function initialDarkMode(storageKey = STORAGE_KEY_THEME): boolean {
  const wahl = storedColorScheme(storageKey)
  if (wahl) return wahl === "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/**
 * Setzt die `dark`-Klasse am Wurzelelement.
 *
 * Vor dem ersten Render aufrufen, nicht erst in einer Komponente: Anmeldung
 * und Onboarding liegen vor der App-Hülle und blieben sonst hell, egal was
 * System oder Wahl sagen.
 */
export function applyInitialColorScheme(storageKey = STORAGE_KEY_THEME): void {
  document.documentElement.classList.toggle(DARK_CLASS, initialDarkMode(storageKey))
}

/**
 * Hält eine BEWUSST getroffene Wahl fest — nur aus dem Umschalter heraus
 * aufrufen, nie beim Start.
 */
export function rememberColorScheme(isDark: boolean, storageKey = STORAGE_KEY_THEME): void {
  try {
    window.localStorage.setItem(storageKey, isDark ? "dark" : "light")
  } catch {
    // Nicht speicherbar — kein Grund, das Umschalten selbst scheitern zu lassen.
  }
}
