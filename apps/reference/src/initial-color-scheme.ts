/**
 * Erscheinungsbild beim Start: eine bewusst getroffene Wahl gewinnt, sonst
 * gilt die Systemvorgabe.
 *
 * Ohne das startete die App IMMER hell — auch auf einem dunkel eingestellten
 * System und auch dann, wenn beim letzten Besuch dunkel gewaehlt worden war.
 * Wer von einer Landingpage kommt, die der Systemvorgabe folgt, fiel damit
 * beim Klick aus dem Dunkeln ins Helle.
 *
 * `prefers-color-scheme` wird dabei NICHT zum Signal, an dem sich einzelne
 * Bestandteile ausrichten (siehe `color-scheme.ts` im Toolkit): es wird hier
 * gelesen, um die `dark`-Klasse zu setzen. Oberflaeche und Karte folgen
 * danach gemeinsam dieser Klasse — genau die Trennung, die dort beschrieben
 * ist.
 */

/**
 * Bewusst instanzweit und nicht app-spezifisch: Landingpage und App einer
 * Instanz liegen auf derselben Domain und teilen sich damit den Speicher —
 * eine Wahl auf der einen Seite gilt auf der anderen mit.
 */
export const STORAGE_KEY_THEME = "rls-theme"

/**
 * Die gespeicherte Wahl, oder `null`, wenn keine vorliegt.
 *
 * Alles, was weder `"dark"` noch `"light"` ist, zaehlt als KEINE Wahl. Ein
 * Fremdwert (etwa ein spaeter ergaenztes `"auto"`) darf nicht stillschweigend
 * als "hell" gelten — dann folgte die App der Systemvorgabe nicht mehr, ohne
 * dass jemand das je gewaehlt haette.
 */
function gespeicherteWahl(): "dark" | "light" | null {
  try {
    const wert = window.localStorage.getItem(STORAGE_KEY_THEME)
    return wert === "dark" || wert === "light" ? wert : null
  } catch {
    // In privaten Fenstern kann schon der Zugriff werfen.
    return null
  }
}

/**
 * LIEST nur. Schreibt bewusst nichts: wuerde der Startwert die Systemvorgabe
 * gleich festschreiben, waere sie ab dem ersten Besuch eine feste Wahl — ein
 * spaeterer Wechsel des Systems auf hell bliebe wirkungslos.
 */
export function initialDarkMode(): boolean {
  const wahl = gespeicherteWahl()
  if (wahl) return wahl === "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/**
 * Setzt die `dark`-Klasse am Wurzelelement.
 *
 * Wird VOR dem ersten Render aufgerufen (main.tsx), nicht erst in einer
 * Komponente: Anmeldung und Onboarding liegen vor der App-Shell und blieben
 * sonst hell, egal was System oder Wahl sagen.
 */
export function applyInitialColorScheme(): void {
  document.documentElement.classList.toggle("dark", initialDarkMode())
}

/**
 * Haelt eine BEWUSST getroffene Wahl fest — nur aus dem Umschalter heraus
 * aufrufen, nie beim Start.
 */
export function rememberColorScheme(isDark: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_THEME, isDark ? "dark" : "light")
  } catch {
    // Nicht speicherbar — kein Grund, das Umschalten selbst scheitern zu lassen.
  }
}
