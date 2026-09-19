// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { createObservable, type Item } from "@real-life-stack/data-interface"
import { ConnectorProvider } from "../src/hooks/connector-context"
import { useItemPermissions } from "../src/hooks/use-item-permissions"

const item: Item = { id: "i1", type: "post", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "mira", data: {} }

// A connector that only reads: the six DataInterface methods, no sign-in, no
// writes. Such a connector shows items; it must not make the permission check
// throw ("Connector does not support authentication").
function readerConnector() {
  const items = createObservable<Item[]>([item])
  return {
    init: async () => {}, dispose: async () => {},
    getItems: async () => items.current, getItem: async () => item,
    observe: () => items, observeItem: () => createObservable<Item | null>(item),
  }
}

function Probe() {
  const perms = useItemPermissions(item)
  return <output data-edit={String(perms.canEdit)} data-delete={String(perms.canDelete)} />
}

describe("useItemPermissions on a read-only connector", () => {
  it("grants nothing and does not throw without authentication", async () => {
    const host = document.createElement("div"); const root = createRoot(host); document.body.append(host)
    await act(async () => root.render(createElement(ConnectorProvider, { connector: readerConnector() as never }, createElement(Probe))))
    expect(host.querySelector("output")?.dataset).toMatchObject({ edit: "false", delete: "false" })
    root.unmount(); host.remove()
  })
})
