// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life/data-interface"
import { MockConnector } from "@real-life/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { ItemDetailRead } from "../src/components/host/detail-host"
import { setLanguage } from "../src/i18n"
import { resetI18nForTests } from "../src/testing"

/**
 * Die Detailansicht folgt einem Sprachwechsel, ohne neu geöffnet zu werden: Ihre Slots kommen aus
 * dem Typ-Register, dessen Texte aus dem Wörterbuch der Sprache stammen (Spec 06, „Texte und Sprache“;
 * CodeRabbit zu #644).
 */
;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "did:key:z6MkMe"
const task: Item = { id: "t1", type: "task", createdBy: ME, createdAt: "2026-09-20T10:00:00.000Z", data: { title: "Beete gießen", status: "open", start: "2026-09-21T10:00:00.000Z" } }

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
  resetI18nForTests()
})

async function settle() {
  for (let round = 0; round < 5; round++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
}

describe("ItemDetailRead bei Sprachwechsel", () => {
  it("zeigt Status und Selbstaktion der Aufgabe nach dem Wechsel in der neuen Sprache", async () => {
    setLanguage("de", { persist: false })
    const connector = new MockConnector(
      { items: [task], groups: [{ id: "g", name: "Garten", data: {} }], users: [{ id: ME, displayName: "Ich" }], groupMembers: { g: [ME] }, groupItems: { g: [task.id] } } as never,
      { allowFixtureAuthors: true },
    )
    await connector.init()
    connector.setCurrentGroup("g")
    await act(async () => {
      root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(ItemDetailRead, { item: task, actions: null, groupId: "g" })))
    })
    await settle()
    expect(host.textContent).toContain("To Do")
    expect(host.textContent).toContain("Übernehmen")

    await act(async () => { setLanguage("en", { persist: false }) })
    await settle()
    expect(host.textContent).toContain("To do")
    expect(host.textContent).toContain("Take on")
    expect(host.textContent).not.toContain("Übernehmen")
  })
})
