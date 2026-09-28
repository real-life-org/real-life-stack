// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"
import { ConnectorProvider } from "../src/hooks/connector-context"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("../src/components/host/create-host", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/host/create-host")>()),
  useOptionalCreate: () => ({ isComposing: false, startCreate: () => {}, patchCreate: () => {} }),
}))

const { ItemDetailView } = await import("../src/components/detail/item-detail-view")
const { itemToComposerData, mapComposerSubmission, pickContentTypes } = await import("../src/components/composer/content-types")
const { ItemComposer } = await import("../src/components/composer/item-composer")

/**
 * shared-components → Edit-Regeln 1 und 4: Bearbeiten tauscht die Slots
 * `meta` bis `comments` gegen die Schreibformen. Kommentarliste und
 * Kommentar-Eingabe verschwinden; unten klebt die Fußzeile Löschen ·
 * Abbrechen · Speichern.
 */

const ME = "u-me"
const OTHER = "u-other"
const task: Item = { id: "t1", type: "task", createdBy: ME, createdAt: "2026-09-26T10:00:00.000Z", data: { title: "Beete gießen", status: "open" } }
const comment: Item = {
  id: "c1", type: "comment", createdBy: OTHER, createdAt: "2026-09-26T11:00:00.000Z",
  data: { content: "KOMMENTAR-TEXT" }, relations: [{ predicate: "commentOn", target: "item:t1" }],
}

let host: HTMLDivElement
let root: Root

async function render(node: ReactNode) {
  const connector = new MockConnector(
    {
      items: [task, comment],
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: ME, displayName: "Ich" }, { id: OTHER, displayName: "Andere" }],
      groupMembers: { g: [ME, OTHER] },
      groupItems: { g: [task.id, comment.id] },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("g")
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, node))
  })
  for (let round = 0; round < 4; round++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
  }
}

const view = (mode: "read" | "edit") =>
  createElement(ItemDetailView, {
    itemId: task.id,
    mode,
    onModeChange: () => {},
    contentTypes: pickContentTypes("task"),
    mapper: mapComposerSubmission,
    editInitialData: itemToComposerData,
    onClose: () => {},
    renderRead: () => createElement("div", null, "LESEANSICHT"),
  })

const commentInput = () => host.querySelector('textarea[placeholder="Kommentar schreiben..."]')
const buttons = () => [...host.querySelectorAll("button")].map((b) => b.textContent?.trim())

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
})

describe("Detail im Bearbeiten-Modus", () => {
  it("Lesemodus: Kommentare und Kommentar-Eingabe bleiben", async () => {
    await render(view("read"))
    expect(host.textContent).toContain("LESEANSICHT")
    expect(host.textContent).toContain("KOMMENTAR-TEXT")
    expect(commentInput()).not.toBeNull()
  })

  it("Bearbeiten: keine Kommentarliste, keine Kommentar-Eingabe", async () => {
    await render(view("edit"))
    expect(host.textContent).not.toContain("KOMMENTAR-TEXT")
    expect(commentInput()).toBeNull()
  })

  it("Bearbeiten: klebende Fußzeile mit Löschen links, Abbrechen und Speichern rechts", async () => {
    await render(view("edit"))
    const footer = host.querySelector('[data-slot="edit-footer"]')
    expect(footer).not.toBeNull()
    expect(footer!.className).toContain("sticky")
    expect(footer!.className).toContain("bottom-0")
    // Ohne Beschriftung bleibt nur der Pfeil des Speichern-Split-Knopfs (Sichtbarkeit).
    const labels = [...footer!.querySelectorAll("button")].map((b) => b.textContent?.trim()).filter(Boolean)
    expect(labels).toEqual(["Löschen", "Abbrechen", "Speichern"])
    expect(buttons().filter((b) => b === "Speichern")).toHaveLength(1)
  })

  it("Löschen steht hinter einer Bestätigung", async () => {
    await render(view("edit"))
    const loeschen = [...host.querySelectorAll('[data-slot="edit-footer"] button')].find((b) => b.textContent?.trim() === "Löschen")!
    await act(async () => { (loeschen as HTMLButtonElement).click() })
    expect(document.body.textContent).toMatch(/löschen\?/i)
  })
})

describe("Erstellen und Bearbeiten: dieselbe Fußzeile", () => {
  it("Erstellen: die Fußzeile klebt unten wie beim Bearbeiten, das Layout legt ItemComposer fest", async () => {
    await render(createElement(ItemComposer, {
      contentTypes: pickContentTypes("task"),
      mapper: mapComposerSubmission,
      onDone: () => {},
      onCancel: () => {},
    }))
    const footer = host.querySelector('[data-slot="edit-footer"]')
    expect(footer).not.toBeNull()
    expect(footer!.className).toContain("sticky")
    expect(footer!.className).toContain("bottom-0")
    // Das Formular füllt die Karte, damit die Fußzeile an ihrem Ende klebt.
    expect(host.querySelector(".min-h-full")?.contains(footer)).toBe(true)
  })
})
