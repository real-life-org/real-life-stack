/**
 * Welcher Stand laeuft: Version, Commit, OTA-Kanal. Die App gibt es dem Rahmen
 * (`build`), das Nutzer-Menue zeigt es als stille Zeile ganz unten — so dezent
 * wie moeglich (Anton, 23.09.2026), aber da, wenn eine Fehlermeldung es braucht.
 * Bis dahin konnte niemand in der App sehen, welches Bundle ein Geraet gerade hat.
 */
export interface BuildInfo {
  /** Version der App (package.json). */
  version?: string
  /** Kurzer Git-Commit des Builds. */
  commit?: string
  /** OTA-Kanal (`ios`, `android`, `android-foss`, `web`), falls die App einen hat. */
  channel?: string
}

/** `0.4.0 · a1b2c3d · android-foss` — nur, was gesetzt ist; leer, wenn nichts. */
export function formatBuild(build: BuildInfo | undefined): string {
  if (!build) return ""
  return [build.version, build.commit?.slice(0, 7), build.channel].filter((s): s is string => !!s).join(" · ")
}
