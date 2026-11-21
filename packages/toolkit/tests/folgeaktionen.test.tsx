// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER, type Item } from "@real-life/data-interface"
import { MockConnector } from "@real-life/mock-connector"

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
 * C2), nach Antons Entscheidung: Nicht übernommen „Übernehmen"; übernommen
 * „✓ Übernommen · Erledigt"; erledigt „✓ Übernommen · ✓ Erledigt". Seit S3b
 * mit Rollen der Status-Optionen und „Mitmachen" (aufgabe-zustandsmodell.test.tsx).
 * „✓ Übernommen" ist ein Umschalter (Abgeben), „✓ Erledigt" ein Zustand —
 * zurück geht es nur über Bearbeiten oder das Kanban.
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

const pressed = (label: string) => pill(label)?.getAttribute("aria-pressed")
// „✓ Erledigt" steht als letzter Zustand der Zeile.
const doneState = () => [...host.querySelectorAll("[data-self-state]")].at(-1) ?? null

describe("Folgeaktionen der Aufgabe als Umschalter (Entscheidung 27, Anton)", () => {
  it("nicht übernommen: nur „Übernehmen“; stehen andere an der Kante, „Mitmachen“", async () => {
    await render(task([]))
    expect(pills()).toEqual(["Übernehmen"])
    await act(async () => root.unmount())
    root = createRoot(host)
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}` }]))
    expect(pills()).toEqual(["Mitmachen"])
  })

  it("übernommen: „✓ Übernommen · Erledigt“; Erledigt schreibt den Erledigt-Wert, dann „✓ Übernommen · ✓ Erledigt“", async () => {
    await render(task([]))
    await click(pill("Übernehmen"))
    expect(pills()).toEqual(["Übernommen", "Erledigt"])
    expect(pressed("Übernommen")).toBe("true")
    expect(pressed("Erledigt")).toBeNull() // eine Aktion, kein Umschalter
    await click(pill("Erledigt"))
    expect((await connector.getItem("t1"))?.data.status).toBe("done")
    expect(pills()).toEqual(["Übernommen", "Erledigt"])
    // „✓ Erledigt" ist ein Zustand, kein Knopf.
    expect(pill("Erledigt")).toBeUndefined()
    expect(doneState()?.textContent).toContain("Erledigt")
    expect((await connector.getItem("t1"))?.relations).toEqual([{ predicate: "assignedTo", target: `global:${ME}` }])
  })

  it("„✓ Erledigt“ ist nicht zurücknehmbar: Zustand ohne Knopf, der Status bleibt", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "done"))
    const state = doneState()!
    expect(state.tagName).not.toBe("BUTTON")
    expect(state.getAttribute("aria-pressed")).toBeNull()
    expect(state.getAttribute("role")).toBe("status")
    expect(state.querySelector("button")).toBeNull()
    await act(async () => (state as HTMLElement).click())
    await settle()
    expect((await connector.getItem("t1"))?.data.status).toBe("done")
  })

  it("Klick auf „✓ Übernommen“ gibt ab: nur meine Kante, andere und ihr meta bleiben", async () => {
    await render(task([
      { predicate: "assignedTo", target: `global:${TIMO}`, meta: { note: "bleibt" } },
      { predicate: "assignedTo", target: `global:${ME}` },
    ]))
    await click(pill("Dabei"))
    expect((await connector.getItem("t1"))?.relations).toEqual([
      { predicate: "assignedTo", target: `global:${TIMO}`, meta: { note: "bleibt" } },
    ])
    expect(pills()).toEqual(["Mitmachen"])
  })

  it("eine erledigte Aufgabe lässt sich nicht abgeben: „✓ Übernommen“ ist dann Anzeige (Anton zu #542)", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "done"))
    expect(pill("Übernommen")).toBeUndefined()
    expect(pills()).toEqual(["Übernommen", "Erledigt"])
  })

  it("wer nicht übernommen hat, sieht bei einer erledigten Aufgabe nur „✓ Erledigt“", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}` }], "done"))
    expect(pills()).toEqual(["Erledigt"])
    expect(host.querySelectorAll("[data-self-action] button")).toHaveLength(0)
  })

  it("Doppelklick auf „✓ Übernommen“ gibt ab und übernimmt nicht wieder", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }]))
    const mine = pill("Übernommen") as HTMLButtonElement
    await act(async () => {
      mine.click()
      mine.click()
    })
    await settle()
    expect((await connector.getItem("t1"))?.relations ?? []).toEqual([])
    expect(pills()).toEqual(["Übernehmen"])
  })

  it("ohne Schreibrecht am Item keine Zeile (Modi, Regel 1)", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }]), { can: false })
    expect(pills()).toEqual([])
  })

  it("Barrierefreiheit: die Umschalter nennen die Rücknahme", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "in-progress"))
    expect(pill("Übernommen")?.getAttribute("aria-label")).toBe("Übernommen – Übernahme zurückgeben")
    expect(pill("Erledigt")?.getAttribute("aria-pressed")).toBeNull()
  })
})

describe("Register: Rolle done und Folgeaktion", () => {
  it("die Aufgabe gibt „done“ die Rolle done und deklariert den Umschalter an assignedTo", () => {
    const t = resolveTypePresentation("task")
    const status = t.fields?.find((f) => f.key === "status")
    expect(status?.options?.filter((o) => o.role === "done").map((o) => o.id)).toEqual(["done"])
    const assigned = t.edges?.find((e) => e.predicate === "assignedTo")
    expect(assigned?.selfAction?.followUps).toEqual({
      field: "status",
      complete: { label: "Erledigt" },
      release: "Übernahme zurückgeben",
    })
  })

  const manifest = composeTypeManifest([
    TOOLKIT_TYPE_LAYER,
    { name: "app", definitions: [{ id: "chore", vocabularies: [], relations: [{ predicate: "assignedTo", itemRole: "from", otherKind: "person" }] }] },
  ])
  const FOLLOW = { field: "status", complete: { label: "Fertig" }, release: "Zurückgeben" }
  const edge = (followUps: object = FOLLOW) => ({
    predicate: "assignedTo", itemRole: "from" as const, storage: "embedded" as const, widget: "people" as const, pos: "meta" as const, label: "Wer",
    selfAction: { label: "Übernehmen", mine: "Übernommen", followUps: followUps as never },
  })

  it("lehnt Folgeaktionen ohne Status-Feld mit Rollen open und done ab", () => {
    setTypeManifest(manifest)
    expect(() =>
      registerTypePresentation("app", [{
        id: "chore", label: "Dienst",
        fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A" }] }],
        edges: [edge()],
      }]),
    ).toThrow(/Rolle open und einer der Rolle done/)
  })

  it("mehrere Optionen dürfen dieselbe Rolle tragen (Regel 18)", () => {
    setTypeManifest(manifest)
    registerTypePresentation("app", [{
      id: "chore", label: "Dienst",
      fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "o", label: "O", role: "open" }, { id: "a", label: "A", role: "done" }, { id: "b", label: "B", role: "done" }] }],
      edges: [edge()],
    }])
    expect(resolveTypePresentation("chore").actions).toBeDefined()
  })

  it("mit Qualifier: mein Wert ist ein Umschalter, daneben „Fertig“", async () => {
    setTypeManifest(manifest)
    registerTypePresentation("app", [{
      id: "chore", label: "Dienst",
      fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A", role: "open" }, { id: "z", label: "Z", role: "done" }] }],
      edges: [{
        ...edge(),
        qualifier: { key: "role", values: [{ id: "can", label: "kann" }, { id: "learns", label: "lernt" }] },
        selfAction: { label: "Übernehmen", mine: "Übernommen", qualifiers: ["can", "learns"], followUps: FOLLOW },
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
    expect(pressed("Kann")).toBe("true")
    expect(pressed("Lernt")).toBe("false")
    expect(pressed("Fertig")).toBeNull()
  })

  it("nimmt einen gültigen Eintrag an", () => {
    setTypeManifest(manifest)
    registerTypePresentation("app", [{
      id: "chore", label: "Dienst",
      fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A", role: "open" }, { id: "z", label: "Z", role: "done" }] }],
      edges: [edge()],
    }])
    expect(resolveTypePresentation("chore").actions).toBeDefined()
  })
})

describe("Codex Runde 5: Record-Kante mit Folgeaktionen", () => {
  it("ein ungültiger eigener Record zählt nicht als „ich stehe an der Kante“", async () => {
    const { useFollowUps } = await import("../src/components/preview/use-people-line")
    const edge = { predicate: "attends", itemRole: "to" as const, storage: "record" as const, widget: "people" as const, pos: "meta" as const, label: "x" }
    const statusField = { key: "status", widget: "status" as const, pos: "meta" as const, options: [{ id: "open", label: "o", role: "open" as const }, { id: "done", label: "d", role: "done" as const }] }
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

describe("Codex Runde 8: Qualifier-Wechsel vor dem nächsten Render", () => {
  it("can → learns → can in einem Zug lässt mich mit „can“ an der Kante", async () => {
    const manifest = composeTypeManifest([
      TOOLKIT_TYPE_LAYER,
      { name: "app", definitions: [{ id: "chore", vocabularies: [], relations: [{ predicate: "assignedTo", itemRole: "from", otherKind: "person" }] }] },
    ])
    setTypeManifest(manifest)
    registerTypePresentation("app", [{
      id: "chore", label: "Dienst",
      fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A", role: "open" }, { id: "z", label: "Z", role: "done" }] }],
      edges: [{
        predicate: "assignedTo", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "Wer",
        qualifier: { key: "role", values: [{ id: "can", label: "kann" }, { id: "learns", label: "lernt" }] },
        selfAction: { label: "Übernehmen", mine: "Übernommen", qualifiers: ["can", "learns"], followUps: { field: "status", complete: { label: "Fertig" }, release: "Zurück" } },
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
    const lernt = pill("Lernt") as HTMLButtonElement
    const kann = pill("Kann") as HTMLButtonElement
    await act(async () => {
      lernt.click()
      kann.click()
    })
    await settle()
    expect((await connector.getItem("c1"))?.relations).toEqual([{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: "can" } }])
  })
})
