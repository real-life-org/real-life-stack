// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life/data-interface"
import { MockConnector } from "@real-life/mock-connector"
import { ConnectorProvider } from "../src/hooks/connector-context"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("../src/components/host/create-host", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/host/create-host")>()),
  useOptionalCreate: () => ({ isComposing: false, startCreate: () => {}, patchCreate: () => {} }),
}))

const { ItemDetailView } = await import("../src/components/detail/item-detail-view")
const { itemToComposerData, mapComposerSubmission, pickContentTypes } = await import("../src/components/composer/content-types")

/**
 * Review #645: `ItemDetailView` rendert erst ohne Item (es lädt noch), dann mit. Ein Hook hinter dem
 * Lade-Rücksprung änderte dabei die Hook-Reihenfolge („Rendered more hooks“). Derselbe Baum, erst
 * ohne, dann mit Item — er darf nicht abstürzen.
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

const view = (mode: "read" | "edit", itemId = task.id) =>
  createElement(ItemDetailView, {
    itemId,
    mode,
    onModeChange: () => {},
    contentTypes: pickContentTypes("task"),
    mapper: mapComposerSubmission,
    editInitialData: itemToComposerData,
    onClose: () => {},
    renderRead: () => createElement("div", null, "LESEANSICHT"),
  })

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
})

describe("ItemDetailView: erst ohne, dann mit Item", () => {
  it.each(["read", "edit"] as const)("stürzt im Modus %s nicht ab, wenn das Item nachkommt", async (mode) => {
    const errors: unknown[] = []
    const onError = (event: ErrorEvent) => { errors.push(event.error); event.preventDefault() }
    window.addEventListener("error", onError)
    const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => { errors.push(args[0]) })
    try {
      await render(view(mode, "gibt-es-nicht"))
      await render(view(mode))
    } finally {
      window.removeEventListener("error", onError)
      spy.mockRestore()
    }
    expect(errors.map(String).filter((e) => /more hooks|fewer hooks|order of Hooks/i.test(e))).toEqual([])
    expect(host.textContent ?? "").not.toBe("")
  })
})
