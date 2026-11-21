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
 * `prefers-color-scheme` ist kein zweites. Gelesen wird die Systemvorgabe nur,
 * um die Klasse zu setzen: beim Start (`initialDarkMode` unten) und, solange
 * nichts gewählt ist, bei jedem Systemwechsel (`followSystemColorScheme`) —
 * und genau deshalb folgen Oberfläche und Karte gemeinsam derselben Klasse.
 * `data-theme` setzt `applyColorScheme` mit, als Ausgabe für Stylesheets;
 * gelesen wird es hier nicht.
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
  // Zuerst die Wahl dieser Seite, die nicht gespeichert werden konnte: Sie ist
  // jünger als alles, was im Speicher steht (rls#574).
  const unspeicherbar = unspeicherbareWahl.get(storageKey)
  if (unspeicherbar) return unspeicherbar
  try {
    const wert = window.localStorage.getItem(storageKey)
    return wert === "dark" || wert === "light" ? wert : null
  } catch {
    // In privaten Fenstern kann schon der Zugriff werfen.
    return null
  }
}

/**
 * Eine Wahl, die der Speicher nicht nehmen wollte (gesperrt, voll), gilt
 * trotzdem bis zum Neuladen, und zwar VOR einem älteren Speicherwert. Sonst
 * holte der nächste Systemwechsel das Schema zurück, obwohl gerade bewusst
 * gewählt worden war, oder ein neu eingehängter Knopf sprang auf die alte
 * Wahl. Ein erfolgreiches Schreiben entfernt sie; ab dann gilt der Speicher.
 */
const unspeicherbareWahl = new Map<string, ColorScheme>()

/**
 * LIEST nur. Schreibt bewusst nichts: Würde der Startwert die Systemvorgabe
 * gleich festschreiben, wäre sie ab dem ersten Besuch eine feste Wahl — ein
 * späterer Wechsel des Systems auf hell bliebe wirkungslos.
 */
export function initialDarkMode(storageKey = STORAGE_KEY_THEME): boolean {
  const wahl = storedColorScheme(storageKey)
  if (wahl) return wahl === "dark"
  // Ohne `matchMedia` (ältere Einbettungen, Testumgebungen) gibt es keine
  // Systemvorgabe zu lesen — dann hell, statt beim Start zu werfen.
  if (typeof window.matchMedia !== "function") return false
  return window.matchMedia(SYSTEM_DARK).matches
}

const SYSTEM_DARK = "(prefers-color-scheme: dark)"

/**
 * Setzt BEIDE Signale am Wurzelelement: die `dark`-Klasse und `data-theme`.
 *
 * Die Klasse ist das Signal, an dem sich das Toolkit ausrichtet (Tailwind,
 * Karte, siehe oben). `data-theme` führt dasselbe für Stylesheets, die sich an
 * das Attribut hängen — etwa Tokens nach dem Muster
 * `:root[data-theme="dark"]` und `@media (prefers-color-scheme: dark) {
 * :root:not([data-theme="light"]) }`. Nur mit der Medienabfrage wäre eine
 * bewusste Wahl dort wirkungslos; nur mit der Klasse bliebe dieselbe Wahl dort
 * unsichtbar. Darum immer beide zusammen, nie eines allein.
 */
export function applyColorScheme(scheme: ColorScheme): void {
  const wurzel = document.documentElement
  wurzel.classList.toggle(DARK_CLASS, scheme === "dark")
  wurzel.setAttribute("data-theme", scheme)
}

/**
 * Setzt beide Signale (`dark`-Klasse und `data-theme`) nach Wahl oder
 * Systemvorgabe.
 *
 * Vor dem ersten Render aufrufen, nicht erst in einer Komponente: Anmeldung
 * und Onboarding liegen vor der App-Hülle und blieben sonst hell, egal was
 * System oder Wahl sagen. Und vor jedem `await` beim Start (etwa dem Laden
 * der Instanz-Konfiguration): Bis dahin steht die Seite sonst hell da.
 *
 * Was ein Modul-Skript nicht verhindern kann: das Stück zwischen dem ersten
 * Malen der HTML-Seite und seiner Ausführung. Das schließt nur ein Skript im
 * `<head>` der App, das dieselbe Wahl liest, bevor der Body steht.
 */
export function applyInitialColorScheme(storageKey = STORAGE_KEY_THEME): void {
  applyColorScheme(initialDarkMode(storageKey) ? "dark" : "light")
}

/**
 * Folgt einem Wechsel der Systemvorgabe, solange keine Wahl gespeichert ist.
 * Gibt die Abmeldung zurück.
 *
 * Gefragt wird bei JEDEM Wechsel neu, nicht einmal beim Anmelden: Eine Wahl,
 * die inzwischen getroffen wurde (auch in einem anderen Tab), sticht die
 * Systemvorgabe ab diesem Moment. Schreibt nichts — die Systemvorgabe wird
 * dadurch nicht zur Wahl.
 */
export function followSystemColorScheme(storageKey = STORAGE_KEY_THEME): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
  const abfrage = window.matchMedia(SYSTEM_DARK)
  if (typeof abfrage?.addEventListener !== "function") return () => {}
  const beiWechsel = (ereignis: { matches: boolean }) => {
    if (storedColorScheme(storageKey)) return
    applyColorScheme(ereignis.matches ? "dark" : "light")
  }
  abfrage.addEventListener("change", beiWechsel)
  return () => abfrage.removeEventListener("change", beiWechsel)
}

/**
 * Hält eine BEWUSST getroffene Wahl fest — nur aus dem Umschalter heraus
 * aufrufen, nie beim Start.
 */
export function rememberColorScheme(isDark: boolean, storageKey = STORAGE_KEY_THEME): void {
  const wahl: ColorScheme = isDark ? "dark" : "light"
  try {
    window.localStorage.setItem(storageKey, wahl)
    unspeicherbareWahl.delete(storageKey)
  } catch {
    // Nicht speicherbar — kein Grund, das Umschalten selbst scheitern zu
    // lassen. Die Wahl gilt dann bis zum Neuladen aus dem Arbeitsspeicher.
    unspeicherbareWahl.set(storageKey, wahl)
  }
}
