// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { ItemDetailRead } from "../src/components/host/detail-host"

/**
 * real-life-stack#562: `ItemDetailRead` fand den Autor nur unter den
 * Mitgliedern und dem eigenen Nutzer. Ein Autor, der kein Mitglied ist (im
 * Karabirrdt der „Tisch"), stand als „Erstellt von did:…" da. Jetzt fragt die
 * Leseansicht den Connector (`getUser`) und sagt sonst „Unbekannt".
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "did:key:z6MkMe"
const TISCH = "did:key:z6MkTisch"
const FREMD = "did:key:z6MkNiemandKenntMich"

const note = (id: string, createdBy: string): Item => ({
  id, type: "note", createdBy, createdAt: "2026-09-20T10:00:00.000Z", data: { title: `Notiz ${id}` },
})

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

async function render(item: Item) {
  const connector = new MockConnector(
    {
      items: [item],
      groups: [{ id: "g", name: "Brett", data: {} }],
      // Der Tisch ist dem Connector bekannt, aber kein Mitglied des Space.
      users: [{ id: ME, displayName: "Ich" }, { id: TISCH, displayName: "Tisch" }],
      groupMembers: { g: [ME] },
      groupItems: { g: [item.id] },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup("g")
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(ItemDetailRead, { item, actions: null, groupId: "g" })))
  })
  await settle()
}

describe("ItemDetailRead author fallback", () => {
  it("resolves an author who is not a member through connector.getUser", async () => {
    await render(note("n1", TISCH))
    expect(host.textContent).toContain("Erstellt von Tisch")
    expect(host.textContent).not.toContain(TISCH)
  })

  it("says Unbekannt instead of the DID when nobody knows the author", async () => {
    await render(note("n2", FREMD))
    expect(host.textContent).toContain("Erstellt von Unbekannt")
    expect(host.textContent).not.toContain(FREMD)
  })

  it("still prefers the member entry", async () => {
    await render(note("n3", ME))
    expect(host.textContent).toContain("Erstellt von Ich")
  })
})
