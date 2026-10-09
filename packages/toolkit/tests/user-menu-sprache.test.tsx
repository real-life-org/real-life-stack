// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { UserMenu } from "../src/components/layout/user-menu"
import { getLanguage } from "../src/i18n"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

/**
 * Die Sprache folgt dem Browser, sofern Instanz oder App keine setzen
 * (Entscheid Anton, 09.10.2026). Das Nutzermenü des Toolkits bietet darum
 * keine Sprachwahl an; eine App, die eine will, baut sie über `setLanguage`.
 */
let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

describe("UserMenu ohne Sprachwahl", () => {
  it("zeigt Profil und Abmelden, aber keine Sprachen", async () => {
    await act(async () => {
      root.render(createElement(UserMenu, { user: { id: "u1", displayName: "Mira" }, onProfile: () => {}, onLogout: () => {} }))
    })
    const trigger = host.querySelector<HTMLElement>("[data-testid=user-menu-trigger]")!
    await act(async () => {
      trigger.focus()
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    })
    const text = document.body.textContent ?? ""
    expect(text).toContain("Profil")
    expect(text).toContain("Abmelden")
    expect(document.body.querySelectorAll('[role="menuitemradio"]')).toHaveLength(0)
    expect(text).not.toContain("Sprache")
    expect(text).not.toContain("English")
    expect(getLanguage()).toBe("de")
  })
})
