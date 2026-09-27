// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER, type Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { useItem } from "../src/hooks/use-items"
import {
  registerTypePresentation,
  resetTypePresentationForTests,
  resolveTypePresentation,
  setTypeManifest,
} from "../src/components/preview/type-presentation"

/**
 * S3, Teil A: Folgeaktionen der Aufgabe (Entscheidung 27; shared-components,
 * C2). Nach „Übernehmen" steht „✓ Übernommen · Erledigt · Abgeben", erledigt
 * „✓ Erledigt · Wieder öffnen" — nur für die Person, die übernommen hat.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const TIMO = "u-timo"

const task = (relations: Item["relations"], status = "open"): Item => ({
  id: "t1",
  type: "task",
  createdBy: TIMO,
  createdAt: "2026-09-20T10:00:00.000Z",
  data: { title: "Kompost umsetzen", status },
  relations,
})

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

/** Rendert die Aktionszeile gegen das LEBENDE Item (wie der Detail-Host). */
function Live({ id }: { id: string }): ReactNode {
  const { data: item } = useItem(id)
  if (!item) return null
  const Actions = resolveTypePresentation("task").actions!
  return createElement(Actions, { item })
}

async function render(start: Item, options: { can?: boolean } = {}) {
  connector = new MockConnector(
    {
      items: [start],
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [
        { id: ME, displayName: "Ich" },
        { id: TIMO, displayName: "Timo" },
      ],
      groupMembers: { g: [ME, TIMO] },
      groupItems: { g: [start.id] },
    } as never,
  )
  await connector.init()
  connector.setCurrentGroup("g")
  if (options.can === false) Object.assign(connector, { can: () => false })
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Live, { id: start.id })))
  })
  await settle()
}

async function click(button: Element | null | undefined) {
  expect(button).toBeTruthy()
  await act(async () => {
    ;(button as HTMLButtonElement).click()
  })
  await settle()
}

const pills = () => [...host.querySelectorAll('[data-self-action] button, [data-self-action] [data-self-state]')].map((el) => el.textContent?.trim())
const pill = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  resetTypePresentationForTests()
})

describe("Folgeaktionen der Aufgabe (Entscheidung 27)", () => {
  it("nicht übernommen: nur „Übernehmen“", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}` }]))
    expect(pills()).toEqual(["Übernehmen"])
  })

  it("übernommen und offen: „✓ Übernommen · Erledigt · Abgeben“; Erledigt schreibt den Erledigt-Wert", async () => {
    await render(task([]))
    await click(pill("Übernehmen"))
    expect(pills()).toEqual(["Übernommen", "Erledigt", "Abgeben"])
    await click(pill("Erledigt"))
    expect((await connector.getItem("t1"))?.data.status).toBe("done")
    // Erledigt: „✓ Erledigt · Wieder öffnen“; die Kante bleibt.
    expect(pills()).toEqual(["Erledigt", "Wieder öffnen"])
    expect((await connector.getItem("t1"))?.relations).toEqual([{ predicate: "assignedTo", target: `global:${ME}` }])
  })

  it("„Wieder öffnen“ schreibt den Standard-Status", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "done"))
    expect(pills()).toEqual(["Erledigt", "Wieder öffnen"])
    await click(pill("Wieder öffnen"))
    expect((await connector.getItem("t1"))?.data.status).toBe("open")
    expect(pills()).toEqual(["Übernommen", "Erledigt", "Abgeben"])
  })

  it("„Abgeben“ nimmt nur meine Kante heraus; andere und ihr meta bleiben", async () => {
    await render(task([
      { predicate: "assignedTo", target: `global:${TIMO}`, meta: { note: "bleibt" } },
      { predicate: "assignedTo", target: `global:${ME}` },
    ]))
    await click(pill("Abgeben"))
    expect((await connector.getItem("t1"))?.relations).toEqual([
      { predicate: "assignedTo", target: `global:${TIMO}`, meta: { note: "bleibt" } },
    ])
    expect(pills()).toEqual(["Übernehmen"])
  })

  it("wer nicht übernommen hat, sieht keine Folgeaktionen — auch nicht bei einer erledigten Aufgabe", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}` }], "done"))
    expect(pills()).toEqual(["Übernehmen"])
    expect(pill("Wieder öffnen")).toBeUndefined()
  })

  it("Codex R1/3: Doppelklick auf „Abgeben“ gibt ab und übernimmt nicht wieder", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }]))
    const abgeben = pill("Abgeben") as HTMLButtonElement
    await act(async () => {
      abgeben.click()
      abgeben.click()
    })
    await settle()
    expect((await connector.getItem("t1"))?.relations ?? []).toEqual([])
    expect(pills()).toEqual(["Übernehmen"])
  })

  it("ohne Schreibrecht am Item keine Zeile (Modi, Regel 1)", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }]), { can: false })
    expect(pills()).toEqual([])
  })

  it("„✓ Übernommen“ ist ein Zustand, kein Umschalter: Abgeben geht über „Abgeben“", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }]))
    expect(pill("Übernommen")).toBeUndefined()
    expect(host.querySelector("[data-self-state]")?.textContent).toContain("Übernommen")
  })
})

describe("Register: Erledigt-Wert und Folgeaktionen", () => {
  it("die Aufgabe markiert „done“ als Erledigt-Wert und deklariert die Folgeaktionen an assignedTo", () => {
    const t = resolveTypePresentation("task")
    const status = t.fields?.find((f) => f.key === "status")
    expect(status?.options?.filter((o) => o.done).map((o) => o.id)).toEqual(["done"])
    const assigned = t.edges?.find((e) => e.predicate === "assignedTo")
    expect(assigned?.selfAction?.followUps).toEqual({
      field: "status",
      done: "Erledigt",
      actions: [
        { id: "complete", label: "Erledigt" },
        { id: "release", label: "Abgeben" },
        { id: "reopen", label: "Wieder öffnen" },
      ],
    })
  })

  const manifest = composeTypeManifest([
    TOOLKIT_TYPE_LAYER,
    { name: "app", definitions: [{ id: "chore", vocabularies: [], relations: [{ predicate: "assignedTo", itemRole: "from", otherKind: "person" }] }] },
  ])
  const edge = (followUps: object) => ({
    predicate: "assignedTo", itemRole: "from" as const, storage: "embedded" as const, widget: "people" as const, pos: "meta" as const, label: "Wer",
    selfAction: { label: "Übernehmen", mine: "Übernommen", followUps: followUps as never },
  })

  it("lehnt Folgeaktionen ohne Status-Feld mit genau einem Erledigt-Wert ab", () => {
    setTypeManifest(manifest)
    expect(() =>
      registerTypePresentation("app", [{
        id: "chore", label: "Dienst",
        fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A" }] }],
        edges: [edge({ field: "status", done: "Erledigt", actions: [{ id: "complete", label: "Erledigt" }] })],
      }]),
    ).toThrow(/Erledigt-Wert/)
  })

  it("lehnt mehr als einen Erledigt-Wert ab", () => {
    setTypeManifest(manifest)
    expect(() =>
      registerTypePresentation("app", [{
        id: "chore", label: "Dienst",
        fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A", done: true }, { id: "b", label: "B", done: true }] }],
      }]),
    ).toThrow(/mehr als einen Erledigt-Wert/)
  })

  it("Codex R1/5: mit Qualifier ist mein Zustand bei Folgeaktionen eine Anzeige", async () => {
    setTypeManifest(manifest)
    registerTypePresentation("app", [{
      id: "chore", label: "Dienst",
      fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A" }, { id: "z", label: "Z", done: true }] }],
      edges: [{
        ...edge({ field: "status", done: "Fertig", actions: [{ id: "complete", label: "Fertig" }, { id: "release", label: "Abgeben" }] }),
        qualifier: { key: "role", values: [{ id: "can", label: "kann" }, { id: "learns", label: "lernt" }] },
        selfAction: { label: "Übernehmen", mine: "Übernommen", qualifiers: ["can", "learns"], followUps: { field: "status", done: "Fertig", actions: [{ id: "complete", label: "Fertig" }, { id: "release", label: "Abgeben" }] } },
      }],
    }])
    const chore: Item = { id: "c1", type: "chore", createdBy: TIMO, createdAt: "2026-09-20T10:00:00.000Z", data: { title: "C", status: "a" }, relations: [{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: "can" } }] }
    connector = new MockConnector({ items: [chore], groups: [{ id: "g", name: "G", data: {} }], users: [{ id: ME, displayName: "Ich" }, { id: TIMO, displayName: "Timo" }], groupMembers: { g: [ME, TIMO] }, groupItems: { g: ["c1"] } } as never)
    await connector.init()
    connector.setCurrentGroup("g")
    const Actions = resolveTypePresentation("chore").actions!
    await act(async () => {
      root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Actions, { item: chore })))
    })
    await settle()
    expect(host.querySelector("[data-self-state]")?.textContent).toContain("Kann")
    expect(pill("Kann")).toBeUndefined()
    expect(pill("Lernt")).toBeTruthy()
    expect(pill("Abgeben")).toBeTruthy()
  })

  it("nimmt einen gültigen Eintrag an", () => {
    setTypeManifest(manifest)
    registerTypePresentation("app", [{
      id: "chore", label: "Dienst",
      fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A" }, { id: "z", label: "Z", done: true }] }],
      edges: [edge({ field: "status", done: "Fertig", actions: [{ id: "complete", label: "Fertig" }, { id: "reopen", label: "Neu" }] })],
    }])
    expect(resolveTypePresentation("chore").actions).toBeDefined()
  })
})

describe("Codex Runde 5: Record-Kante mit Folgeaktionen", () => {
  it("ein ungültiger eigener Record zählt nicht als „ich stehe an der Kante“", async () => {
    const { useFollowUps } = await import("../src/components/preview/use-people-line")
    const edge = { predicate: "attends", itemRole: "to" as const, storage: "record" as const, widget: "people" as const, pos: "meta" as const, label: "x" }
    const statusField = { key: "status", widget: "status" as const, pos: "meta" as const, options: [{ id: "open", label: "o" }, { id: "done", label: "d", done: true }] }
    const t = task([], "open")
    const record: Item = { id: "rel-1", type: "relation", createdBy: ME, createdAt: "2026-09-27T10:00:00.000Z", data: { predicate: "attends", role: "going" }, relations: [{ predicate: "from", target: `global:${ME}` }, { predicate: "to", target: "item:t1" }] }
    let run: ((id: "complete") => Promise<void>) | undefined
    function Probe() {
      run = useFollowUps(t, statusField, "open", edge).run
      return null
    }
    connector = new MockConnector({ items: [t, record], groups: [{ id: "g", name: "G", data: {} }], users: [{ id: ME, displayName: "Ich" }], groupMembers: { g: [ME] }, groupItems: { g: ["t1", "rel-1"] } } as never, { allowFixtureAuthors: true })
    await connector.init()
    connector.setCurrentGroup("g")
    connector.verifyRecordClaim = (async () => "invalid") as never
    await act(async () => root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Probe))))
    await settle()
    await act(async () => run!("complete"))
    expect((await connector.getItem("t1"))?.data.status).toBe("open")
    connector.verifyRecordClaim = (async () => "trusted") as never
    await act(async () => run!("complete"))
    expect((await connector.getItem("t1"))?.data.status).toBe("done")
  })
})
