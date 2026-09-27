// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DeleteConfirmDialog } from "../src/components/detail/delete-confirm-dialog"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** CodeRabbit an #511: Scheitert das Löschen, zeigt der Dialog den Fehler und bleibt offen. */
describe("DeleteConfirmDialog: Fehler beim Löschen", () => {
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

  it("zeigt den Fehler, bleibt offen und lässt keine Ablehnung entweichen", async () => {
    const onOpenChange = vi.fn()
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)
    await act(async () => {
      root.render(
        createElement(DeleteConfirmDialog, {
          open: true,
          onOpenChange,
          title: "Beete",
          onConfirm: async () => {
            throw new Error("Keine Verbindung")
          },
        }),
      )
    })
    const loeschen = [...document.body.querySelectorAll("button")].find((b) => b.textContent === "Löschen")!
    await act(async () => loeschen.click())
    await act(async () => { await new Promise((r) => setTimeout(r, 10)) })
    process.off("unhandledRejection", unhandled)
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain("Keine Verbindung")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(unhandled).not.toHaveBeenCalled()
    expect(loeschen.disabled).toBe(false)
  })
})
