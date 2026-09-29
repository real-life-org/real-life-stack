"use client"

import { useEffect } from "react"
import { Moon, Sun } from "lucide-react"

import { useColorScheme } from "../../hooks/use-color-scheme"
import {
  applyColorScheme,
  followSystemColorScheme,
  initialDarkMode,
  rememberColorScheme,
  STORAGE_KEY_THEME,
} from "../../lib/color-scheme"
import { cn } from "../../lib/utils"
import { Button } from "../primitives/button"

export interface ColorSchemeToggleProps {
  /**
   * Wo die Wahl gemerkt wird. Standard ist der instanzweite Schlüssel
   * (`STORAGE_KEY_THEME`), den Landingpage und App einer Domain teilen.
   */
  storageKey?: string
  className?: string
}

/**
 * Switches between light and dark.
 *
 * Der Knopf für hell und dunkel, rechts in der Kopfzeile (`NavbarEnd`).
 *
 * - Führt beide Signale am Wurzelelement: die `dark`-Klasse und `data-theme`.
 * - Merkt eine bewusste Wahl je Browser; ohne Speicher schaltet er trotzdem.
 * - Ohne Wahl folgt er der Systemvorgabe, auch wenn sie sich später ändert.
 *   Das bloße Anzeigen schreibt nichts fest.
 *
 * Symbol und Beschriftung nennen das Ziel (im Dunkeln die Sonne, „Helles
 * Design“). Beide leiten sich aus der Klasse ab, nicht aus einem eigenen
 * Zustand: Setzt eine andere Stelle das Schema (der Start, die
 * Storybook-Leiste), stimmt der Knopf trotzdem.
 *
 * Ein Dokument hat ein Schema: Mehrere Knöpfe in einer Seite nehmen denselben
 * `storageKey`, sonst setzt jeder beim Einhängen seine eigene Wahl durch.
 *
 * Gegen das Aufblitzen beim Laden hilft er nicht, er steht erst nach dem
 * ersten Render. Dafür ruft die App vorher `applyInitialColorScheme()` auf.
 *
 * @see story rls-app-shell-navigation-color-scheme-toggle--default
 */
export function ColorSchemeToggle({ storageKey = STORAGE_KEY_THEME, className }: ColorSchemeToggleProps) {
  const scheme = useColorScheme()

  useEffect(() => {
    // Hat die App den Startwert schon gesetzt, ändert das nichts; sonst holt
    // der Knopf ihn nach (Apps ohne eigenen Startaufruf).
    applyColorScheme(initialDarkMode(storageKey) ? "dark" : "light")
    return followSystemColorScheme(storageKey)
  }, [storageKey])

  const dunkel = scheme === "dark"
  const umschalten = () => {
    const naechstes = dunkel ? "light" : "dark"
    applyColorScheme(naechstes)
    rememberColorScheme(naechstes === "dark", storageKey)
  }
  const label = dunkel ? "Helles Design" : "Dunkles Design"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={umschalten}
      className={cn("h-9 w-9", className)}
      aria-label={label}
      title={label}
    >
      {dunkel ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </Button>
  )
}
