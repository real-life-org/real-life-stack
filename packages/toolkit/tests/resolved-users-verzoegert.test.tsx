// @vitest-environment jsdom
import { act, createElement, StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { User } from "@real-life/data-interface"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { useResolvedUsers } from "../src/hooks/use-resolved-users"

/**
 * Codex-Review Runde 1 zu #569: Wechselte die angefragte Id A → B → A, bevor
 * `getUser(A)` antwortete, blieb A als „laufend" markiert, der alte Effect
 * verwarf die Antwort, und niemand fragte neu. Der Name kam nie an.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function langsamerConnector(praefix = "Name") {
  const offen = new Map<string, Array<(u: User | null) => void>>()
  const connector = {
    getAuthState: () => ({ current: { status: "authenticated" }, subscribe: () => () => {} }),
    getAuthMethods: () => [],
    authenticate: async () => {},
    logout: async () => {},
    getCurrentUser: async () => null,
    observeCurrentUser: () => ({ current: null, subscribe: () => () => {} }),
    getUser: (id: string) => new Promise<User | null>((resolve) => {
      offen.set(id, [...(offen.get(id) ?? []), resolve])
    }),
  }
  /** `alteZuletzt`: die älteste Anfrage antwortet als letzte. */
  const antworte = async (id: string, alteZuletzt = false) => {
    const warten = offen.get(id) ?? []
    offen.delete(id)
    await act(async () => {
      // Die n-te Anfrage derselben Id bekommt „(n)" angehängt — so ist sichtbar, welche zählt.
      const antworten = warten.map((resolve, i) => () => resolve({ id, displayName: `${praefix} ${id}${i > 0 ? ` (${i + 1})` : ""}` } as User))
      for (const a of alteZuletzt ? antworten.reverse() : antworten) a()
      await Promise.resolve()
    })
  }
  const angefragt = () => [...offen.keys()]
  return { connector, antworte, angefragt }
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function Anzeige({ id }: { id: string }) {
  const ids = useIds(id)
  const users = useResolvedUsers(ids)
  return createElement("span", null, users.get(id)?.displayName ?? "?")
}
const cache = new Map<string, string[]>()
function useIds(id: string): string[] {
  if (!cache.has(id)) cache.set(id, [id])
  return cache.get(id)!
}

describe("useResolvedUsers with delayed answers", () => {
  it("keeps the answer for A after switching A → B → A before it arrived", async () => {
    const { connector, antworte } = langsamerConnector()
    const zeige = (id: string) =>
      act(() => root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Anzeige, { id }))))
    zeige("A")
    zeige("B")
    zeige("A")
    await antworte("A")
    expect(host.textContent).toBe("Name A")
  })

  it("resolves under StrictMode", async () => {
    const { connector, antworte } = langsamerConnector()
    act(() =>
      root.render(createElement(StrictMode, null,
        createElement(ConnectorProvider, { connector: connector as never }, createElement(Anzeige, { id: "A" })))),
    )
    await antworte("A")
    expect(host.textContent).toBe("Name A")
  })

  // Codex-Review Runde 2: Ergebnisse und Anfragen gehören genau einem Connector.
  const mit = (connector: unknown, id = "A") =>
    act(() => root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Anzeige, { id }))))

  it("forgets names of the previous connector and asks the new one", async () => {
    const eins = langsamerConnector("Eins")
    const zwei = langsamerConnector("Zwei")
    mit(eins.connector)
    await eins.antworte("A")
    expect(host.textContent).toBe("Eins A")
    mit(zwei.connector)
    expect(host.textContent).toBe("?")
    expect(zwei.angefragt()).toEqual(["A"])
    await zwei.antworte("A")
    expect(host.textContent).toBe("Zwei A")
  })

  it("ignores a late answer after switching to a connector without auth", async () => {
    const eins = langsamerConnector("Eins")
    mit(eins.connector)
    mit({ getItems: async () => [] })
    await eins.antworte("A")
    expect(host.textContent).toBe("?")
  })

  it("ignores a late answer from an earlier phase of the same connector", async () => {
    const eins = langsamerConnector("Eins")
    const zwei = langsamerConnector("Zwei")
    mit(eins.connector)
    mit(zwei.connector)
    mit(eins.connector)
    // Zwei Anfragen an eins: die der ersten Phase zählt nicht mehr, die neue schon.
    await eins.antworte("A", true)
    expect(host.textContent).toBe("Eins A (2)")
  })
})
