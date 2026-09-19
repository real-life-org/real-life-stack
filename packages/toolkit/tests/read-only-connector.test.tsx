// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { describe, expect, it } from "vitest"
import { createObservable, type Item } from "@real-life-stack/data-interface"
import { ConnectorProvider } from "../src/hooks/connector-context"
import { useGroups, useCurrentGroup, useMembers, useCreateGroup } from "../src/hooks/use-groups"
import { useAuthState, useOptionalCurrentUser } from "../src/hooks/use-auth"
import { useItemPermissions } from "../src/hooks/use-item-permissions"

/**
 * Ein Connector, der nur liest: die sechs Pflichtmethoden von DataInterface,
 * keine Gruppen, keine Anmeldung, keine Schreibrechte. So einer ist erlaubt
 * (das Handbuch-Beispiel baut genau ihn), und alles Lesende muss mit ihm
 * laufen. Bis 19.09.2026 warfen useGroups, useMembers, useCurrentGroup und
 * useAuthState stattdessen eine Ausnahme und rissen die Seite mit.
 */
const item: Item = { id: "i1", type: "post", createdAt: "2026-01-01T00:00:00.000Z", createdBy: "mira", data: {} }
function readerConnector() {
  const items = createObservable<Item[]>([item])
  return {
    init: async () => {}, dispose: async () => {},
    getItems: async () => items.current, getItem: async () => item,
    observe: () => items, observeItem: () => createObservable<Item | null>(item),
  }
}

function mount(node: ReactNode) {
  const host = document.createElement("div")
  const root = createRoot(host)
  document.body.append(host)
  return { host, root, cleanup: () => { root.unmount(); host.remove() } }
}

async function render(Probe: () => ReactNode) {
  const m = mount(null)
  await act(async () =>
    m.root.render(createElement(ConnectorProvider, { connector: readerConnector() as never }, createElement(Probe))),
  )
  const data = { ...m.host.querySelector("output")?.dataset }
  m.cleanup()
  return data
}

describe("Nur-Lese-Connector", () => {
  it("meldet keine Gruppen, statt zu werfen", async () => {
    const data = await render(() => {
      const groups = useGroups()
      const current = useCurrentGroup()
      return <output data-n={String(groups.data.length)} data-loading={String(groups.isLoading)} data-current={String(current)} />
    })
    expect(data).toMatchObject({ n: "0", loading: "false", current: "null" })
  })

  it("meldet keine Mitglieder, statt zu werfen", async () => {
    const data = await render(() => {
      const { data: members, isLoading } = useMembers(null)
      return <output data-n={String(members.length)} data-loading={String(isLoading)} />
    })
    expect(data).toMatchObject({ n: "0", loading: "false" })
  })

  it("meldet niemanden angemeldet, statt zu werfen", async () => {
    const data = await render(() => {
      const state = useAuthState()
      const { data: user } = useOptionalCurrentUser()
      return <output data-status={state.status} data-user={String(user)} />
    })
    expect(data).toMatchObject({ status: "unauthenticated", user: "null" })
  })

  it("gewährt keine Rechte am Item, statt zu werfen", async () => {
    const data = await render(() => {
      const perms = useItemPermissions(item)
      return <output data-edit={String(perms.canEdit)} data-delete={String(perms.canDelete)} />
    })
    expect(data).toMatchObject({ edit: "false", delete: "false" })
  })

  it("lässt eine Schreib-Aktion vorbereiten und erst beim Aufruf scheitern", async () => {
    // Der Knopf darf gebaut werden; erst das Drücken ist der Fehler. Vorher warf
    // schon das Vorbereiten und nahm die ganze Fläche mit.
    let create: ReturnType<typeof useCreateGroup> | undefined
    const data = await render(() => {
      create = useCreateGroup()
      return <output data-ready={String(typeof create === "function")} />
    })
    expect(data).toMatchObject({ ready: "true" })
    await expect(async () => create?.("Neu")).rejects.toThrow("does not support groups")
  })
})

describe("Schreiben vorbereiten", () => {
  it("baut die Mutation, ohne dass der Nur-Lese-Connector die Fläche mitreißt", async () => {
    // Eine Fläche darf ihren Knopf bauen; erst das Drücken ist der Fehler.
    // Vorher warf schon useCreateItem im Render und nahm alles mit.
    const { useCreateItem, useUpdateItem, useDeleteItem } = await import("../src/hooks/use-mutations")
    let create: ((i: never) => Promise<unknown>) | undefined
    const data = await render(() => {
      const c = useCreateItem()
      const u = useUpdateItem()
      const d = useDeleteItem()
      create = c.mutate as never
      return <output data-ready={String([c, u, d].every((m) => typeof m.mutate === "function"))} />
    })
    expect(data).toMatchObject({ ready: "true" })
    await expect(async () => create?.({} as never)).rejects.toThrow("does not support writing")
  })
})

/**
 * Der Connector kann während der Laufzeit wechseln — beim Abmelden, beim
 * Wechsel der Quelle. Hooks, die ihre Antwort in einem State halten, müssen
 * dann zurücksetzen: Ein Connector ohne die Fähigkeit hat eine leere Antwort,
 * nicht die alte des Vorgängers.
 */
function authConnector() {
  const items = createObservable<Item[]>([item])
  const user = createObservable<{ id: string; name: string } | null>({ id: "mira", name: "Mira" })
  const comment: Item = { ...item, id: "c1", type: "comment", data: { text: "Hallo" } }
  const related = createObservable<Item[]>([comment])
  return {
    init: async () => {}, dispose: async () => {},
    getItems: async () => items.current, getItem: async () => item,
    observe: () => items, observeItem: () => createObservable<Item | null>(item),
    authenticate: async () => {}, signOut: async () => {},
    getAuthState: () => createObservable({ status: "authenticated" as const }),
    observeCurrentUser: () => user,
    observeRelatedItems: () => related,
    getRelatedItems: async () => related.current,
  }
}

async function renderSwap(Probe: () => ReactNode) {
  const m = mount(null)
  const wrap = (connector: unknown) =>
    createElement(ConnectorProvider, { connector: connector as never }, createElement(Probe))
  await act(async () => m.root.render(wrap(authConnector())))
  const vorher = { ...m.host.querySelector("output")?.dataset }
  await act(async () => m.root.render(wrap(readerConnector())))
  const nachher = { ...m.host.querySelector("output")?.dataset }
  m.cleanup()
  return { vorher, nachher }
}

describe("Wechsel auf einen Connector ohne die Fähigkeit", () => {
  it("vergisst den angemeldeten Menschen", async () => {
    const { vorher, nachher } = await renderSwap(() => {
      const { data: user, isLoading } = useOptionalCurrentUser()
      return <output data-user={String(user?.name ?? null)} data-loading={String(isLoading)} />
    })
    expect(vorher).toMatchObject({ user: "Mira" })
    expect(nachher).toMatchObject({ user: "null", loading: "false" })
  })

  it("vergisst die verknüpften Items", async () => {
    const { useRelatedItems } = await import("../src/hooks/use-related-items")
    const { vorher, nachher } = await renderSwap(() => {
      const { data } = useRelatedItems("i1")
      return <output data-n={String(data.length)} />
    })
    expect(vorher).toMatchObject({ n: "1" })
    expect(nachher).toMatchObject({ n: "0" })
  })

  it("vergisst die Kommentare", async () => {
    const { useComments } = await import("../src/hooks/use-comments")
    const { vorher, nachher } = await renderSwap(() => {
      const { comments } = useComments("i1")
      return <output data-n={String(comments.length)} />
    })
    expect(vorher).toMatchObject({ n: "1" })
    expect(nachher).toMatchObject({ n: "0" })
  })

  it("vergisst den Anmeldezustand", async () => {
    const { vorher, nachher } = await renderSwap(() => {
      const state = useAuthState()
      return <output data-status={state.status} />
    })
    expect(vorher).toMatchObject({ status: "authenticated" })
    expect(nachher).toMatchObject({ status: "unauthenticated" })
  })
})
