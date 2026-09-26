// @vitest-environment jsdom
import { act, createElement, isValidElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"
import { ConnectorProvider } from "../src/hooks/connector-context"

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const startCreate = vi.fn()
vi.mock("../src/components/host/create-host", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/host/create-host")>()),
  useOptionalCreate: () => ({ isComposing: false, startCreate, patchCreate: () => {} }),
}))

const { StatementDetail, StatementVariantLine } = await import("../src/components/resonance/statement-variants")
const { ItemDetailView } = await import("../src/components/detail/item-detail-view")
const { itemToComposerData, mapComposerSubmission, pickContentTypes } = await import("../src/components/composer/content-types")

/**
 * Varianten im Resonanzmodul (docs/spec/modules/resonance.md → Varianten,
 * Wortlaut rule 3) auf den echten Flächen, gegen den MockConnector.
 */

const ME = "u-me"
const OTHER = "u-other"

const statement = (id: string, createdBy: string, minute: number, data: Record<string, unknown>): Item => ({
  id, type: "statement", createdBy, createdAt: `2026-09-26T10:0${minute}:00.000Z`, data,
})

const origin = statement("s-a", ME, 0, { title: "Wir treffen uns montags", description: "Im Garten" })
const variantB = statement("s-b", OTHER, 1, { title: "Wir treffen uns dienstags", variantOf: "item:s-a" })
const variantC = statement("s-c", OTHER, 2, { title: "Wir treffen uns alle zwei Wochen", variantOf: "item:s-a" })
const orphan = statement("s-o", OTHER, 3, { title: "Verwaist", variantOf: "item:weg" })

const foreignVote: Item = {
  id: "vote-other", type: "relation", createdBy: OTHER, createdAt: "2026-09-26T11:00:00.000Z",
  data: { predicate: "votesOn", value: "green", contentHash: "sha256:00" },
  relations: [{ predicate: "from", target: `global:${OTHER}` }, { predicate: "to", target: "item:s-a" }],
}

let host: HTMLDivElement
let root: Root

async function render(node: ReactNode, extra: Item[] = []) {
  const connector = new MockConnector(
    {
      items: [origin, variantB, variantC, orphan, ...extra],
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: ME, displayName: "Ich" }, { id: OTHER, displayName: "Andere" }],
      groupMembers: { g: [ME, OTHER] },
      groupItems: { g: [origin, variantB, variantC, orphan, ...extra].map((item) => item.id) },
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
  return host.textContent ?? ""
}

beforeEach(() => {
  startCreate.mockClear()
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  host.remove()
})

describe("StatementVariantLine (card)", () => {
  it("names the statement a variant belongs to", async () => {
    const text = await render(createElement(StatementVariantLine, { item: variantB }))
    expect(text).toContain("Variante von „Wir treffen uns montags“")
  })

  it("counts the variants of an origin", async () => {
    expect(await render(createElement(StatementVariantLine, { item: origin }))).toContain("2 Varianten")
  })

  it("tolerates a missing target", async () => {
    expect(await render(createElement(StatementVariantLine, { item: orphan }))).toContain("Variante einer nicht verfügbaren Aussage")
  })
})

describe("StatementDetail (panel)", () => {
  it("shows the family: origin and all variants, the current version marked", async () => {
    const text = await render(createElement(StatementDetail, { item: variantB }))
    expect(text).toContain("Fassungen")
    expect(text).toContain("Wir treffen uns montags")
    expect(text).toContain("Wir treffen uns dienstags")
    expect(text).toContain("Wir treffen uns alle zwei Wochen")
    expect(text).toContain("diese Fassung")
    expect(text).not.toContain("Verwaist")
  })

  it("„Variante anlegen“ opens the composer prefilled with the wording and variantOf", async () => {
    await render(createElement(StatementDetail, { item: origin }))
    const button = [...host.querySelectorAll("button")].find((el) => el.textContent?.includes("Variante anlegen"))
    expect(button).toBeDefined()
    await act(async () => { button!.click() })
    expect(startCreate).toHaveBeenCalledWith("statement", {
      title: "Wir treffen uns montags",
      text: "Im Garten",
      variantOf: "item:s-a",
    })
  })

  it("tells the author why the wording is frozen once someone else voted on it", async () => {
    const unfrozen = await render(createElement(StatementDetail, { item: origin }))
    expect(unfrozen).not.toContain("lässt er sich nicht mehr ändern")
    await act(async () => { root.unmount() })
    root = createRoot(host)
    const frozen = await render(createElement(StatementDetail, { item: origin }), [foreignVote])
    expect(frozen).toContain("lässt er sich nicht mehr ändern")
  })
})

describe("ItemDetailView: no „Bearbeiten“ on a frozen wording (Wortlaut rule 3)", () => {
  async function offersEdit(extra: Item[]) {
    let onEdit: unknown = "not rendered"
    await render(createElement(ItemDetailView, {
      itemId: origin.id,
      contentTypes: pickContentTypes("statement"),
      mapper: mapComposerSubmission,
      editInitialData: itemToComposerData,
      onClose: () => {},
      renderRead: (_item: Item, actions: ReactNode) => {
        onEdit = isValidElement(actions) ? (actions.props as { onEdit?: unknown }).onEdit : undefined
        return null
      },
    }), extra)
    return typeof onEdit === "function"
  }

  it("the author may edit before anyone else voted", async () => {
    expect(await offersEdit([])).toBe(true)
  })

  it("not once another person bound a vote to the wording", async () => {
    expect(await offersEdit([foreignVote])).toBe(false)
  })
})

describe("creating a variant through the composer mapping", () => {
  it("keeps variantOf in the new statement's data; an edit keeps it untouched", () => {
    const created = mapComposerSubmission(
      { contentType: "statement", data: { title: "Wir treffen uns dienstags", text: "", variantOf: "item:s-a" } } as never,
      { mode: "create", existingItem: null },
    )
    expect((created as { data: Record<string, unknown> }).data).toMatchObject({ title: "Wir treffen uns dienstags", variantOf: "item:s-a" })

    const edited = mapComposerSubmission(
      { contentType: "statement", data: { title: "Wir treffen uns mittwochs", text: "" } } as never,
      { mode: "edit", existingItem: variantB },
    )
    expect((edited as { data: Record<string, unknown> }).data.variantOf).toBe("item:s-a")
  })
})
