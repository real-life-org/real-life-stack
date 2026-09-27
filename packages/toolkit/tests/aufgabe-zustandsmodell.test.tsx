// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
import { firstOptionWithRole, statusRole } from "../src/components/preview/field-register"
import { peopleLine, peopleLineGroups } from "../src/components/preview/people-line"
import { EXAMPLE_LEARNING_LAYER } from "../src/story-support/example-learning-layer"

/**
 * S3b PR B: Zustandsmodell der Aufgabe (Spec 06, Regeln 9, 18, 19, 20;
 * shared-components, Detail-Anatomie Regel 7, C2).
 *
 * - Status-Optionen tragen eine Rolle (open | active | done); `done: true`
 *   wird nicht mehr gelesen.
 * - Dazukommen bei `open` setzt die erste `active`-Option; die letzte Person,
 *   die bei `active` abgibt, setzt die erste `open`-Option. Beides in EINEM
 *   updateItem mit der Kante.
 * - „Mitmachen", wenn andere an der Kante stehen und ich nicht; „✓ Dabei",
 *   wenn ich mit anderen dort stehe; „✓ Übernommen" allein.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const TIMO = "u-timo"

const task = (relations: Item["relations"], status: string | undefined = "open", type = "task"): Item => ({
  id: "t1",
  type,
  createdBy: TIMO,
  createdAt: "2026-09-20T10:00:00.000Z",
  data: { title: "Kompost umsetzen", ...(status !== undefined ? { status } : {}) },
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

function Live({ id, type }: { id: string; type: string }): ReactNode {
  const { data: item } = useItem(id)
  if (!item) return null
  const Actions = resolveTypePresentation(type).actions!
  return createElement(Actions, { item })
}

async function render(start: Item) {
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
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Live, { id: start.id, type: start.type })))
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

const pills = () => [...host.querySelectorAll("[data-self-action] button, [data-self-action] [data-self-state]")].map((el) => el.textContent?.trim())
const pill = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)
const saved = () => connector.getItem("t1")

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

describe("Register: Rollen der Status-Optionen (Regel 18)", () => {
  it("die Aufgabe führt To Do open · In Arbeit active · Erledigt done, ohne done-Markierung", () => {
    const status = resolveTypePresentation("task").fields?.find((f) => f.key === "status")
    expect(status?.options?.map((o) => [o.id, o.role])).toEqual([
      ["open", "open"],
      ["in-progress", "active"],
      ["done", "done"],
    ])
    expect(status?.options?.some((o) => "done" in o)).toBe(false)
  })

  it("Übergänge schreiben die erste Option einer Rolle; eine Option ohne Rolle hat keine", () => {
    const field = {
      key: "status",
      widget: "status" as const,
      pos: "meta" as const,
      options: [
        { id: "a", label: "A", role: "open" as const },
        { id: "b", label: "B", role: "open" as const },
        { id: "x", label: "X" },
        { id: "z", label: "Z", role: "done" as const },
      ],
    }
    expect(firstOptionWithRole(field, "open")).toBe("a")
    expect(firstOptionWithRole(field, "active")).toBeUndefined()
    expect(statusRole(field, "b")).toBe("open")
    expect(statusRole(field, "x")).toBeUndefined()
    expect(statusRole(field, "unbekannt")).toBeUndefined()
    // Ohne Wert gilt der Standard-Status des Typs.
    expect(statusRole(field, undefined, "z")).toBe("done")
  })

  const manifest = composeTypeManifest([
    TOOLKIT_TYPE_LAYER,
    { name: "app", definitions: [{ id: "chore", vocabularies: [], relations: [{ predicate: "assignedTo", itemRole: "from", otherKind: "person" }] }] },
  ])
  const FOLLOW = { field: "status", complete: { label: "Fertig" }, release: "Zurückgeben" }
  const edge = {
    predicate: "assignedTo", itemRole: "from" as const, storage: "embedded" as const, widget: "people" as const, pos: "meta" as const, label: "Wer",
    selfAction: { label: "Übernehmen", mine: "Übernommen", followUps: FOLLOW },
  }

  it("Folgeaktionen brauchen ein Status-Feld mit Rolle open und Rolle done", () => {
    setTypeManifest(manifest)
    expect(() =>
      registerTypePresentation("app", [{
        id: "chore", label: "Dienst",
        fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "a", label: "A", role: "open" }] }],
        edges: [edge],
      }]),
    ).toThrow(/Rolle open und .*Rolle done/)
  })

  it("eine Rolle nur an Optionen eines status-Felds", () => {
    setTypeManifest(manifest)
    expect(() =>
      registerTypePresentation("app", [{
        id: "chore", label: "Dienst",
        fields: [{ key: "kind", widget: "select", pos: "meta", options: [{ id: "a", label: "A", role: "open" }] }],
      }]),
    ).toThrow(/Rolle/)
  })

  it("qualifier.default muss ein deklarierter Wert sein", () => {
    setTypeManifest(manifest)
    expect(() =>
      registerTypePresentation("app", [{
        id: "chore", label: "Dienst",
        edges: [{ ...edge, selfAction: undefined, qualifier: { key: "role", values: [{ id: "can", label: "kann" }], default: "maybe" } }],
      }]),
    ).toThrow(/default/)
  })
})

describe("Übergänge beim Dazukommen und Abgeben (Regel 19)", () => {
  it("Übernehmen einer offenen Aufgabe setzt „In Arbeit“ — Kante und Status in einem updateItem", async () => {
    await render(task([]))
    const update = vi.spyOn(connector, "updateItem")
    await click(pill("Übernehmen"))
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0]![1]).toMatchObject({ data: { status: "in-progress" }, relations: [{ predicate: "assignedTo", target: `global:${ME}` }] })
    expect((await saved())?.data.status).toBe("in-progress")
  })

  it("Mitmachen bei „In Arbeit“ lässt den Status", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}` }], "in-progress"))
    await click(pill("Mitmachen"))
    const item = await saved()
    expect(item?.data.status).toBe("in-progress")
    expect(item?.relations).toEqual([
      { predicate: "assignedTo", target: `global:${TIMO}` },
      { predicate: "assignedTo", target: `global:${ME}` },
    ])
  })

  it("Mitmachen bei einer offenen Aufgabe mit Zuweisung setzt „In Arbeit“", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}` }], "open"))
    await click(pill("Mitmachen"))
    expect((await saved())?.data.status).toBe("in-progress")
  })

  it("Übernehmen einer archivierten Aufgabe ändert den Status nicht (erledigt: kein Übernehmen, siehe unten)", async () => {
    await render(task([], "archived"))
    await click(pill("Übernehmen"))
    expect((await saved())?.data.status).toBe("archived")
  })

  it("ohne Status gilt der Standard-Status (open): Übernehmen setzt „In Arbeit“", async () => {
    await render(task([], undefined))
    await click(pill("Übernehmen"))
    expect((await saved())?.data.status).toBe("in-progress")
  })

  it("die letzte Person gibt bei „In Arbeit“ ab: zurück auf offen, in einem updateItem", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "in-progress"))
    const update = vi.spyOn(connector, "updateItem")
    await click(pill("Übernommen"))
    expect(update).toHaveBeenCalledTimes(1)
    const item = await saved()
    expect(item?.relations ?? []).toEqual([])
    expect(item?.data.status).toBe("open")
  })

  it("abgeben, während andere bleiben: der Status bleibt „In Arbeit“", async () => {
    await render(task([
      { predicate: "assignedTo", target: `global:${TIMO}` },
      { predicate: "assignedTo", target: `global:${ME}` },
    ], "in-progress"))
    await click(pill("Dabei"))
    const item = await saved()
    expect(item?.relations).toEqual([{ predicate: "assignedTo", target: `global:${TIMO}` }])
    expect(item?.data.status).toBe("in-progress")
  })

  it("wird die Aufgabe während des Abgebens erledigt, schreibt das Abgeben nichts (frischer Stand)", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "in-progress"))
    const mine = pill("Übernommen")!
    const original = connector.getItem.bind(connector)
    vi.spyOn(connector, "getItem").mockImplementationOnce(async (id: string) => {
      await connector.updateItem("t1", { data: { title: "Kompost umsetzen", status: "done" } })
      return original(id)
    })
    await click(mine)
    const item = await saved()
    expect(item?.relations).toEqual([{ predicate: "assignedTo", target: `global:${ME}` }])
    expect(item?.data.status).toBe("done")
  })

  it("wer beim Klick nicht mehr allein ist, setzt nicht zurück (frischer Stand)", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "in-progress"))
    // Zwischen Render und Klick kommt Timo dazu.
    const stored = await saved()
    await connector.updateItem("t1", { relations: [...(stored?.relations ?? []), { predicate: "assignedTo", target: `global:${TIMO}` }] })
    const stale = pill("Übernommen") ?? pill("Dabei")
    await click(stale)
    const item = await saved()
    expect(item?.relations).toEqual([{ predicate: "assignedTo", target: `global:${TIMO}` }])
    expect(item?.data.status).toBe("in-progress")
  })

  it("„Erledigt“ aus „In Arbeit“ schreibt die erste Option der Rolle done", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "in-progress"))
    await click(pill("Erledigt"))
    expect((await saved())?.data.status).toBe("done")
    expect([...host.querySelectorAll("[data-self-state]")].at(-1)?.textContent).toContain("Erledigt")
  })

  it("archiviert (keine Rolle): kein „Erledigt“ und kein „✓ Erledigt“", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "archived"))
    expect(pills()).toEqual(["Übernommen"])
  })

  it("ein Typ ohne Option der Rolle active bleibt beim Dazukommen offen, Abgeben ändert nichts", async () => {
    setTypeManifest(composeTypeManifest([
      TOOLKIT_TYPE_LAYER,
      { name: "app", definitions: [{ id: "chore", vocabularies: [], relations: [{ predicate: "assignedTo", itemRole: "from", otherKind: "person" }] }] },
    ]))
    registerTypePresentation("app", [{
      id: "chore", label: "Karte",
      fields: [{ key: "status", widget: "status", pos: "meta", options: [{ id: "offen", label: "Offen", role: "open" }, { id: "erledigt", label: "Erledigt", role: "done" }] }],
      edges: [{
        predicate: "assignedTo", itemRole: "from", storage: "embedded", widget: "people", pos: "meta", label: "Wer",
        selfAction: { label: "Übernehmen", mine: "Übernommen", followUps: { field: "status", complete: { label: "Erledigt" }, release: "Zurückgeben" } },
      }],
    }])
    await render(task([], "offen", "chore"))
    await click(pill("Übernehmen"))
    expect((await saved())?.data.status).toBe("offen")
    await click(pill("Übernommen"))
    expect((await saved())?.data.status).toBe("offen")
  })
})

describe("Mitmachen und ✓ Dabei (Regel 9, join)", () => {
  it("niemand zugewiesen: „Übernehmen“", async () => {
    await render(task([]))
    expect(pills()).toEqual(["Übernehmen"])
  })

  it("andere zugewiesen, ich nicht: „Mitmachen“ — auch wenn sie lernen", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}`, meta: { role: "learns" } }], "in-progress"))
    expect(pills()).toEqual(["Mitmachen"])
  })

  it("ich allein: „✓ Übernommen · Erledigt“, Rücknahme „Übernahme zurückgeben“", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "in-progress"))
    expect(pills()).toEqual(["Übernommen", "Erledigt"])
    expect(pill("Übernommen")?.getAttribute("aria-label")).toBe("Übernommen – Übernahme zurückgeben")
  })

  it("ich mit anderen: „✓ Dabei · Erledigt“, Rücknahme „Nicht mehr mitmachen“; erledigt „✓ Dabei · ✓ Erledigt“", async () => {
    await render(task([
      { predicate: "assignedTo", target: `global:${TIMO}` },
      { predicate: "assignedTo", target: `global:${ME}` },
    ], "in-progress"))
    expect(pills()).toEqual(["Dabei", "Erledigt"])
    expect(pill("Dabei")?.getAttribute("aria-pressed")).toBe("true")
    expect(pill("Dabei")?.getAttribute("aria-label")).toBe("Dabei – Nicht mehr mitmachen")
    await click(pill("Erledigt"))
    expect(pills()).toEqual(["Dabei", "Erledigt"])
    expect(pill("Erledigt")).toBeUndefined()
  })

  it("ich stehe mit role learns an der Kante: mein Zustand ist gedrückt, Klick gibt ab", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: "learns" } }], "in-progress"))
    expect(pill("Übernommen")?.getAttribute("aria-pressed")).toBe("true")
    await click(pill("Übernommen"))
    expect((await saved())?.relations ?? []).toEqual([])
  })

  it("die Aufgabe deklariert join an assignedTo", () => {
    const assigned = resolveTypePresentation("task").edges?.find((e) => e.predicate === "assignedTo")
    expect(assigned?.selfAction?.join).toEqual({ label: "Mitmachen", mine: "Dabei", release: "Nicht mehr mitmachen" })
  })
})

describe("Option D: das Modul bringt sein Vokabular mit (Regel 20)", () => {
  const TASK = () => resolveTypePresentation("task")
  const assigned = () => TASK().edges?.find((e) => e.predicate === "assignedTo")
  const example = () => registerTypePresentation("beispiel", { extensions: [EXAMPLE_LEARNING_LAYER] })

  it("der Kern erlaubt den Qualifier role an assignedTo, deklariert aber keine Werte und keine Knopftexte", () => {
    expect(assigned()?.qualifier).toEqual({ key: "role", values: [] })
    expect(assigned()?.selfAction?.qualifiers).toBeUndefined()
    expect(JSON.stringify(TASK())).not.toMatch(/Kann ich|Will lernen|learns/)
  })

  it("ohne Schicht: jeder Wert bleibt ohne Zustandstext („Timo“), auch learns", () => {
    const item = task([
      { predicate: "assignedTo", target: "global:anna" },
      { predicate: "assignedTo", target: "global:timo", meta: { role: "learns" } },
    ])
    const [group] = peopleLineGroups(TASK().edges)
    const byUser = Object.fromEntries(peopleLine(item, group!, []).map((e) => [e.userId, e.qualifier?.label]))
    expect(byUser).toEqual({ anna: undefined, timo: undefined })
  })

  it("mit der Beispiel-Schicht: „Timo lernt“; ein fehlender Wert ohne Text; ein unbekannter ohne Text", () => {
    example()
    expect(assigned()?.qualifier?.values.map((v) => v.id)).toEqual(["can", "learns"])
    const item = task([
      { predicate: "assignedTo", target: "global:anna" },
      { predicate: "assignedTo", target: "global:timo", meta: { role: "learns" } },
      { predicate: "assignedTo", target: "global:lena", meta: { role: "foo" } },
    ])
    const [group] = peopleLineGroups(TASK().edges)
    const byUser = Object.fromEntries(peopleLine(item, group!, []).map((e) => [e.userId, e.qualifier?.label]))
    expect(byUser).toEqual({ anna: undefined, timo: "lernt", lena: undefined })
  })

  it("Kanban-Selbstaktion ohne Schicht schreibt die Kante ohne role", async () => {
    await render(task([]))
    await click(pill("Übernehmen"))
    expect((await saved())?.relations).toEqual([{ predicate: "assignedTo", target: `global:${ME}` }])
  })

  it("jede assignedTo-Kante zählt als zugewiesen, egal welcher Wert (auch unbekannt)", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}`, meta: { role: "foo" } }], "open"))
    expect(pills()).toEqual(["Mitmachen"])
  })

  it("die Schicht bringt Pills mit: „Kann ich · Will lernen“ schreiben role, der Status folgt Regel 19", async () => {
    example()
    await render(task([]))
    expect(pills()).toEqual(["Kann ich", "Will lernen"])
    await click(pill("Will lernen"))
    const item = await saved()
    expect(item?.relations).toEqual([{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: "learns" } }])
    expect(item?.data.status).toBe("in-progress")
  })

  it("die Pills einer Schicht dürfen nur Werte schreiben, die eine Schicht deklariert", () => {
    expect(() =>
      registerTypePresentation("app", {
        extensions: [{ id: "task", selfActions: [{ predicate: "assignedTo", itemRole: "from", selfAction: { label: "X", mine: "Y", qualifiers: ["learns"] } }] }],
      }),
    ).toThrow(/learns/)
  })

  it("Werte nur an einer Kern-Kante mit Qualifier; derselbe Wert aus zwei Schichten ist ein Konflikt", () => {
    expect(() =>
      registerTypePresentation("app", {
        extensions: [{ id: "task", qualifierValues: [{ predicate: "blocks", itemRole: "from", values: [{ id: "hard", label: "hart" }] }] }],
      }),
    ).toThrow(/Qualifier/)
    example()
    expect(() =>
      registerTypePresentation("zweite", {
        extensions: [{ id: "task", qualifierValues: [{ predicate: "assignedTo", itemRole: "from", values: [{ id: "learns", label: "übt" }] }] }],
      }),
    ).toThrow(/learns/)
    // Eine weitere Schicht darf neue Werte ergänzen.
    registerTypePresentation("dritte", {
      extensions: [{ id: "task", qualifierValues: [{ predicate: "assignedTo", itemRole: "from", values: [{ id: "leads", label: "leitet" }] }] }],
    })
    expect(assigned()?.qualifier?.values.map((v) => v.id)).toEqual(["can", "learns", "leads"])
  })

  it("die Ersetzung der Selbstaktion braucht eine Kante mit Selbstaktion im Toolkit-Register und ist nur einmal erlaubt", () => {
    expect(() =>
      registerTypePresentation("app", {
        extensions: [{ id: "task", selfActions: [{ predicate: "blocks", itemRole: "from", selfAction: { label: "X", mine: "Y" } }] }],
      }),
    ).toThrow(/Selbstaktion/)
    example()
    expect(() =>
      registerTypePresentation("zweite", {
        extensions: [{ id: "task", selfActions: [{ predicate: "assignedTo", itemRole: "from", selfAction: { label: "X", mine: "Y" } }] }],
      }),
    ).toThrow(/bereits/)
  })
})

describe("Codex Runde 1, Befund 3: join mit Qualifier-Pills", () => {
  it("wird beim Registrieren abgelehnt, statt still ignoriert (Regel 9 nennt die eine Pill)", () => {
    expect(() =>
      registerTypePresentation("app", {
        extensions: [{
          id: "task",
          qualifierValues: EXAMPLE_LEARNING_LAYER.qualifierValues,
          selfActions: [{
            predicate: "assignedTo", itemRole: "from",
            selfAction: { label: "Kann ich", mine: "Dabei", qualifiers: ["can", "learns"], join: { label: "Mitmachen", mine: "Dabei", release: "Raus" } },
          }],
        }],
      }),
    ).toThrow(/join/)
  })
})

describe("Loop-Review: Schreiben nie am falschen Item", () => {
  async function renderStatic(rendered: Item, stored: Item) {
    connector = new MockConnector(
      { items: [stored], groups: [{ id: "g", name: "Garten", data: {} }], users: [{ id: ME, displayName: "Ich" }, { id: TIMO, displayName: "Timo" }], groupMembers: { g: [ME, TIMO] }, groupItems: { g: [stored.id] } } as never,
    )
    await connector.init()
    connector.setCurrentGroup("g")
    const Actions = resolveTypePresentation("task").actions!
    await act(async () => {
      root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(Actions, { item: rendered })))
    })
    await settle()
  }

  it("Selbstaktion: liefert der geöffnete Space unter derselben Id ein anderes Item, wird nichts geschrieben", async () => {
    const rendered = { ...task([], "open"), createdAt: "2026-01-01T00:00:00.000Z", createdBy: ME }
    const stored = task([], "open")
    await renderStatic(rendered, stored)
    await click(pill("Übernehmen"))
    expect((await saved())?.relations ?? []).toEqual([])
    expect((await saved())?.data.status).toBe("open")
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("geöffneten Space")
  })

  it("Folgeaktion: dasselbe — „Erledigt“ schreibt nicht an einem fremden Item", async () => {
    const mine = [{ predicate: "assignedTo", target: `global:${ME}` }]
    const rendered = { ...task(mine, "in-progress"), createdAt: "2026-01-01T00:00:00.000Z", createdBy: ME }
    await renderStatic(rendered, task(mine, "in-progress"))
    await click(pill("Erledigt"))
    expect((await saved())?.data.status).toBe("in-progress")
  })
})

describe("Codex Runde 2, Befund 1: Herkunft des Items", () => {
  it("liegt das Item laut Connector in einem anderen als dem geöffneten Space, schreibt die Selbstaktion nicht", async () => {
    await render(task([], "open"))
    Object.assign(connector, { getItemGroupId: () => "h" })
    await click(pill("Übernehmen"))
    expect((await saved())?.relations ?? []).toEqual([])
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("geöffneten Space")
  })
})

describe("Anton zu #542: erledigt zeigt nur Zustände, keine Aktionen", () => {
  const states = () => [...host.querySelectorAll("[data-self-action] [data-self-state]")].map((el) => el.textContent?.trim())
  const buttons = () => [...host.querySelectorAll("[data-self-action] button")]

  it("erledigt, ich allein zugewiesen: „✓ Übernommen · ✓ Erledigt“, beides Anzeige", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "done"))
    expect(states()).toEqual(["Übernommen", "Erledigt"])
    expect(buttons()).toHaveLength(0)
    for (const el of host.querySelectorAll("[data-self-state]")) {
      expect(el.getAttribute("role")).toBe("status")
      expect(el.getAttribute("tabindex")).toBeNull()
    }
  })

  it("erledigt, ich mit anderen: „✓ Dabei · ✓ Erledigt“", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}` }, { predicate: "assignedTo", target: `global:${ME}` }], "done"))
    expect(states()).toEqual(["Dabei", "Erledigt"])
    expect(buttons()).toHaveLength(0)
  })

  it("erledigt, ich nicht zugewiesen: nur „✓ Erledigt“ — kein Mitmachen, kein Übernehmen", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${TIMO}` }], "done"))
    expect(states()).toEqual(["Erledigt"])
    expect(buttons()).toHaveLength(0)
    await act(async () => root.unmount())
    root = createRoot(host)
    await render(task([], "done"))
    expect(states()).toEqual(["Erledigt"])
    expect(buttons()).toHaveLength(0)
  })

  it("wieder geöffnet (Bearbeiten/Kanban): die normalen Aktionen kehren zurück", async () => {
    await render(task([{ predicate: "assignedTo", target: `global:${ME}` }], "done"))
    await act(async () => {
      await connector.updateItem("t1", { data: { title: "Kompost umsetzen", status: "open" } })
    })
    await settle()
    expect(pills()).toEqual(["Übernommen", "Erledigt"])
    expect(buttons()).toHaveLength(2)
  })

  it("wird die Aufgabe zwischen Render und Klick erledigt, schreibt Übernehmen nichts", async () => {
    await render(task([], "open"))
    const stale = pill("Übernehmen")!
    const stored = await saved()
    // Direkt im Speicher, ohne dass die Zeile neu rendert.
    const update = connector.updateItem.bind(connector)
    await update("t1", { data: { ...(stored?.data ?? {}), status: "done" } })
    await click(stale)
    expect((await saved())?.relations ?? []).toEqual([])
  })

  it("gilt auch für eine App-Ersetzung mit Folgeaktion: keine Pills der App im erledigten Zustand", async () => {
    registerTypePresentation("beispiel", { extensions: [EXAMPLE_LEARNING_LAYER] })
    await render(task([{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: "learns" } }], "done"))
    expect(states()).toEqual(["Lernt", "Erledigt"])
    expect(buttons()).toHaveLength(0)
  })
})

describe("Codex Runde 4: mein Zustand, auch wenn die Pills meinen Wert nicht anbieten", () => {
  const states = () => [...host.querySelectorAll("[data-self-action] [data-self-state]")].map((el) => el.textContent?.trim())
  const onlyCan = () =>
    registerTypePresentation("beispiel", {
      extensions: [{
        id: "task",
        qualifierValues: EXAMPLE_LEARNING_LAYER.qualifierValues,
        selfActions: [{ predicate: "assignedTo", itemRole: "from", selfAction: { label: "Kann ich", mine: "Dabei", qualifiers: ["can"], followUps: { field: "status", complete: { label: "Erledigt" }, release: "Raus" } } }],
      }],
    })

  it("erledigt: „✓ Lernt · ✓ Erledigt“", async () => {
    onlyCan()
    await render(task([{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: "learns" } }], "done"))
    expect(states()).toEqual(["Lernt", "Erledigt"])
  })

  it("offen: mein Wert steht als gedrückter Umschalter vor den Pills; Klick gibt ab", async () => {
    onlyCan()
    await render(task([{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: "learns" } }], "in-progress"))
    expect(pill("Lernt")?.getAttribute("aria-pressed")).toBe("true")
    expect(pill("Kann ich")?.getAttribute("aria-pressed")).toBe("false")
    await click(pill("Lernt"))
    expect((await saved())?.relations ?? []).toEqual([])
  })

  it("ein Wert, den keine Schicht kennt, zeigt den allgemeinen Zustand „Dabei“", async () => {
    onlyCan()
    await render(task([{ predicate: "assignedTo", target: `global:${ME}`, meta: { role: "foo" } }], "done"))
    expect(states()).toEqual(["Dabei", "Erledigt"])
  })
})
