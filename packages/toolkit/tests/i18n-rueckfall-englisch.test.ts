// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * „Im Zweifel Englisch" (Entscheid Anton, 09.10.2026). Greift weder eine
 * Nutzerwahl (mit Opt-in) noch die Instanz-Vorgabe noch eine unterstützte
 * Browsersprache, spricht die App Englisch — nicht mehr Deutsch. Deutsch
 * bleibt das Referenz-Wörterbuch (`de.ts` liefert die Schlüssel).
 *
 * Je Text gilt: aktive Sprache → Englisch → Deutsch. Ein Eintrag fehlt in einer
 * Sprache nur auf App- oder Instanz-Ebene; das Toolkit selbst ist vollständig.
 */
type Runtime = typeof import("../src/i18n/runtime")

async function start(browser: string | null): Promise<Runtime> {
  vi.resetModules()
  localStorage.clear()
  if (browser === null) {
    vi.stubGlobal("navigator", undefined)
  } else {
    Object.defineProperty(navigator, "language", { value: browser, configurable: true })
    Object.defineProperty(navigator, "languages", { value: [browser], configurable: true })
  }
  return import("../src/i18n/runtime")
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete (navigator as unknown as Record<string, unknown>).language
  delete (navigator as unknown as Record<string, unknown>).languages
  vi.restoreAllMocks()
})

describe("Sprache im Zweifel Englisch", () => {
  it("Browser fr → en", async () => {
    expect((await start("fr-FR")).getLanguage()).toBe("en")
  })

  it("Browser ja → en", async () => {
    expect((await start("ja")).getLanguage()).toBe("en")
  })

  it("ohne navigator → en", async () => {
    expect((await start(null)).getLanguage()).toBe("en")
  })

  it("Browser de-CH und de-AT → de", async () => {
    expect((await start("de-CH")).getLanguage()).toBe("de")
    expect((await start("de-AT")).getLanguage()).toBe("de")
  })

  it("die Instanz-Vorgabe schlägt den Rückfall weiterhin", async () => {
    const rt = await start("fr-FR")
    rt.applyLanguageConfig({ defaultLanguage: "de" })
    expect(rt.getLanguage()).toBe("de")
  })
})

describe("Text-Rückfall: aktive Sprache → Englisch → Deutsch", () => {
  it("ein App-Schlüssel nur auf Deutsch erscheint auf Deutsch", async () => {
    const rt = await start("fr-FR")
    rt.extendMessages({ de: { "app.nurDeutsch": "Nur deutsch" } } as never)
    expect(rt.getI18n().tDynamic("app.nurDeutsch")).toBe("Nur deutsch")
  })

  it("ein App-Schlüssel auf Englisch und Deutsch erscheint beim fr-Browser englisch", async () => {
    const rt = await start("fr-FR")
    rt.extendMessages({ de: { "app.beide": "Beide" }, en: { "app.beide": "Both" } } as never)
    expect(rt.getI18n().tDynamic("app.beide")).toBe("Both")
  })

  it("fehlt ein App-Text auf Deutsch, aber nicht auf Englisch, zeigt Deutsch den englischen", async () => {
    const rt = await start("de-DE")
    rt.extendMessages({ en: { "app.nurEnglisch": "English only" } } as never)
    expect(rt.getLanguage()).toBe("de")
    expect(rt.getI18n().tDynamic("app.nurEnglisch")).toBe("English only")
  })

  it("eine Instanz-Übersetzung nur auf Englisch gilt auch, wenn Deutsch aktiv ist und kein deutscher Text existiert", async () => {
    const rt = await start("de-DE")
    rt.applyLanguageConfig({ strings: { en: { "app.instanz": "Instance text" } } })
    expect(rt.getI18n().tDynamic("app.instanz")).toBe("Instance text")
  })
})
