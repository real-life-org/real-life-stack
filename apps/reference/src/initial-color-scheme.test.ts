// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import {
  initialDarkMode,
  applyInitialColorScheme,
  rememberColorScheme,
  STORAGE_KEY_THEME,
} from "./initial-color-scheme"

/** Systemvorgabe stellen — jsdom bringt kein echtes matchMedia mit. */
function systemMag(dunkel: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") ? dunkel : !dunkel,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

describe("Erscheinungsbild beim Start", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
  })
  afterEach(() => vi.unstubAllGlobals())

  it("folgt der Systemvorgabe, solange nichts gewaehlt wurde", () => {
    systemMag(true)
    expect(initialDarkMode()).toBe(true)
    systemMag(false)
    expect(initialDarkMode()).toBe(false)
  })

  it("laesst eine getroffene Wahl die Systemvorgabe stechen — in beide Richtungen", () => {
    systemMag(false)
    localStorage.setItem(STORAGE_KEY_THEME, "dark")
    expect(initialDarkMode()).toBe(true)

    systemMag(true)
    localStorage.setItem(STORAGE_KEY_THEME, "light")
    expect(initialDarkMode()).toBe(false)
  })

  it("haelt eine gewaehlte Fassung ueber einen Neustart hinweg", () => {
    systemMag(false)
    rememberColorScheme(true)
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe("dark")
    expect(initialDarkMode()).toBe(true)   // wie beim naechsten Laden
  })

  // Der Kern: das blosse Lesen darf die Systemvorgabe NICHT festschreiben.
  // Sonst waere sie ab dem ersten Besuch eine Wahl, und ein spaeterer Wechsel
  // des Systems bliebe wirkungslos.
  it("schreibt beim Lesen nichts — die Systemvorgabe wird nicht zur Wahl", () => {
    systemMag(true)
    initialDarkMode()
    applyInitialColorScheme()
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBeNull()
  })

  it("folgt dem System weiter, wenn es nach dem ersten Besuch wechselt", () => {
    systemMag(true)
    applyInitialColorScheme()
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    systemMag(false)                       // System spaeter auf hell gestellt
    applyInitialColorScheme()
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  // Ein Fremdwert ist KEINE Wahl. Zaehlte er als "hell", folgte die App der
  // Systemvorgabe nicht mehr, ohne dass jemand das gewaehlt haette.
  it("behandelt einen unbekannten Wert wie keine Wahl", () => {
    systemMag(true)
    localStorage.setItem(STORAGE_KEY_THEME, "auto")
    expect(initialDarkMode()).toBe(true)
  })

  it("setzt die dark-Klasse passend zum Ergebnis", () => {
    systemMag(false)
    localStorage.setItem(STORAGE_KEY_THEME, "dark")
    applyInitialColorScheme()
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("faellt auf die Systemvorgabe zurueck, wenn der Speicher wirft", () => {
    systemMag(true)
    vi.stubGlobal("localStorage", {
      getItem() { throw new Error("gesperrt") },
      setItem() { throw new Error("gesperrt") },
    })
    expect(initialDarkMode()).toBe(true)
    expect(() => rememberColorScheme(false)).not.toThrow()
  })
})
