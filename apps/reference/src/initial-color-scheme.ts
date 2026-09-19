/**
 * Der Startwert des Erscheinungsbilds liegt im Toolkit (`lib/color-scheme`);
 * jede App braucht ihn. Hier bleibt nur der Wiederexport unter den Namen, die
 * `main.tsx` und der Umschalter schon benutzen.
 */
export {
  STORAGE_KEY_THEME,
  initialDarkMode,
  applyInitialColorScheme,
  rememberColorScheme,
} from "@real-life-stack/toolkit"
