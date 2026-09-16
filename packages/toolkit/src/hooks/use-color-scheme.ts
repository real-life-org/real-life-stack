import { useEffect, useState } from "react"

import { type ColorScheme } from "../lib/color-scales"

/**
 * Hell oder dunkel — was gerade gilt.
 *
 * Die Entscheidung gehört dem Menschen, nicht dem Space: wer nachts am
 * Rechner sitzt, braucht dunkel, wer tagsüber in der Sonne sitzt, hell. Die
 * App hält das in der Klasse `dark` auf dem Wurzelelement.
 *
 * Gelesen wird beobachtend statt durchgereicht, weil mehr als eine Stelle es
 * braucht und keine davon unter dem Schalter hängt: die Token-Schicht der App
 * und der Space-Dialog, der eine Vorschau der Skala zeigt.
 */
export function useColorScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  )

  useEffect(() => {
    const root = document.documentElement
    const read = () => setScheme(root.classList.contains("dark") ? "dark" : "light")
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return scheme
}
