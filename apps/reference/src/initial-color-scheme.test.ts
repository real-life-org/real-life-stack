// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { initialDarkMode, rememberColorScheme, STORAGE_KEY_THEME } from "./initial-color-scheme"

/** Systemvorgabe stellen — jsdom bringt kein echtes matchMedia mit. */
function systemMag(dunkel: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") ? dunkel : !dunkel,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
}

describe("Startwert des Erscheinungsbilds", () => {
  beforeEach(() => localStorage.clear())
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

  it("haelt die Wahl ueber einen Neustart hinweg", () => {
    systemMag(false)
    rememberColorScheme(true)
    expect(localStorage.getItem(STORAGE_KEY_THEME)).toBe("dark")
    expect(initialDarkMode()).toBe(true)   // wie beim naechsten Laden
  })

  it("faellt auf die Systemvorgabe zurueck, wenn der Speicher wirft", () => {
    // Private Fenster koennen schon beim Zugriff werfen. Das darf den Start
    // nicht kosten — und rememberColorScheme darf das Umschalten nicht brechen.
    systemMag(true)
    const kaputt = { getItem() { throw new Error("gesperrt") },
                     setItem() { throw new Error("gesperrt") } }
    vi.stubGlobal("localStorage", kaputt)
    expect(initialDarkMode()).toBe(true)
    expect(() => rememberColorScheme(false)).not.toThrow()
  })

  it("ignoriert einen Wert, der weder dark noch light ist", () => {
    systemMag(true)
    localStorage.setItem(STORAGE_KEY_THEME, "auto")
    expect(initialDarkMode()).toBe(false)   // alles ausser "dark" heisst hell
  })
})
