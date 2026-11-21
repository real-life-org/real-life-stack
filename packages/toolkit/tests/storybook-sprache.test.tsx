// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { enableLanguageChoice, getLanguage, setLanguage } from "../src/i18n"
import { resetI18nForTests } from "../src/testing"

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}))
vi.mock("../.storybook/storybook.css", () => ({}))
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { default: preview } = await import("../.storybook/preview")

/**
 * Die Sprache der Storybook-Vorschau ist keine Nutzerwahl der App (rls#620).
 * App und Storybook liegen im Deployment auf derselben Origin (`/app/`,
 * `/storybook/`), das Handbuch bettet Stories ein: schrieb der Dekorator nach
 * `localStorage['rls.language']`, stellte schon ein Handbuchbesuch eine
 * englische App auf Deutsch um.
 */
let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

async function mountDecorator(language: string) {
  const decorator = preview.decorators as unknown as Array<(story: () => unknown, ctx: unknown) => unknown>
  const Story = () => createElement("span", null, "story")
  const Wrapper = () => decorator[0]!(Story, { globals: { language, theme: "light" }, parameters: {} }) as never
  await act(async () => { root.render(createElement(Wrapper)) })
}

describe("Storybook-Sprachumschalter", () => {
  it("lässt eine gespeicherte App-Sprache unangetastet", async () => {
    // Die App hat einen Umschalter und dort Englisch gespeichert.
    resetI18nForTests()
    enableLanguageChoice()
    setLanguage("en")
    expect(localStorage.getItem("rls.language")).toBe("en")

    await mountDecorator("de")

    expect(getLanguage(), "die Vorschau zeigt Deutsch").toBe("de")
    expect(localStorage.getItem("rls.language"), "die App-Wahl bleibt").toBe("en")
  })

  it("schreibt auch beim Umschalten nichts in den Speicher", async () => {
    resetI18nForTests()
    await mountDecorator("en")
    await mountDecorator("de")
    expect(getLanguage()).toBe("de")
    expect(localStorage.getItem("rls.language")).toBeNull()
  })
})

describe("setLanguage(…, { persist: false })", () => {
  it("merkt nichts und zählt nicht als Nutzerwahl", async () => {
    const { applyLanguageConfig } = await import("../src/i18n")
    resetI18nForTests("de")
    setLanguage("en", { persist: false })
    expect(getLanguage()).toBe("en")
    expect(localStorage.getItem("rls.language")).toBeNull()
    // Keine Nutzerwahl: eine Instanz-Vorgabe darf die flüchtige Sprache ablösen.
    applyLanguageConfig({ defaultLanguage: "de" })
    expect(getLanguage()).toBe("de")
  })
})
