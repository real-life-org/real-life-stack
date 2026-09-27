// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ContentComposer } from "../src/components/composer/content-composer"
import { pickContentTypes } from "../src/components/composer/content-types"

/**
 * Befund Anton zu #518: Fehler beim Speichern als Banner oben im Formular
 * (shared-components, Detail-Anatomie Slot note: „Fehler-Banner inline";
 * Zustand Fehler: Banner mit „Erneut", Eingaben bleiben erhalten).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe("Fehler beim Speichern", () => {
  it("zeigt ein Banner unter dem Kopf mit Grund und „Erneut“; Erneut speichert noch einmal mit denselben Eingaben", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("Speichern fehlgeschlagen.", { cause: new Error("Kein Schreibrecht in diesem Space") }))
      .mockResolvedValueOnce(undefined)
    await act(async () => {
      root.render(createElement(ContentComposer, { contentTypes: pickContentTypes("task"), mode: "task", initialData: { title: "Beete gießen" }, editMode: true, onSubmit }))
    })
    const save = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Speichern")!
    await act(async () => save.click())

    const banner = host.querySelector('[data-slot="save-error"]')!
    expect(banner).toBeTruthy()
    expect(banner.getAttribute("role")).toBe("alert")
    expect(banner.textContent).toContain("Konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten.")
    expect(banner.textContent).toContain("Kein Schreibrecht in diesem Space")
    // Unter dem Kopf, vor den Feldern.
    const head = host.querySelector('[data-slot="composer-type"]')!
    expect(head.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const title = host.querySelector("input, textarea") as HTMLInputElement
    expect(banner.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Kein zweiter roter Fließtext über der Fußzeile.
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1)

    const retry = [...banner.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Erneut")!
    await act(async () => retry.click())
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit.mock.calls[1][0].data.title).toBe("Beete gießen")
    expect(host.querySelector('[data-slot="save-error"]')).toBeNull()
  })
})
