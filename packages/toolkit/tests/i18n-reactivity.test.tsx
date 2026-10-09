// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { setLanguage, extendMessages, applyLanguageConfig } from "../src/i18n"
import { resetI18nForTests } from "../src/testing"
import { useI18n } from "../src/i18n/use-i18n"
import { RelativeTime } from "../src/components/primitives/relative-time"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * In React kommen `t` und die Formatierer NUR aus `useI18n()` — wer sie
 * benutzt, ist damit zwangsläufig abonniert (rls#290). Genau diese Kopplung
 * prüft dieser Test: das aus dem Hook bezogene `t` MUSS nach dem Wechsel
 * neu rendern, ohne dass die Komponente an etwas Zweites denken müsste.
 */
function Probe() {
  const { t } = useI18n()
  return createElement("span", null, t("userMenu.contacts"))
}

describe("i18n-Reaktivität", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    resetI18nForTests()
    setLanguage("de")
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    resetI18nForTests()
  })

  it("eine abonnierte Komponente wechselt die Sprache live", async () => {
    await act(async () => root.render(createElement(Probe)))
    expect(container.textContent).toBe("Kontakte")

    await act(async () => setLanguage("en"))

    expect(container.textContent).toBe("Contacts")
  })

  it("RelativeTime formatiert nach dem Wechsel in der neuen Sprache", async () => {
    const yesterday = new Date(Date.now() - 25 * 3600_000)
    await act(async () => root.render(createElement(RelativeTime, { date: yesterday })))
    expect(container.textContent).toBe("gestern")

    await act(async () => setLanguage("en"))

    expect(container.textContent).toBe("yesterday")
  })

  it("rendert neu, wenn eine App Texte nachträgt — ohne Sprachwechsel", async () => {
    function Dynamic() {
      // Laufzeit-Schlüssel ohne Register-Eintrag: tDynamic (rls#614).
      const { tDynamic } = useI18n()
      return createElement("span", null, tDynamic("app.dynamic"))
    }
    const warn = console.warn
    console.warn = () => {}
    try {
      await act(async () => root.render(createElement(Dynamic)))
      expect(container.textContent).toBe("app.dynamic")

      await act(async () => extendMessages({ de: { "app.dynamic": "Dynamisch" } }))
      expect(container.textContent).toBe("Dynamisch")

      await act(async () => applyLanguageConfig({ strings: { de: { "app.dynamic": "Instanz" } } }))
      expect(container.textContent).toBe("Instanz")
    } finally {
      console.warn = warn
    }
  })
})
