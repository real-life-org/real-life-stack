// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life/data-interface"
import { MockConnector } from "@real-life/mock-connector"

import * as toolkit from "../src/index"

/**
 * real-life-stack#564: Eine Karte, die aus einer Zelle eines Bretts angelegt
 * wird, soll „Teil von" schon im Formular zeigen, nicht erst beim Speichern.
 * Der Datenschlüssel der Item-Kante kommt dafür aus dem Paket.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const PROJECT: Item = { id: "p1", type: "project", createdBy: ME, createdAt: "2026-09-20T10:00:00.000Z", data: { title: "Gartenprojekt" } }

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

async function settle() {
  for (let round = 0; round < 5; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

async function render(node: ReactNode) {
  const connector = new MockConnector(
    {
      items: [PROJECT],
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: ME, displayName: "Ich" }],
      groupMembers: { g: [ME] },
      groupItems: { g: [PROJECT.id] },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("g")
  await act(async () => {
    root.render(createElement(toolkit.ConnectorProvider, { connector: connector as never }, node))
  })
  await settle()
}

describe("prefilling an item edge on create", () => {
  it("itemRelationDataKey comes from the package and names the composer key of an edge", () => {
    expect(toolkit.itemRelationDataKey("partOf")).toBe("relation:partOf")
    expect(toolkit.itemRelationDataKey("blocks", true)).toBe("relation:in:blocks")
  })

  it("a prefilled edge is visible in the form before saving", async () => {
    // Wie im Erstellen-Host: das Formular kennt seinen Space.
    const config = { ...toolkit.contentTypeFromRegister("task"), groupOptions: [{ id: "g", name: "Garten" }], defaultGroup: "g" }
    await render(createElement(toolkit.ContentComposer, {
      contentTypes: [config],
      initialContentType: "task",
      initialData: { title: "Beet umgraben", group: "g", [toolkit.itemRelationDataKey("partOf")]: ["item:p1"] },
      onSubmit: () => {},
    } as never))
    const field = host.querySelector('[data-item-relation-field="partOf"]')
    expect(field).toBeTruthy()
    expect(field?.querySelector('[data-relation-chip="p1"]')?.textContent).toContain("Gartenprojekt")
  })
})
