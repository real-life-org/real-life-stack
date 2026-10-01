// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { useItemEditor } from "../src/hooks/use-item-editor"
import { contentTypeFromRegister, mapComposerSubmission, itemToComposerData } from "../src/components/composer/content-types"
import { incomingRemovedKey, itemRelationDataKey } from "../src/components/composer/item-relations"
import { incomingHost } from "./support/form-host"

/**
 * S3b PR B: „Braucht" im Formular schreibbar. Die eingehende Kante `blocks`
 * liegt am ANDEREN Item; das Formular schreibt sie dort, nur mit Schreibrecht
 * an diesem Item — sonst bietet es das Item nicht an und lässt eine
 * bestehende Kante stehen (shared-components, Widget-Paare C3; Spec 06,
 * Regeln 6 und 10; Brief S3b Thema 5).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ME = "u-me"
const TIMO = "u-timo"

const item = (id: string, data: Record<string, unknown>, relations: Item["relations"] = [], createdBy = ME): Item => ({
  id, type: "task", createdBy, createdAt: "2026-09-20T10:00:00.000Z", data, relations,
})

const KOMPOST = item("t-kompost", { title: "Kompost umsetzen", status: "open" })
const KARRE = item("t-karre", { title: "Schubkarre reparieren", status: "open" }, [{ predicate: "blocks", target: "item:t-kompost" }])
const BEET = item("t-beet", { title: "Beetplan", status: "open" })
// Timos Aufgabe: Ich darf sie nicht bearbeiten (Autorisierung unten).
const TIMOS = item("t-timo", { title: "Timos Werkzeug", status: "open" }, [{ predicate: "blocks", target: "item:t-kompost" }], TIMO)
const TIMOS_FREI = item("t-timo2", { title: "Timos Saatgut", status: "open" }, [], TIMO)

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

async function setup(items: Item[] = [KOMPOST, KARRE, BEET, TIMOS, TIMOS_FREI], open = "g") {
  connector = new MockConnector(
    {
      items,
      groups: [{ id: "g", name: "Garten", data: {} }, { id: "h", name: "Hof", data: {} }],
      users: [{ id: ME, displayName: "Ich" }, { id: TIMO, displayName: "Timo" }],
      groupMembers: { g: [ME, TIMO], h: [ME] },
      groupItems: { g: items.map((i) => i.id), h: [] },
    } as never,
    { allowFixtureAuthors: true },
  )
  await connector.init()
  connector.setCurrentGroup(open)
  // Autorisierung: fremde Aufgaben sind nicht bearbeitbar.
  Object.assign(connector, { can: (action: string, target?: Item) => !(action === "item/edit" && target?.createdBy === TIMO) })
}

async function render(node: ReactNode) {
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: connector as never }, node))
  })
  await settle()
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

describe("Register → Formular", () => {
  it("die Aufgabe führt Braucht als eingehendes Feld vor Ermöglicht und Teil von", () => {
    expect(contentTypeFromRegister("task").itemRelations).toEqual([
      { predicate: "blocks", label: "Braucht", placeholder: "@ Aufgabe suchen…", targetType: "task", incoming: true },
      { predicate: "blocks", label: "Ermöglicht", placeholder: "@ Aufgabe suchen…", targetType: "task" },
      { predicate: "partOf", label: "Teil von", placeholder: "@ Projekt suchen…", targetType: "project" },
    ])
  })

  it("Abbildung: Braucht wird keine Relation und kein data, sondern eine Änderung am anderen Item", () => {
    const initial = itemToComposerData(KOMPOST)
    // Die Vorbelegung liest das Feld live, nicht aus dem Item.
    expect(initial).not.toHaveProperty(itemRelationDataKey("blocks", true))
    const mapped = mapComposerSubmission(
      {
        contentType: "task",
        isPublic: false,
        data: { ...initial, [itemRelationDataKey("blocks", true)]: ["item:t-beet"], [incomingRemovedKey("blocks")]: ["item:t-karre"] },
      } as never,
      { mode: "edit", existingItem: KOMPOST },
    )!
    expect(mapped.incoming).toEqual([{ predicate: "blocks", add: ["item:t-beet"], remove: ["item:t-karre"] }])
    expect(mapped.data).not.toHaveProperty(itemRelationDataKey("blocks", true))
    expect(mapped.data).not.toHaveProperty(incomingRemovedKey("blocks"))
    expect(mapped.relations ?? []).not.toContainEqual(expect.objectContaining({ target: "item:t-beet" }))
  })
})

describe("Widget: IncomingRelationField", () => {
  function Harness({ itemId, spaceId, onValue }: { itemId?: string; spaceId: string; onValue: (added: string[], removed: string[]) => void }) {
    return incomingHost({ label: "Braucht", predicate: "blocks", targetType: "task", itemId, spaceId, onValue })
  }

  const chips = () => [...host.querySelectorAll("[data-relation-chip]")].map((c) => c.getAttribute("data-relation-chip"))

  async function type(text: string) {
    const input = host.querySelector<HTMLInputElement>('[data-item-relation-field="blocks"] input')!
    await act(async () => {
      input.focus()
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, text)
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await settle()
    return [...host.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim())
  }

  it("zeigt die bestehenden Quellen; ohne Schreibrecht dort ohne ✕", async () => {
    await setup()
    let last: [string[], string[]] = [[], []]
    await render(createElement(Harness, { itemId: "t-kompost", spaceId: "g", onValue: (a, r) => (last = [a, r]) }))
    expect(chips()).toEqual(["t-karre", "t-timo"])
    expect(host.querySelector('[aria-label="Schubkarre reparieren entfernen"]')).toBeTruthy()
    expect(host.querySelector('[aria-label="Timos Werkzeug entfernen"]')).toBeNull()
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Schubkarre reparieren entfernen"]')!.click())
    expect(last).toEqual([[], ["item:t-karre"]])
    expect(chips()).toEqual(["t-timo"])
  })

  it("bietet nur Aufgaben an, die ich bearbeiten darf, nie das Item selbst", async () => {
    await setup()
    let last: [string[], string[]] = [[], []]
    await render(createElement(Harness, { itemId: "t-kompost", spaceId: "g", onValue: (a, r) => (last = [a, r]) }))
    const options = await type("")
    expect(options).toContain("Beetplan")
    expect(options).not.toContain("Timos Saatgut")
    expect(options).not.toContain("Kompost umsetzen")
    const input = host.querySelector<HTMLInputElement>('[data-item-relation-field="blocks"] input')!
    await type("beet")
    await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect(last).toEqual([["item:t-beet"], []])
  })

  it("außerhalb des geöffneten Space sagt das Feld, warum es nichts anbietet", async () => {
    await setup(undefined, "g")
    await render(createElement(Harness, { spaceId: "h", onValue: () => {} }))
    expect(host.querySelector('[data-item-relation-field="blocks"] input')).toBeNull()
    expect(host.querySelector("[data-incoming-unavailable]")?.textContent).toContain("geöffneten Space")
  })
})

describe("Speichern schreibt die Kante am anderen Item", () => {
  let submit: ReturnType<typeof useItemEditor>["submit"] | undefined
  function Probe(): ReactNode {
    submit = useItemEditor({ currentUserId: ME, mapSubmission: mapComposerSubmission }).submit
    return null
  }

  it("Bearbeiten: hinzufügen und entfernen an den Quellen, das Item selbst bleibt", async () => {
    await setup()
    await render(createElement(Probe))
    const saved = await act(async () =>
      submit!(
        { contentType: "task", isPublic: false, data: { ...itemToComposerData(KOMPOST), group: "g", [itemRelationDataKey("blocks", true)]: ["item:t-beet"], [incomingRemovedKey("blocks")]: ["item:t-karre"] } } as never,
        { existingItem: KOMPOST },
      ),
    )
    expect(saved).toBeTruthy()
    expect((await connector.getItem("t-beet"))?.relations).toEqual([{ predicate: "blocks", target: "item:t-kompost" }])
    expect((await connector.getItem("t-karre"))?.relations ?? []).toEqual([])
    expect((await connector.getItem("t-kompost"))?.relations ?? []).toEqual([])
  })

  it("Anlegen: die neue Aufgabe steht danach bei der Quelle", async () => {
    await setup()
    await render(createElement(Probe))
    const created = await act(async () =>
      submit!({ contentType: "task", isPublic: false, data: { title: "Neu", group: "g", [itemRelationDataKey("blocks", true)]: ["item:t-beet"] } } as never),
    )
    expect(created).toBeTruthy()
    expect((await connector.getItem("t-beet"))?.relations).toEqual([{ predicate: "blocks", target: `item:${created!.id}` }])
  })

  it("ohne Schreibrecht an der Quelle scheitert das Speichern mit Grund und schreibt dort nichts", async () => {
    await setup()
    await render(createElement(Probe))
    let reason: Error | undefined
    const saved = await act(async () =>
      submit!(
        { contentType: "task", isPublic: false, data: { ...itemToComposerData(KOMPOST), group: "g", [itemRelationDataKey("blocks", true)]: ["item:t-timo2"] } } as never,
        { existingItem: KOMPOST, onError: (e) => (reason = e) },
      ),
    )
    expect(saved).toBeNull()
    expect(reason?.message).toContain("Timos Saatgut")
    expect((await connector.getItem("t-timo2"))?.relations ?? []).toEqual([])
  })
})

describe("Codex Runde 1", () => {
  let submit: ReturnType<typeof useItemEditor>["submit"] | undefined
  function Probe(): ReactNode {
    submit = useItemEditor({ currentUserId: ME, mapSubmission: mapComposerSubmission }).submit
    return null
  }

  it("Befund 1: Formular-Space ≠ geöffneter Space — nichts an einer Quelle schreiben, Grund nennen", async () => {
    await setup(undefined, "h")
    await render(createElement(Probe))
    let reason: Error | undefined
    const created = await act(async () =>
      submit!(
        { contentType: "task", isPublic: false, data: { title: "Neu", group: "g", [itemRelationDataKey("blocks", true)]: ["item:t-beet"] } } as never,
        { onError: (e) => (reason = e) },
      ),
    )
    expect(created).toBeNull()
    expect(reason?.message).toContain("geöffneten Space")
    connector.setCurrentGroup("g")
    expect((await connector.getItem("t-beet"))?.relations ?? []).toEqual([])
  })

  it("Befund 2: eine space-qualifizierte Kante lässt sich entfernen", async () => {
    const quali = item("t-quali", { title: "Qualifiziert", status: "open" }, [{ predicate: "blocks", target: "space:g/item:t-kompost" }])
    await setup([KOMPOST, quali])
    await render(createElement(Probe))
    const saved = await act(async () =>
      submit!(
        { contentType: "task", isPublic: false, data: { ...itemToComposerData(KOMPOST), group: "g", [incomingRemovedKey("blocks")]: ["item:t-quali"] } } as never,
        { existingItem: KOMPOST },
      ),
    )
    expect(saved).toBeTruthy()
    expect((await connector.getItem("t-quali"))?.relations ?? []).toEqual([])
  })

  it("Befund 4: außerhalb des geöffneten Space sind bestehende Quellen fest (ohne ✕)", async () => {
    await setup(undefined, "h")
    await render(
      incomingHost({ label: "Braucht", predicate: "blocks", targetType: "task", itemId: "t-kompost", spaceId: "g" }),
    )
    expect(host.querySelector("[data-incoming-unavailable]")).toBeTruthy()
    expect(host.querySelectorAll('[data-relation-chip] button[aria-label$="entfernen"]').length).toBe(0)
  })
})

describe("CodeRabbit: Vorprüfung aller Quellen", () => {
  let submit: ReturnType<typeof useItemEditor>["submit"] | undefined
  function Probe(): ReactNode {
    submit = useItemEditor({ currentUserId: ME, mapSubmission: mapComposerSubmission }).submit
    return null
  }
  it("eine Quelle ohne Schreibrecht verhindert auch die Schreibvorgänge an den anderen", async () => {
    await setup()
    await render(createElement(Probe))
    const saved = await act(async () =>
      submit!(
        { contentType: "task", isPublic: false, data: { ...itemToComposerData(KOMPOST), group: "g", [itemRelationDataKey("blocks", true)]: ["item:t-beet", "item:t-timo2"] } } as never,
        { existingItem: KOMPOST },
      ),
    )
    expect(saved).toBeNull()
    expect((await connector.getItem("t-beet"))?.relations ?? []).toEqual([])
  })
})

describe("Codex Runde 2", () => {
  let submit: ReturnType<typeof useItemEditor>["submit"] | undefined
  function Probe(): ReactNode {
    submit = useItemEditor({ currentUserId: ME, mapSubmission: mapComposerSubmission }).submit
    return null
  }
  it("Befund 2: bei unbekanntem Space bleibt eine qualifizierte Kante in einen anderen Space stehen", async () => {
    const qualified = { predicate: "blocks", target: "space:h/item:t-kompost" }
    const source = item("t-beet", { title: "Quelle", status: "open" }, [{ predicate: "blocks", target: "item:t-kompost" }, qualified])
    await setup([KOMPOST, source])
    Object.assign(connector, { getItemGroupId: () => null })
    await render(createElement(Probe))
    const result = await act(async () =>
      submit!({ contentType: "task", isPublic: false, data: { ...itemToComposerData(KOMPOST), [incomingRemovedKey("blocks")]: ["item:t-beet"] } } as never, { existingItem: KOMPOST }),
    )
    expect(result).toBeTruthy()
    expect((await connector.getItem("t-beet"))?.relations).toEqual([qualified])
  })
})
