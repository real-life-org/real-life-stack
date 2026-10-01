// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { useItem } from "../src/hooks/use-items"
import { relationHost } from "./support/form-host"
import { resolveTypePresentation } from "../src/components/preview/type-presentation"

/**
 * Loop-Review zu PR #528 (99a255aa): #529 Suche im Formular-Space, #530
 * Modul-Pick prüfen, #531 Folgeaktionen gegen den geltenden Zustand.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const item = (id: string, type: string, data: Record<string, unknown>, relations: Item["relations"] = []): Item => ({
  id, type, createdBy: ME, createdAt: "2026-09-20T10:00:00.000Z", data, relations,
})
const IN_G = item("t-g", "task", { title: "Im Garten", status: "open" })
const IN_H = item("t-h", "task", { title: "Im Hof", status: "open" })
const POST_G = item("x-post", "post", { content: "Ein Beitrag" })

let host: HTMLDivElement
let root: Root
let connector: MockConnector

async function settle() {
  for (let round = 0; round < 5; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

async function render(node: ReactNode, items: Item[], groupItems: Record<string, string[]>, current: string | null) {
  connector = new MockConnector(
    {
      items,
      groups: [{ id: "g", name: "Garten", data: {} }, { id: "h", name: "Hof", data: {} }],
      users: [{ id: ME, displayName: "Ich" }],
      groupMembers: { g: [ME], h: [ME] },
      groupItems,
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup(current)
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, node))
  })
  await settle()
}

async function type(text: string) {
  const input = host.querySelector<HTMLInputElement>("[data-item-relation-field] input")!
  await act(async () => {
    input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await settle()
  return [...host.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim())
}

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

const GROUPS = { g: ["t-g", "x-post"], h: ["t-h"] }

describe("#529: die Suche folgt dem Space im Formularkopf", () => {
  it("in der Übersicht (kein App-Space) findet die Suche die Aufgaben des Formular-Space", async () => {
    await render(relationHost({ label: "Ermöglicht", predicate: "blocks", targetType: "task", value: [], spaceId: "h" }), [IN_G, IN_H, POST_G], GROUPS, null)
    expect(await type("")).toEqual(["Im Hof"])
  })

  // S3b A: Mit GroupScopeCapable sucht das Feld im Formular-Space, auch wenn
  // ein anderer geöffnet ist. Den Hinweis ohne die Zusage prüft
  // space-des-formulars.test.tsx.
  it("ist der Formular-Space nicht der geöffnete, sucht das Feld trotzdem dort (02 → group)", async () => {
    await render(relationHost({ label: "Ermöglicht", predicate: "blocks", targetType: "task", value: [], spaceId: "h" }), [IN_G, IN_H, POST_G], GROUPS, "g")
    expect(host.querySelector("[data-other-space]")).toBeNull()
    expect(await type("")).toEqual(["Im Hof"])
  })

  it("im geöffneten Space findet sie dessen Aufgaben", async () => {
    await render(relationHost({ label: "Ermöglicht", predicate: "blocks", targetType: "task", value: [], spaceId: "g" }), [IN_G, IN_H, POST_G], GROUPS, "g")
    expect(await type("")).toEqual(["Im Garten"])
  })
})

describe("#530: der Modul-Pick prüft wie die Suche und meldet Ablehnungen", () => {
  function Harness({ onResult, excludeId, initial = [] }: { onResult: (r: unknown) => void; excludeId?: string; initial?: string[] }) {
    return createElement("div", null,
      relationHost({
        label: "Ermöglicht", predicate: "blocks", targetType: "task", value: initial, output: true, spaceId: "g", excludeId,
        requestItemPick: (_req: unknown, onPick: (id: string) => unknown) => { (globalThis as { __pick?: typeof onPick }).__pick = onPick },
      }),
    )
    void onResult
  }
  const pick = async (id: string) => {
    let result: unknown
    await act(async () => { result = (globalThis as { __pick?: (id: string) => unknown }).__pick!(id) })
    await settle()
    return result
  }
  const openPicker = async () => {
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Im Modul wählen"))!.click())
  }

  it("übernimmt ein gültiges Ziel", async () => {
    await render(createElement(Harness, { onResult: () => {} }), [IN_G, IN_H, POST_G], GROUPS, "g")
    await openPicker()
    expect(await pick("t-g")).toEqual({ ok: true })
    expect(host.querySelector("#value")?.textContent).toBe("item:t-g")
  })

  it("weist falschen Typ, anderen Space, das Item selbst und Doppelte ab — mit Grund, sichtbar", async () => {
    await render(createElement(Harness, { onResult: () => {}, excludeId: "t-self", initial: ["item:t-g"] }), [IN_G, IN_H, POST_G, item("t-self", "task", { title: "Selbst" })], { g: ["t-g", "x-post", "t-self"], h: ["t-h"] }, null)
    await openPicker()
    for (const id of ["x-post", "t-h", "t-self", "t-g", "gibt-es-nicht"]) {
      const result = (await pick(id)) as { ok: boolean; reason?: string }
      expect(result.ok, id).toBe(false)
      expect(result.reason, id).toBeTruthy()
    }
    expect(host.querySelector("#value")?.textContent).toBe("item:t-g")
    // Abgelehnt mit Grund, sichtbar am Feld (Formularzustand, Regel 10).
    expect(host.querySelector("[data-item-relation-field] [data-field-notice]")?.textContent).toContain("Verknüpfung nicht übernommen:")
  })
})

describe("#531: Folgeaktionen prüfen beim Auslösen den geltenden Zustand", () => {
  function Live({ id }: { id: string }): ReactNode {
    const { data } = useItem(id)
    if (!data) return null
    const Actions = resolveTypePresentation("task").actions!
    return createElement(Actions, { item: data })
  }
  const pill = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)

  it("„Erledigt“ schreibt nicht, wenn meine Zuweisung inzwischen entfernt wurde", async () => {
    const t = item("t1", "task", { title: "T", status: "open" }, [{ predicate: "assignedTo", target: `global:${ME}` }])
    await render(createElement(Live, { id: "t1" }), [t], { g: ["t1"] }, "g")
    const erledigt = pill("Erledigt")!
    // Ein anderer Editor nimmt mich heraus, bevor die Aktion das Item liest.
    const original = connector.getItem.bind(connector)
    vi.spyOn(connector, "getItem").mockImplementationOnce(async (id: string) => {
      await connector.updateItem("t1", { relations: [] })
      return original(id)
    })
    await act(async () => erledigt.click())
    await settle()
    expect((await connector.getItem("t1"))?.data.status).toBe("open")
    expect(pill("Erledigt")).toBeUndefined()
    expect(pill("Übernehmen")).toBeTruthy()
  })

})

describe("Codex Runde 5", () => {
  it("#530: ein asynchroner Pick überschreibt keine zwischenzeitliche Auswahl", async () => {
    const other = item("t-g2", "task", { title: "Zweite im Garten", status: "open" })
    let onPick: ((id: string) => unknown) | undefined
    function Harness() {
      return createElement("div", null,
        relationHost({ label: "E", predicate: "blocks", targetType: "task", value: [], output: true, spaceId: "g", requestItemPick: (_r: unknown, cb: (id: string) => unknown) => { onPick = cb } }))
    }
    await render(createElement(Harness), [IN_G, other], { g: ["t-g", "t-g2"] }, "g")
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Im Modul wählen"))!.click())
    // Während der Picker offen ist, wählt die Person per Suche etwas anderes.
    const input = host.querySelector<HTMLInputElement>("[data-item-relation-field] input")!
    await act(async () => {
      input.focus()
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Zweite")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await settle()
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    await act(async () => { onPick!("t-g") })
    await settle()
    expect(host.querySelector("#value")?.textContent).toBe("item:t-g2,item:t-g")
  })

  function Live({ id }: { id: string }): ReactNode {
    const { data } = useItem(id)
    if (!data) return null
    const Actions = resolveTypePresentation("task").actions!
    return createElement(Actions, { item: data })
  }
  const pill = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)

  it("#531 (Umschalter): wird die Aufgabe beim Abgeben inzwischen erledigt, bleibt beides stehen (erledigt: keine Aktion, Anton zu #542)", async () => {
    const t = item("t1", "task", { title: "T", status: "open" }, [{ predicate: "assignedTo", target: `global:${ME}` }])
    await render(createElement(Live, { id: "t1" }), [t], { g: ["t1"] }, "g")
    const mine = pill("Übernommen")!
    const original = connector.getItem.bind(connector)
    vi.spyOn(connector, "getItem").mockImplementationOnce(async (id: string) => {
      await connector.updateItem("t1", { data: { title: "T", status: "done" } })
      return original(id)
    })
    await act(async () => mine.click())
    await settle()
    const saved = await connector.getItem("t1")
    expect(saved?.relations ?? []).toEqual([{ predicate: "assignedTo", target: `global:${ME}` }])
    expect(saved?.data.status).toBe("done")
  })
})

describe("Codex Runde 6", () => {
  function Live({ id }: { id: string }): ReactNode {
    const { data } = useItem(id)
    if (!data) return null
    const Actions = resolveTypePresentation("task").actions!
    return createElement(Actions, { item: data })
  }
  const pill = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)

  it("#531: Abgeben entfernt nichts, wenn meine Kante beim Lesen schon fehlt (kein Schreiben)", async () => {
    const t = item("t1", "task", { title: "T", status: "open" }, [{ predicate: "assignedTo", target: `global:${ME}` }])
    await render(createElement(Live, { id: "t1" }), [t], { g: ["t1"] }, "g")
    const original = connector.getItem.bind(connector)
    vi.spyOn(connector, "getItem").mockImplementationOnce(async (id: string) => {
      await connector.updateItem("t1", { relations: [{ predicate: "assignedTo", target: "global:u-other" }] })
      return original(id)
    })
    const update = vi.spyOn(connector, "updateItem")
    await act(async () => pill("Übernommen")!.click())
    await settle()
    expect(update).toHaveBeenCalledTimes(1) // nur der fremde Edit
    expect((await original("t1"))?.relations).toEqual([{ predicate: "assignedTo", target: "global:u-other" }])
  })

  it("ein Lesefehler beim Abgeben wird sichtbar, ohne unbehandelte Ablehnung", async () => {
    const t = item("t1", "task", { title: "T", status: "open" }, [{ predicate: "assignedTo", target: `global:${ME}` }])
    await render(createElement(Live, { id: "t1" }), [t], { g: ["t1"] }, "g")
    vi.spyOn(connector, "getItem").mockRejectedValueOnce(new Error("Lesen fehlgeschlagen"))
    await act(async () => pill("Übernommen")!.click())
    await settle()
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Lesen fehlgeschlagen")
  })
})
