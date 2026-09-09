"use client"

import { cn } from "../../lib/utils"

/**
 * Das Fadenkreuz des Standort-Knopfes — uebernommen aus der Utopia Map
 * (`lib/src/assets/target.svg`), damit derselbe Knopf in beiden Anwendungen
 * gleich aussieht.
 *
 * Als Komponente und nicht als Asset-Import: Ein `.svg` durch den Build zu
 * reichen (oder es zur Laufzeit zu holen, wie es das Vorbild mit
 * `react-inlinesvg` tut) haengt an der Bundler-Konfiguration jeder App, die
 * das Toolkit benutzt. Ein Pfad im Code haengt an nichts.
 *
 * `currentColor`: Die Farbe kommt vom Knopf — aktiv traegt er sie in der
 * Primaerfarbe.
 */
export function StandortIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("h-4 w-4", className)}
    >
      <path d="M30 14.75h-2.824c-0.608-5.219-4.707-9.318-9.874-9.921l-0.053-0.005v-2.824c0-0.69-0.56-1.25-1.25-1.25s-1.25 0.56-1.25 1.25v0 2.824c-5.219 0.608-9.318 4.707-9.921 9.874l-0.005 0.053h-2.824c-0.69 0-1.25 0.56-1.25 1.25s0.56 1.25 1.25 1.25v0h2.824c0.608 5.219 4.707 9.318 9.874 9.921l0.053 0.005v2.824c0 0.69 0.56 1.25 1.25 1.25s1.25-0.56 1.25-1.25v0-2.824c5.219-0.608 9.318-4.707 9.921-9.874l0.005-0.053h2.824c0.69 0 1.25-0.56 1.25-1.25s-0.56-1.25-1.25-1.25v0zM17.25 24.624v-2.624c0-0.69-0.56-1.25-1.25-1.25s-1.25 0.56-1.25 1.25v0 2.624c-3.821-0.57-6.803-3.553-7.368-7.326l-0.006-0.048h2.624c0.69 0 1.25-0.56 1.25-1.25s-0.56-1.25-1.25-1.25v0h-2.624c0.57-3.821 3.553-6.804 7.326-7.368l0.048-0.006v2.624c0 0.69 0.56 1.25 1.25 1.25s1.25-0.56 1.25-1.25v0-2.624c3.821 0.57 6.803 3.553 7.368 7.326l0.006 0.048h-2.624c-0.69 0-1.25 0.56-1.25 1.25s0.56 1.25 1.25 1.25v0h2.624c-0.571 3.821-3.553 6.803-7.326 7.368l-0.048 0.006z" />
    </svg>
  )
}
