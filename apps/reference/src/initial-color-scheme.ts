/**
 * Startwert des Erscheinungsbilds: eine frueher getroffene Wahl gewinnt,
 * sonst gilt die Systemvorgabe.
 *
 * Ohne das startete die App IMMER hell — auch auf einem dunkel eingestellten
 * System und auch dann, wenn beim letzten Besuch dunkel gewaehlt worden war.
 * Wer von einer Landingpage kommt, die der Systemvorgabe folgt, fiel damit
 * beim Klick in die App aus dem Dunkeln ins Helle.
 *
 * `prefers-color-scheme` wird dabei NICHT zum Signal, an dem sich einzelne
 * Bestandteile ausrichten (siehe `color-scheme.ts` im Toolkit): es wird hier
 * genau einmal gelesen, um die `dark`-Klasse zu setzen. Oberflaeche und Karte
 * folgen danach gemeinsam dieser Klasse — genau die Trennung, die dort
 * beschrieben ist.
 */

/**
 * Bewusst instanzweit und nicht app-spezifisch: Landingpage und App einer
 * Instanz liegen auf derselben Domain und teilen sich damit den Speicher —
 * eine Wahl auf der einen Seite gilt auf der anderen mit.
 */
export const STORAGE_KEY_THEME = "rls-theme"

export function initialDarkMode(): boolean {
  try {
    const gewaehlt = window.localStorage.getItem(STORAGE_KEY_THEME)
    if (gewaehlt) return gewaehlt === "dark"
  } catch {
    // In privaten Fenstern kann schon der Zugriff werfen.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

/** Wahl festhalten. Schlaegt das Speichern fehl, gilt sie nur fuer die Sitzung. */
export function rememberColorScheme(isDark: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_THEME, isDark ? "dark" : "light")
  } catch {
    // Nicht speicherbar — kein Grund, das Umschalten selbst scheitern zu lassen.
  }
}
