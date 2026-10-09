// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Eine gespeicherte Sprachwahl (`rls.language`) zählt nur, wenn die App
 * selbst einen Sprachumschalter anbietet und das mit
 * `enableLanguageChoice()` erklärt (Entscheid Anton, 09.10.2026, „Weg 2").
 * Ohne Umschalter gilt: Instanz-Vorgabe → Browser → `de`. Die gespeicherte
 * Wahl wird dabei nur übergangen, nicht gelöscht — bietet die App später
 * einen Umschalter an, gilt sie wieder.
 *
 * Jeder Fall startet die Laufzeit frisch (`vi.resetModules`), mit dem Speicher
 * und der Browsersprache, die ein echter App-Start vorfände.
 */
type Runtime = typeof import("../src/i18n/runtime")

async function start({ stored, browser }: { stored?: string; browser: string }): Promise<Runtime> {
  vi.resetModules()
  localStorage.clear()
  if (stored) localStorage.setItem("rls.language", stored)
  Object.defineProperty(navigator, "language", { value: browser, configurable: true })
  Object.defineProperty(navigator, "languages", { value: [browser], configurable: true })
  return import("../src/i18n/runtime")
}

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  localStorage.clear()
  delete (navigator as unknown as Record<string, unknown>).language
  delete (navigator as unknown as Record<string, unknown>).languages
})

describe("Sprachwahl nur mit Umschalter der App (Weg 2)", () => {
  it("ohne Umschalter folgt die Sprache dem Browser, auch wenn eine Wahl gespeichert ist", async () => {
    const rt = await start({ stored: "en", browser: "de-DE" })
    expect(rt.getLanguage()).toBe("de")
    expect(localStorage.getItem("rls.language"), "nicht gelöscht, nur übergangen").toBe("en")
  })

  it("ohne Umschalter schlägt die Instanz-Vorgabe eine gespeicherte Wahl", async () => {
    const rt = await start({ stored: "en", browser: "de-DE" })
    rt.applyLanguageConfig({ defaultLanguage: "de" })
    expect(rt.getLanguage()).toBe("de")
    const rt2 = await start({ stored: "de", browser: "de-DE" })
    rt2.applyLanguageConfig({ defaultLanguage: "en" })
    expect(rt2.getLanguage()).toBe("en")
  })

  it("mit Umschalter gilt die gespeicherte Wahl wieder", async () => {
    const rt = await start({ stored: "en", browser: "de-DE" })
    rt.enableLanguageChoice()
    expect(rt.getLanguage()).toBe("en")
  })

  it("mit Umschalter schlägt die gespeicherte Wahl die Instanz-Vorgabe — gleich in welcher Reihenfolge", async () => {
    const vorher = await start({ stored: "en", browser: "de-DE" })
    vorher.applyLanguageConfig({ defaultLanguage: "de" })
    vorher.enableLanguageChoice()
    expect(vorher.getLanguage()).toBe("en")

    const nachher = await start({ stored: "en", browser: "de-DE" })
    nachher.enableLanguageChoice()
    nachher.applyLanguageConfig({ defaultLanguage: "de" })
    expect(nachher.getLanguage()).toBe("en")
  })

  it("setLanguage ohne Umschalter wechselt für die Sitzung, speichert aber nichts", async () => {
    const rt = await start({ browser: "de-DE" })
    rt.setLanguage("en")
    expect(rt.getLanguage()).toBe("en")
    expect(localStorage.getItem("rls.language")).toBeNull()
  })

  it("setLanguage mit Umschalter speichert die Wahl", async () => {
    const rt = await start({ browser: "de-DE" })
    rt.enableLanguageChoice()
    rt.setLanguage("en")
    expect(localStorage.getItem("rls.language")).toBe("en")
  })

  it("enableLanguageChoice benachrichtigt Abonnenten, wenn sich die Sprache dadurch ändert", async () => {
    const rt = await start({ stored: "en", browser: "de-DE" })
    const listener = vi.fn()
    rt.subscribeLanguage(listener)
    rt.enableLanguageChoice()
    rt.enableLanguageChoice()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
