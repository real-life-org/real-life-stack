// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"
import { ConnectorProvider } from "../src/hooks/connector-context"

vi.mock("../src/components/host/create-host", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/components/host/create-host")>()),
  useOptionalCreate: () => ({ isComposing: false, startCreate: () => {}, patchCreate: () => {} }),
}))

const { ItemDetailView } = await import("../src/components/detail/item-detail-view")
const { contentTypeFromRegister, itemToComposerData, mapComposerSubmission, pickContentTypes } = await import("../src/components/composer/content-types")
const { peopleStatementKey } = await import("../src/components/composer/people-relations")
const { PeopleWidget } = await import("../src/components/composer/widgets/people-widget")

/**
 * Befund Anton zu #518: Das Event-Formular hat EIN Personenfeld „Wer“, das
 * `invited` (eingebettet, „eingeladen“) und `attends` (Record) vereint.
 * Antippen wechselt eingeladen → zugesagt → vielleicht → abgesagt; für eine
 * andere Person schreibt das eine stellvertretende Aussage, für mich meine
 * Selbstaussage (08 → Teilnahme am Event; shared-components, Edit-Regeln 6).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const TIMO = "u-timo"
const LENA = "u-lena"

const EVENT: Item = {
  id: "e1", type: "event", createdBy: ME, createdAt: "2026-09-20T10:00:00.000Z",
  data: { title: "Ernten", start: "2099-07-19T16:00:00.000Z" },
  relations: [{ predicate: "invited", target: `global:${TIMO}` }, { predicate: "invited", target: `global:${LENA}` }],
}
const lenaSelf: Item = {
  id: "rel-lena", type: "relation", createdBy: LENA, createdAt: "2026-09-27T10:00:00.000Z",
  data: { predicate: "attends", role: "maybe", tense: "coming" },
  relations: [{ predicate: "from", target: `global:${LENA}` }, { predicate: "to", target: "item:e1" }],
}

describe("Register → Formular", () => {
  it("event: ein Feld „Wer“ mit den Zuständen aus dem Register", () => {
    expect(contentTypeFromRegister("event").peopleRelations).toEqual([
      {
        predicate: "invited",
        label: "Wer",
        placeholder: "Einladen…",
        record: {
          predicate: "attends",
          key: "role",
          base: { id: "invited", label: "eingeladen" },
          values: [
            { id: "going", label: "zugesagt" },
            { id: "maybe", label: "vielleicht" },
            { id: "declined", label: "abgesagt" },
          ],
        },
      },
    ])
    // Aufgabe: im Kern kein Qualifier, also kein Zustand.
    expect(contentTypeFromRegister("task").peopleRelations?.[0].record).toBeUndefined()
  })

  it("der Mapper macht aus den Änderungen Aussagen und schreibt nichts davon in item.data", () => {
    const result = mapComposerSubmission(
      { contentType: "event", data: { title: "E", people: [TIMO], [peopleStatementKey("people")]: { [TIMO]: "going", [LENA]: "invited", x: null } } } as never,
      { mode: "edit", existingItem: EVENT },
    )!
    expect(result.data).not.toHaveProperty(peopleStatementKey("people"))
    expect(result.relations).toEqual([{ predicate: "invited", target: `global:${TIMO}` }])
    expect(result.statements).toEqual([
      { predicate: "attends", from: `global:${TIMO}`, key: "role", value: "going" },
      { predicate: "attends", from: `global:${LENA}`, key: "role", value: null },
      { predicate: "attends", from: "global:x", key: "role", value: null },
    ])
  })
})

describe("PeopleWidget mit Zuständen", () => {
  it("zeigt „Name · Zustand“, schaltet im Kreis und nennt die Reihenfolge im Hinweis; fremde Selbstaussage ist fest", async () => {
    const onChanges = vi.fn()
    const host = document.createElement("div")
    const root = createRoot(host)
    await act(async () => {
      root.render(createElement(PeopleWidget, {
        value: [TIMO, LENA], onChange: () => {}, label: "Wer",
        options: [{ id: TIMO, name: "Timo" }, { id: LENA, name: "Lena" }],
        record: {
          base: { id: "invited", label: "eingeladen" },
          values: [{ id: "going", label: "zugesagt" }, { id: "maybe", label: "vielleicht" }, { id: "declined", label: "abgesagt" }],
          live: { [LENA]: { state: "maybe", locked: true } },
          changes: {},
          onChangesChange: onChanges,
        },
      }))
    })
    expect(host.textContent).toContain("Chip antippen wechselt: eingeladen · zugesagt · vielleicht · abgesagt")
    const toggles = [...host.querySelectorAll<HTMLButtonElement>("[data-qualifier-toggle]")]
    expect(toggles.map((t) => t.textContent)).toEqual(["eingeladen", "vielleicht"])
    expect(toggles[1].disabled).toBe(true)
    await act(async () => toggles[0].click())
    expect(onChanges).toHaveBeenCalledWith({ [TIMO]: "going" })
    await act(async () => root.unmount())
  })
})

describe("Event bearbeiten gegen den MockConnector", () => {
  let host: HTMLDivElement
  let root: Root
  let connector: MockConnector
  beforeEach(() => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  it("Timo auf zugesagt setzen schreibt meine Aussage über Timo; ich selbst sage per Chip zu", async () => {
    connector = new MockConnector({
      items: [EVENT, lenaSelf],
      groups: [{ id: "g", name: "Garten", data: {} }],
      users: [{ id: ME, displayName: "Ich" }, { id: TIMO, displayName: "Timo" }, { id: LENA, displayName: "Lena" }],
      groupMembers: { g: [ME, TIMO, LENA] },
      groupItems: { g: [EVENT.id, lenaSelf.id] },
    } as never)
    await connector.init()
    connector.setCurrentGroup("g")
    const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)) }) }
    await act(async () => {
      root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(ItemDetailView, {
        itemId: EVENT.id, mode: "edit", onModeChange: () => {},
        contentTypes: pickContentTypes("event"), mapper: mapComposerSubmission, editInitialData: itemToComposerData,
        onClose: () => {}, renderRead: () => null,
        composerProps: { peopleOptions: [{ id: ME, name: "Ich" }, { id: TIMO, name: "Timo" }, { id: LENA, name: "Lena" }] },
      })))
    })
    await settle()
    const toggle = (name: string) =>
      [...host.querySelectorAll<HTMLButtonElement>("[data-qualifier-toggle]")].find((b) => b.getAttribute("aria-label")?.startsWith(name))
    expect(toggle("Lena")?.textContent).toBe("vielleicht")
    expect(toggle("Lena")?.disabled).toBe(true)
    await act(async () => toggle("Timo")!.click())
    expect(toggle("Timo")?.textContent).toBe("zugesagt")
    const save = [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Speichern")!
    await act(async () => save.click())
    await settle()
    const aboutTimo = await connector.getRelationRecords({ predicate: "attends", from: `global:${TIMO}` })
    expect(aboutTimo).toHaveLength(1)
    expect(aboutTimo[0]).toMatchObject({ createdBy: ME, fields: { role: "going" } })
    // Lenas eigene Aussage bleibt unangetastet.
    expect((await connector.getRelationRecords({ predicate: "attends", from: `global:${LENA}` }))[0].createdBy).toBe(LENA)
  })
})
