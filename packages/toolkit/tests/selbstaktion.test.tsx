// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { deriveRelationRecordId, type Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { resolveTypePresentation } from "../src/components/preview/type-presentation"
import { renderTypeFooter } from "../src/components/preview/type-presentation"
import { ItemDetailRead } from "../src/components/host/detail-host"

/**
 * S2 auf den echten Flächen gegen den MockConnector: Menschen-Zeile (C1),
 * Selbstaktion (C2) und Stimme im Slot `actions` (C4).
 * Spec: shared-components → Item-Detail aus dem Register; 08 → Teilnahme am Event.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const TIMO = "u-timo"
const LENA = "u-lena"
const ULF = "u-ulf"

const EVENT: Item = {
  id: "e1",
  type: "event",
  createdBy: TIMO,
  createdAt: "2026-09-20T10:00:00.000Z",
  data: { title: "Ernten am Beet", start: "2099-07-19T16:00:00.000Z" },
  relations: [
    { predicate: "invited", target: `global:${LENA}` },
    { predicate: "invited", target: `global:${ULF}` },
  ],
}

const TASK: Item = {
  id: "t1",
  type: "task",
  createdBy: TIMO,
  createdAt: "2026-09-20T10:00:00.000Z",
  data: { title: "Kompost umsetzen", status: "open" },
  relations: [{ predicate: "assignedTo", target: `global:${TIMO}`, meta: { note: "bleibt" } }],
}

const record = (id: string, createdBy: string, subject: string, role: string): Item => ({
  id,
  type: "relation",
  createdBy,
  createdAt: "2026-09-27T10:00:00.000Z",
  data: { predicate: "attends", role, tense: "coming" },
  relations: [
    { predicate: "from", target: `global:${subject}` },
    { predicate: "to", target: "item:e1" },
  ],
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

async function render(node: (connector: MockConnector) => ReactNode, extra: Item[] = [], options: { allowFixtureAuthors?: boolean } = {}) {
  const items = [EVENT, TASK, ...extra]
  connector = new MockConnector(
    {
      items,
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [
        { id: ME, displayName: "Ich" },
        { id: TIMO, displayName: "Timo" },
        { id: LENA, displayName: "Lena" },
        { id: ULF, displayName: "Ulf" },
      ],
      groupMembers: { g: [ME, TIMO, LENA, ULF] },
      groupItems: { g: items.map((item) => item.id) },
    } as never,
    options,
  )
  await connector.init()
  connector.setCurrentGroup("g")
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, node(connector)))
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

const pill = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)
const textWithoutAvatar = (el: Element) => {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll("[data-avatar]").forEach((a) => a.remove())
  return copy.textContent?.replace(/\s+/g, " ").trim()
}
const chips = () => [...host.querySelectorAll("[data-person]")].map(textWithoutAvatar)

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe("Menschen-Zeile (C1, Lesen)", () => {
  it("führt Eingeladene und Zusagen in einer Zeile, mit „eingetragen von“; declined nur in „Alle“", async () => {
    const Meta = resolveTypePresentation("event").detail
    await render(() => createElement(Meta, { item: EVENT }), [
      record("rel-timo", TIMO, TIMO, "going"),
      record("rel-ulf-by-timo", TIMO, ULF, "maybe"),
      record("rel-lena", LENA, LENA, "declined"),
    ])
    expect(host.querySelectorAll("[data-meta-row]")).toHaveLength(2) // Menschen, Datum
    expect(chips()).toEqual(["Timo zugesagt", "Ulf vielleicht · eingetragen von Timo"])
    expect(host.textContent).not.toContain("Lena")
    await click(pill("Alle"))
    const all = [...host.querySelectorAll("[data-person-all]")].map(textWithoutAvatar)
    expect(all).toContain("Lena abgesagt")
  })
})

describe("Selbstaktion (C2)", () => {
  it("Event: neutral „Zusagen · Vielleicht · Absagen“, danach mein Zustand; Absagen bleibt als Record", async () => {
    const Actions = resolveTypePresentation("event").actions!
    await render(() => createElement(Actions, { item: EVENT }))
    expect(pill("Zusagen")?.getAttribute("aria-pressed")).toBe("false")
    expect(pill("Vielleicht")).toBeTruthy()
    expect(pill("Absagen")).toBeTruthy()

    await click(pill("Zusagen"))
    let mine = await connector.getRelationRecords({ predicate: "attends", from: `global:${ME}` })
    expect(mine).toHaveLength(1)
    expect(mine[0].fields).toEqual({ role: "going", tense: "coming" })
    expect(pill("Zugesagt")?.getAttribute("aria-pressed")).toBe("true")

    await click(pill("Absagen"))
    mine = await connector.getRelationRecords({ predicate: "attends", from: `global:${ME}` })
    expect(mine).toHaveLength(1)
    expect(mine[0].fields?.role).toBe("declined")
    expect(pill("Abgesagt")?.getAttribute("aria-pressed")).toBe("true")

    // Dieselbe Pill noch einmal: keine Aussage mehr.
    await click(pill("Abgesagt"))
    expect(await connector.getRelationRecords({ predicate: "attends", from: `global:${ME}` })).toHaveLength(0)
    expect(pill("Zusagen")?.getAttribute("aria-pressed")).toBe("false")
  })

  it("Aufgabe: „Mitmachen“ trägt mich in assignedTo ein und erhält meta bestehender Kanten", async () => {
    const Actions = resolveTypePresentation("task").actions!
    await render(() => createElement(Actions, { item: TASK }))
    // Timo steht schon an der Kante: „Mitmachen" statt „Übernehmen" (Spec 06, Regel 9).
    await click(pill("Mitmachen"))
    const saved = await connector.getItem("t1")
    expect(saved?.relations).toEqual([
      { predicate: "assignedTo", target: `global:${TIMO}`, meta: { note: "bleibt" } },
      { predicate: "assignedTo", target: `global:${ME}` },
    ])
  })

  it("ohne Verifikation (fail closed) täuscht die Zusage nichts vor: keine Pills", async () => {
    const Actions = resolveTypePresentation("event").actions!
    await render(() => createElement(Actions, { item: EVENT }), [], { allowFixtureAuthors: true })
    expect(pill("Zusagen")).toBeUndefined()
  })
})

describe("Stimme im Slot actions (C4)", () => {
  const STATEMENT: Item = {
    id: "s1",
    type: "statement",
    createdBy: TIMO,
    createdAt: "2026-09-20T10:00:00.000Z",
    data: { title: "Wir öffnen den Garten" },
  }

  it("steht im Detail unter dem Kopf, nicht mehr in der Fußzeile; die Karte behält ihre Fußzeile", async () => {
    await render(() => createElement(ItemDetailRead, { item: STATEMENT, actions: null, groupId: "g" }), [STATEMENT])
    const slot = host.querySelector('[data-slot="actions"]')
    expect(slot?.querySelector("[data-vote-actions]")).toBeTruthy()
    expect(pill("Dafür")).toBeTruthy()
    expect(renderTypeFooter(STATEMENT)).toBeNull()
    expect(resolveTypePresentation("statement").footer).toBeDefined()
  })
})

describe("Codex Runde 1: Selbstaktion schreibt gegen den geltenden Zustand", () => {
  it("Befund 1: ein eigener Record ohne gültiges Verdikt wird bei „Zusagen“ nicht gelöscht", async () => {
    const Actions = resolveTypePresentation("event").actions!
    // Der kanonische eigene Slot (08, Regel 4), aber ohne positives Verdikt.
    const id = await deriveRelationRecordId(ME, "attends", `global:${ME}`, "item:e1")
    const mineInvalid = record(id, ME, ME, "going")
    await render((c) => {
      c.verifyRecordClaim = (async (r: { id: string }) => (r.id === id ? "invalid" : "trusted")) as never
      return createElement(Actions, { item: EVENT })
    }, [mineInvalid])
    // Der ungültige Record zählt nicht: neutral.
    expect(pill("Zusagen")?.getAttribute("aria-pressed")).toBe("false")
    await click(pill("Zusagen"))
    const mine = await connector.getRelationRecords({ predicate: "attends", from: `global:${ME}` })
    expect(mine).toHaveLength(1)
    expect(mine[0].fields?.role).toBe("going")
  })

  it("Befund 2: zwei Klicks vor dem nächsten Render entscheiden gegeneinander und die Anzeige konvergiert", async () => {
    const Actions = resolveTypePresentation("event").actions!
    await render(() => createElement(Actions, { item: EVENT }))
    const zusagen = pill("Zusagen") as HTMLButtonElement
    await act(async () => {
      zusagen.click()
      zusagen.click()
    })
    await settle()
    expect(await connector.getRelationRecords({ predicate: "attends", from: `global:${ME}` })).toHaveLength(0)
    expect(pill("Zusagen")?.getAttribute("aria-pressed")).toBe("false")
  })

  it("Befund 3: ohne Schreibrecht im Space keine Pills (Modi, Regel 1)", async () => {
    const Actions = resolveTypePresentation("event").actions!
    await render((c) => {
      Object.assign(c, { can: () => false })
      return createElement(Actions, { item: EVENT })
    })
    expect(pill("Zusagen")).toBeUndefined()
  })

  it("eine Ablehnung des Connectors wird sichtbar, die Anzeige fällt zurück", async () => {
    const Actions = resolveTypePresentation("event").actions!
    await render((c) => {
      c.createRelationRecord = (async () => {
        throw new Error("Kein Schreibrecht")
      }) as never
      return createElement(Actions, { item: EVENT })
    })
    await click(pill("Zusagen"))
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Kein Schreibrecht")
    expect(pill("Zusagen")?.getAttribute("aria-pressed")).toBe("false")
  })
})

describe("Codex Runde 1, Befund 6: Qualifier und Sprecher sind zugänglich", () => {
  it("der Profil-Link nennt Qualifier und Sprecher", async () => {
    const Meta = resolveTypePresentation("event").detail
    await render(() => createElement(Meta, { item: EVENT }), [record("rel-ulf-by-timo", TIMO, ULF, "maybe")])
    const labels = [...host.querySelectorAll("[aria-label]")].map((el) => el.getAttribute("aria-label"))
    expect(labels).toContain("Profil von Ulf öffnen — vielleicht, eingetragen von Timo")
  })
})
