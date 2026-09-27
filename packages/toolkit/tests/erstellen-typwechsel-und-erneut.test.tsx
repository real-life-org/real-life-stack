// @vitest-environment jsdom
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { ItemComposer } from "../src/components/composer/item-composer"
import { mapComposerSubmission, pickContentTypes } from "../src/components/composer/content-types"

/**
 * #522: Beim Typwechsel im Erstellen (Beitrag → Event) trägt das Feld „Wer“
 * die Teilnahme-Zustände des neuen Typs.
 * #523: „Erneut“ nach teilweise erfolgreichem Speichern legt kein zweites
 * Item an, sondern setzt am angelegten fort.
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

const ME = "u-me"
const TIMO = "u-timo"

let host: HTMLDivElement
let root: Root
let connector: MockConnector
const onDone = vi.fn()

beforeEach(async () => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  onDone.mockReset()
  connector = new MockConnector({
    items: [],
    groups: [{ id: "g", name: "Garten", data: {} }],
    users: [{ id: ME, displayName: "Ich" }, { id: TIMO, displayName: "Timo" }],
    groupMembers: { g: [ME, TIMO] },
    groupItems: { g: [] },
  } as never)
  await connector.init()
  connector.setCurrentGroup("g")
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 10)) }) }
const button = (text: string) => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === text)
const toggle = (name: string) => [...host.querySelectorAll<HTMLButtonElement>("[data-qualifier-toggle]")].find((b) => b.getAttribute("aria-label")?.startsWith(name))

async function renderComposer(initialContentType: string) {
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, createElement(ItemComposer, {
      contentTypes: pickContentTypes("post", "event"),
      initialContentType,
      mapper: mapComposerSubmission,
      composerProps: { peopleOptions: [{ id: ME, name: "Ich" }, { id: TIMO, name: "Timo" }], peopleQuickSuggestions: [{ id: TIMO, name: "Timo" }] },
      onDone,
      onCancel: () => {},
    })))
  })
  await settle()
}

async function chooseType(label: string) {
  const trigger = host.querySelector<HTMLElement>('button[aria-label^="Typ wählen"]')!
  await act(async () => {
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
  const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find((el) => el.textContent?.includes(label))!
  await act(async () => item.click())
  await settle()
}

async function typeTitle(text: string) {
  const input = host.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')!
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    setter.call(input, text)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

describe("#522 Typwechsel im Erstellen", () => {
  it("Beitrag → Event: „Wer“ zeigt Zustände und schaltet um", async () => {
    await renderComposer("post")
    await chooseType("Event")
    await act(async () => button("Timo")!.click())
    expect(host.textContent).toContain("Chip antippen wechselt: eingeladen · zugesagt · vielleicht · abgesagt")
    expect(toggle("Timo")?.textContent).toBe("eingeladen")
    await act(async () => toggle("Timo")!.click())
    expect(toggle("Timo")?.textContent).toBe("zugesagt")
  })
})

describe("#523 Erneut nach teilweise erfolgreichem Speichern", () => {
  it("legt genau ein Item an und schreibt beim zweiten Versuch nur die Aussage", async () => {
    await renderComposer("event")
    await typeTitle("Ernten")
    await act(async () => button("Timo")!.click())
    await act(async () => toggle("Timo")!.click()) // zugesagt
    const create = connector.createRelationRecord.bind(connector)
    let failOnce = true
    connector.createRelationRecord = (async (input: never) => {
      if (failOnce) {
        failOnce = false
        throw new Error("Relay nicht erreichbar")
      }
      return create(input)
    }) as never
    await act(async () => button("Erstellen")!.click())
    await settle()
    expect(host.querySelector('[data-slot="save-error"]')).toBeTruthy()
    expect((await connector.getItems({ type: "event" })).length).toBe(1)

    await act(async () => button("Erneut")!.click())
    await settle()
    const events = await connector.getItems({ type: "event" })
    expect(events).toHaveLength(1)
    const aboutTimo = await connector.getRelationRecords({ predicate: "attends", from: `global:${TIMO}` })
    expect(aboutTimo).toHaveLength(1)
    expect(aboutTimo[0].to).toBe(`item:${events[0].id}`)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
