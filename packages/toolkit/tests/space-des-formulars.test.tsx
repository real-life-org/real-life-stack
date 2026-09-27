// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { composeTypeManifest, TOOLKIT_TYPE_LAYER, type DataInterface, type Item } from "@real-life-stack/data-interface"
import { MockConnector } from "@real-life-stack/mock-connector"

import { ConnectorProvider } from "../src/hooks/connector-context"
import { ItemComposer } from "../src/components/composer/item-composer"
import { ItemRelationWidget } from "../src/components/composer/widgets/item-relation-widget"
import { contentTypeFromRegister, mapComposerSubmission } from "../src/components/composer/content-types"
import { withCreateGroup, withEditGroup, withGroupOptions, GROUP_FIXED_NO_SCOPE } from "../src/components/composer/composer-mapping"
import { itemHasBindings, ITEM_BINDINGS_REASON } from "../src/lib/item-bindings"
import { ItemDetailView } from "../src/components/detail/item-detail-view"
import { setTypeManifest } from "../src/components/preview/type-presentation"

/**
 * S3b PR A: Space des Formulars (shared-components → Space des Formulars,
 * Regeln 1–8) auf dem Vertrag GroupScopeCapable (02, 03).
 */

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
setTypeManifest(composeTypeManifest([TOOLKIT_TYPE_LAYER]))
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
}))

const ME = "u-me"
const HOFI = "u-hofi"
const item = (id: string, type: string, data: Record<string, unknown>, relations: Item["relations"] = [], tags?: string[]): Item => ({
  id, type, createdBy: ME, createdAt: "2026-09-20T10:00:00.000Z", data, relations, ...(tags ? { tags } : {}),
})
const IN_G = item("t-g", "task", { title: "Im Garten", status: "open" }, [], ["beet"])
const IN_H = item("t-h", "task", { title: "Im Hof", status: "open" }, [], ["pflaster"])

let host: HTMLDivElement
let root: Root
let connector: MockConnector

async function settle() {
  for (let round = 0; round < 6; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

function makeConnector(items: Item[] = [IN_G, IN_H], groupItems: Record<string, string[]> = { g: ["t-g"], h: ["t-h"] }, fixture = true) {
  return new MockConnector(
    {
      items,
      groups: [{ id: "g", name: "Garten", data: {} }, { id: "h", name: "Hof", data: {} }],
      users: [{ id: ME, displayName: "Ich" }, { id: HOFI, displayName: "Hofi" }],
      groupMembers: { g: [ME], h: [ME, HOFI] },
      groupItems,
    } as never,
    { allowFixtureAuthors: fixture },
  )
}

/** Derselbe Connector ohne die Zusage GroupScopeCapable — ein Fremd-Connector, der `group` übergeht. */
function withoutScope(c: MockConnector): DataInterface {
  return new Proxy(c, {
    get(target, key, receiver) {
      if (key === "groupScope") return undefined
      const value = Reflect.get(target, key, receiver)
      return typeof value === "function" ? value.bind(target) : value
    },
    has(target, key) {
      return key === "groupScope" ? false : Reflect.has(target, key)
    },
  }) as unknown as DataInterface
}

async function render(node: ReactNode, c: DataInterface = connector) {
  await act(async () => {
    root.render(createElement(ConnectorProvider, { connector: c as never }, node))
  })
  await settle()
}

async function type(text: string, field = "[data-item-relation-field] input") {
  const input = host.querySelector<HTMLInputElement>(field)!
  await act(async () => {
    input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await settle()
  return [...host.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim())
}

beforeEach(async () => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  connector = makeConnector()
  await connector.init()
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

describe("#529: Suche im Formular-Space ohne App-Wechsel (Regel 3, 02 → group)", () => {
  it("sucht im Formular-Space, während ein anderer geöffnet ist, und wechselt ihn nicht", async () => {
    connector.setCurrentGroup("g")
    await render(createElement(ItemRelationWidget, { label: "Ermöglicht", predicate: "blocks", targetType: "task", value: [], onChange: () => {}, spaceId: "h" }))
    expect(host.querySelector("[data-other-space]")).toBeNull()
    expect(await type("")).toEqual(["Im Hof"])
    expect(connector.getCurrentGroup()?.id).toBe("g")
  })

  it("der Modul-Pick prüft gegen den Formular-Space, nicht den geöffneten", async () => {
    connector.setCurrentGroup("g")
    let onPick: ((id: string) => { ok: boolean }) | undefined
    await render(createElement(ItemRelationWidget, {
      label: "Ermöglicht", predicate: "blocks", targetType: "task", value: [], onChange: () => {}, spaceId: "h",
      requestItemPick: (_r, cb) => { onPick = cb },
    }))
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Im Modul wählen"))!.click())
    let hof: { ok: boolean } | undefined
    let garten: { ok: boolean } | undefined
    await act(async () => { hof = onPick!("t-h") })
    await act(async () => { garten = onPick!("t-g") })
    expect(hof?.ok).toBe(true)
    expect(garten?.ok).toBe(false)
  })

  it("ohne GroupScopeCapable sagt das Feld, dass es dort nicht suchen kann (Regel 7)", async () => {
    connector.setCurrentGroup("g")
    await render(createElement(ItemRelationWidget, { label: "Ermöglicht", predicate: "blocks", targetType: "task", value: [], onChange: () => {}, spaceId: "h" }), withoutScope(connector))
    const field = host.querySelector("[data-item-relation-field]")
    expect(field?.querySelector("input")).toBeNull()
    expect(field?.querySelector("[data-other-space]")?.textContent).toContain("Hof")
  })
})

describe("Anlegen in einem Schritt (Regel 6, 02 → Anlegen in einem bestimmten Space)", () => {
  const types = () => withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], "g")

  async function createIn(space: string, c: DataInterface) {
    const onDone = vi.fn()
    await render(createElement(ItemComposer, {
      contentTypes: types(), initialContentType: "task", mapper: mapComposerSubmission,
      initialData: { group: space }, onDone, onCancel: () => {},
    }), c)
    const title = host.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Neu")
      title.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Erstellen")!.click())
    await settle()
    return onDone
  }

  it("legt mit createItem(item, { group }) im Formular-Space an, nie über moveItemToGroup", async () => {
    connector.setCurrentGroup("g")
    const create = vi.spyOn(connector, "createItem")
    const move = vi.spyOn(connector, "moveItemToGroup")
    const onDone = await createIn("h", connector)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: "task" }), { group: "h" })
    expect(move).not.toHaveBeenCalled()
    const saved = onDone.mock.calls[0]![0] as Item
    expect(connector.getItemGroupId(saved.id)).toBe("h")
    expect(connector.getCurrentGroup()?.id).toBe("g")
  })

  it("ohne GroupScopeCapable legt es in einem fremden Space nicht an und täuscht nichts vor", async () => {
    connector.setCurrentGroup("g")
    const move = vi.spyOn(connector, "moveItemToGroup")
    const onDone = await createIn("h", withoutScope(connector))
    expect(onDone).not.toHaveBeenCalled()
    expect(move).not.toHaveBeenCalled()
    expect(host.querySelector('[data-slot="save-error"]')).not.toBeNull()
    expect((await connector.getItems({ type: "task", group: "h" })).map(({ id }) => id)).toEqual(["t-h"])
    expect((await connector.getItems({ type: "task", group: "g" })).map(({ id }) => id)).toEqual(["t-g"])
  })

  it("withCreateGroup: ohne Zusage nur der Space, in dem der Connector ohne group anlegt", () => {
    const offered = types()
    expect(withCreateGroup(offered, true, "g")).toBe(offered)
    const fixed = withCreateGroup(offered, false, "g")
    expect(fixed[0]!.groupOptions?.map((o) => o.id)).toEqual(["g"])
    expect(fixed[0]!.groupFixedReason).toBe(GROUP_FIXED_NO_SCOPE)
    // Übersicht ohne Zusage: welcher Space, bestimmt der Connector — keine Auswahl.
    expect(withCreateGroup(offered, false, undefined)[0]!.groupOptions).toBeUndefined()
  })
})

describe("Pflicht nur beim Anlegen (Regel 8)", () => {
  const options = [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }]
  it("beim Erstellen ohne Space: markiert und Speichern gesperrt", async () => {
    await render(createElement(ItemComposer, {
      contentTypes: [{ ...contentTypeFromRegister("task"), groupOptions: options }], initialContentType: "task",
      mapper: mapComposerSubmission, initialData: { title: "T" }, onDone: () => {}, onCancel: () => {},
    }))
    expect(host.querySelector('button[aria-label^="Space wählen"]')?.getAttribute("aria-invalid")).toBe("true")
    expect([...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Erstellen")?.disabled).toBe(true)
  })

  it("beim Bearbeiten ohne bekannten Space: nicht markiert, speicherbar", async () => {
    const existing = item("t-x", "task", { title: "X", status: "open" })
    await render(createElement(ItemComposer, {
      contentTypes: [{ ...contentTypeFromRegister("task"), groupOptions: options }], initialContentType: "task", existingItem: existing,
      mapper: mapComposerSubmission, initialData: { title: "X" }, onDone: () => {}, onCancel: () => {},
    }))
    expect(host.querySelector('button[aria-label^="Space wählen"]')?.getAttribute("aria-invalid")).toBeNull()
    expect([...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Speichern")?.disabled).toBe(false)
  })
})

describe("Ein Item mit Beziehungen bleibt in seinem Space (Regel 5)", () => {
  const T = item("t", "task", { title: "T" })
  it("itemHasBindings: Item-Kanten und feste Verweise in beiden Richtungen, Records und Kommentare", () => {
    expect(itemHasBindings(T, [T])).toBe(false)
    // Personen-Kanten und Tags zählen nicht.
    expect(itemHasBindings({ ...T, relations: [{ predicate: "assignedTo", target: `global:${ME}` }], tags: ["x"] }, [])).toBe(false)
    // ausgehend eingebettet, auch space-qualifiziert
    expect(itemHasBindings({ ...T, relations: [{ predicate: "blocks", target: "item:u" }] }, [])).toBe(true)
    expect(itemHasBindings({ ...T, relations: [{ predicate: "partOf", target: "space:g/item:p" }] }, [])).toBe(true)
    // eingehend eingebettet
    expect(itemHasBindings(T, [T, item("u", "task", {}, [{ predicate: "blocks", target: "item:t" }])])).toBe(true)
    // Record (Stimme, Zusage) — auch der eigene
    const vote = item("r", "relation", { predicate: "votesOn" }, [{ predicate: "from", target: `global:${ME}` }, { predicate: "to", target: "item:t" }])
    expect(itemHasBindings(T, [T, vote])).toBe(true)
    // Kommentar und Reaktion
    expect(itemHasBindings(T, [item("c", "comment", {}, [{ predicate: "commentOn", target: "item:t" }])])).toBe(true)
    expect(itemHasBindings(T, [item("x", "reaction", {}, [{ predicate: "reactsTo", target: "item:t" }])])).toBe(true)
    // fester Item-Verweis (variantOf) in beiden Richtungen
    const S = item("s", "statement", { title: "S" })
    expect(itemHasBindings({ ...S, data: { title: "V", variantOf: "item:o" } }, [])).toBe(true)
    expect(itemHasBindings(S, [S, item("v", "statement", { title: "V", variantOf: "item:s" })])).toBe(true)
    // Ein anderes Item ohne Bezug zählt nicht.
    expect(itemHasBindings(T, [T, item("u", "task", {}, [{ predicate: "blocks", target: "item:w" }])])).toBe(false)
  })

  it("withEditGroup: mit Beziehungen fest auf dem Space des Items, mit Grund", () => {
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], undefined)
    const typesOn = types.map((t) => ({ ...t, defaultGroup: "h" }))
    expect(withEditGroup(typesOn, true)).toBe(typesOn)
    const locked = withEditGroup(typesOn, true, ITEM_BINDINGS_REASON)
    expect(locked[0]!.groupOptions?.map((o) => o.id)).toEqual(["h"])
    expect(locked[0]!.groupFixedReason).toBe(ITEM_BINDINGS_REASON)
  })

  it("im Bearbeiten: eine eingehende Kante macht die Space-Auswahl fest, ohne Speichern zu sperren", async () => {
    const blocker = item("t-b", "task", { title: "Blocker" }, [{ predicate: "blocks", target: "item:t-h" }])
    connector = makeConnector([IN_G, IN_H, blocker], { g: ["t-g"], h: ["t-h", "t-b"] })
    await connector.init()
    connector.setCurrentGroup("h")
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], "h")
    await render(createElement(ItemDetailView, {
      itemId: "t-h", mode: "edit", renderRead: () => null, contentTypes: types, mapper: mapComposerSubmission,
      editInitialData: (i: Item) => ({ title: String(i.data.title) }), onClose: () => {},
    }))
    expect(host.querySelector('button[aria-label^="Space wählen"]')).toBeNull()
    const fixed = host.querySelector('[data-slot="composer-space"]')
    expect(fixed?.textContent).toContain("Hof")
    expect(fixed?.textContent).toContain(ITEM_BINDINGS_REASON)
    expect([...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Speichern")?.disabled).toBe(false)
  })

  it("im Bearbeiten ohne Beziehungen bleibt der Space wählbar", async () => {
    connector.setCurrentGroup("h")
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], "h")
    await render(createElement(ItemDetailView, {
      itemId: "t-h", mode: "edit", renderRead: () => null, contentTypes: types, mapper: mapComposerSubmission,
      editInitialData: (i: Item) => ({ title: String(i.data.title) }), onClose: () => {},
    }))
    expect(host.querySelector('button[aria-label^="Space wählen"]')).not.toBeNull()
  })

  it("beim Anlegen: fest, sobald eine Item-Kante gewählt ist; wieder wählbar, wenn sie entfernt ist", async () => {
    connector.setCurrentGroup("g")
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], "g")
    await render(createElement(ItemComposer, {
      contentTypes: types, initialContentType: "task", mapper: mapComposerSubmission,
      initialData: { title: "T", group: "g" }, onDone: () => {}, onCancel: () => {},
    }))
    expect(host.querySelector('button[aria-label^="Space wählen"]')).not.toBeNull()
    const options = await type("", '[data-item-relation-field="blocks"] input')
    expect(options).toEqual(["Im Garten"])
    await act(async () => host.querySelector<HTMLInputElement>('[data-item-relation-field="blocks"] input')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    await settle()
    expect(host.querySelector('button[aria-label^="Space wählen"]')).toBeNull()
    expect(host.querySelector('[data-slot="composer-space"]')?.textContent).toContain(ITEM_BINDINGS_REASON)
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Im Garten entfernen"]')!.click())
    await settle()
    expect(host.querySelector('button[aria-label^="Space wählen"]')).not.toBeNull()
  })
})

describe("Vorschläge folgen dem Formular-Space (Regel 3)", () => {
  it("Personen: Mitglieder des Formular-Space, nicht des geöffneten", async () => {
    connector.setCurrentGroup("g")
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], "g")
    await render(createElement(ItemComposer, {
      contentTypes: types, initialContentType: "task", mapper: mapComposerSubmission,
      initialData: { title: "T", group: "h" }, onDone: () => {}, onCancel: () => {},
      // Der Host liefert die Mitglieder des GEÖFFNETEN Space (g: nur ich).
      composerProps: { peopleOptions: [{ id: ME, name: "Ich" }], peopleQuickSuggestions: [{ id: ME, name: "Ich" }] },
    }))
    expect(host.textContent).toContain("Hofi")
  })

  it("Tags: Vokabular des Formular-Space", async () => {
    connector.setCurrentGroup("g")
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], "g")
    await render(createElement(ItemComposer, {
      contentTypes: types, initialContentType: "task", mapper: mapComposerSubmission,
      initialData: { title: "T", group: "h", tags: [] }, onDone: () => {}, onCancel: () => {},
      composerProps: { tagSuggestions: ["beet"], tagQuickSuggestions: ["beet"] },
    }))
    expect(host.textContent).toContain("pflaster")
    expect(host.textContent).not.toContain("beet")
  })
})

describe("Nach dem Anlegen in einem anderen Space (Regel 6)", () => {
  it("öffnet das Detail nur, wenn der geöffnete Space das Item zeigt", async () => {
    const { createdItemIsVisible } = await import("../src/components/host/create-host")
    connector.setCurrentGroup("g")
    const inH = await connector.createItem({ type: "task", createdBy: ME, data: {} }, { group: "h" })
    const inG = await connector.createItem({ type: "task", createdBy: ME, data: {} })
    expect(createdItemIsVisible(connector, inG)).toBe(true)
    expect(createdItemIsVisible(connector, inH)).toBe(false)
    connector.setCurrentGroup(null)
    expect(createdItemIsVisible(connector, inH)).toBe(true)
    expect(createdItemIsVisible(null, inH)).toBe(true)
    // Ohne ItemGroupCapable (Supabase) zählt der Space des Formulars (Codex R1/7).
    connector.setCurrentGroup("g")
    const ohneZuordnung = new Proxy(connector, { has: (t, k) => (k === "getItemGroupId" || k === "moveItemToGroup" ? false : Reflect.has(t, k)) }) as never
    expect(createdItemIsVisible(ohneZuordnung, inH, "h")).toBe(false)
    expect(createdItemIsVisible(ohneZuordnung, inG, "g")).toBe(true)
  })
})

describe("Codex R1/2+3: Erneut nach teilweisem Anlegen in einem anderen Space", () => {
  it("der Space steht nach dem Anlegen fest, „Erneut“ schreibt nur die Aussage — im Space des Items", async () => {
    const { pickContentTypes } = await import("../src/components/composer/content-types")
    // Ohne Fixture-Modus: nur dann schreibt der Connector verifizierte Aussagen.
    connector = makeConnector(undefined, undefined, false)
    await connector.init()
    connector.setCurrentGroup("g")
    const onDone = vi.fn()
    await render(createElement(ItemComposer, {
      contentTypes: withGroupOptions(pickContentTypes("event"), [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], "g"),
      initialContentType: "event", mapper: mapComposerSubmission, initialData: { group: "h" }, onDone, onCancel: () => {},
    }))
    const button = (text: string) => [...document.body.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === text)
    const title = host.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Hoffest")
      title.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => button("Hofi")!.click())
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("[data-qualifier-toggle]")].find((b) => b.getAttribute("aria-label")?.startsWith("Hofi"))!.click())
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
    // Schon angelegt: kein Umzug mehr über die Kopfauswahl (Regel 5/6).
    expect(host.querySelector('button[aria-label^="Space wählen"]')).toBeNull()
    expect(host.querySelector('[data-slot="composer-space"]')?.textContent).toContain("Hof")
    // Mit geändertem Titel: klare Meldung statt eines scheiternden Updates im geöffneten Space (R2/1).
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Hoffest 2")
      title.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => button("Erneut")!.click())
    await settle()
    expect(host.querySelector('[data-slot="save-error"]')?.textContent).toContain("anderen Space angelegt")
    expect(await connector.getItems({ type: "relation", group: "h" })).toHaveLength(0)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, "Hoffest")
      title.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const update = vi.spyOn(connector, "updateItem")
    await act(async () => button("Erneut")!.click())
    await settle()
    expect(update).not.toHaveBeenCalled()
    const events = await connector.getItems({ type: "event", group: "h" })
    expect(events).toHaveLength(1)
    const records = await connector.getItems({ type: "relation", group: "h" })
    expect(records).toHaveLength(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})

describe("Codex R1/5: Bearbeiten ohne bekannten Space verschiebt nicht", () => {
  it("übernimmt keine Erstellen-Vorgabe; Speichern lässt das Item, wo es ist", async () => {
    const loose = item("t-lose", "task", { title: "Lose", status: "open" })
    connector = makeConnector([IN_G, IN_H, loose], { g: ["t-g"], h: ["t-h"] })
    await connector.init()
    connector.setCurrentGroup(null)
    const move = vi.spyOn(connector, "moveItemToGroup")
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], "g")
    await render(createElement(ItemDetailView, {
      itemId: "t-lose", mode: "edit", renderRead: () => null, contentTypes: types, mapper: mapComposerSubmission,
      editInitialData: (i: Item) => ({ title: String(i.data.title), status: "open" }), onClose: () => {},
    }))
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Speichern")!.click())
    await settle()
    expect(move).not.toHaveBeenCalled()
    expect(connector.getItemGroupId("t-lose")).toBeNull()
  })
})

describe("Codex R1/6: Pflicht auch bei nur einem möglichen Space", () => {
  it("withGroupOptions: genau ein möglicher Space ist vorausgewählt (Regel 1, Anton 27.09.)", async () => {
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }], undefined, null)
    expect(types[0]!.groupOptions?.map((o) => o.id)).toEqual(["g"])
    expect(types[0]!.defaultGroup).toBe("g")
    await render(createElement(ItemComposer, {
      contentTypes: types, initialContentType: "task", mapper: mapComposerSubmission,
      initialData: { title: "T" }, onDone: () => {}, onCancel: () => {},
    }))
    expect(host.querySelector('button[aria-label^="Space wählen"]')).toBeNull()
    expect(host.querySelector('[data-slot="composer-space"]')?.textContent).toContain("Garten")
    expect([...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Erstellen")?.disabled).toBe(false)
  })

  it("beim Bearbeiten setzt auch ein einziger möglicher Space nichts (Regel 1: der Space des Items)", async () => {
    const loose = item("t-y", "task", { title: "Y", status: "open" })
    connector = makeConnector([IN_G, IN_H, loose], { g: ["t-g"], h: ["t-h"] })
    await connector.init()
    connector.setCurrentGroup(null)
    const move = vi.spyOn(connector, "moveItemToGroup")
    const onDone = vi.fn()
    await render(createElement(ItemComposer, {
      contentTypes: [{ ...contentTypeFromRegister("task"), groupOptions: [{ id: "g", name: "Garten" }] }],
      initialContentType: "task", existingItem: loose,
      mapper: mapComposerSubmission, initialData: { title: "Y", status: "open" }, onDone, onCancel: () => {},
    }))
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.trim() === "Speichern")!.click())
    await settle()
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(move).not.toHaveBeenCalled()
    expect(connector.getItemGroupId("t-y")).toBeNull()
  })

  it("Bearbeiten ohne bekannten Space bei Beziehungen: „Space unbekannt“, nie eine erfundene Gruppe (R2/3)", async () => {
    await render(createElement(ItemComposer, {
      contentTypes: [{ ...contentTypeFromRegister("task"), groupOptions: [{ id: "g", name: "Garten" }], groupFixedReason: "fest" }],
      initialContentType: "task", existingItem: item("t-x", "task", { title: "X" }),
      mapper: mapComposerSubmission, initialData: { title: "X" }, onDone: () => {}, onCancel: () => {},
    }))
    const head = host.querySelector('[data-slot="composer-space"]')?.textContent ?? ""
    expect(head).toContain("Space unbekannt")
    expect(head).not.toContain("Garten")
  })

  it("ohne jeden Space (keine Gruppen, kein persönlicher) keine Space-Konfiguration", () => {
    const types = [contentTypeFromRegister("task")]
    expect(withGroupOptions(types, [], undefined, null)).toBe(types)
  })
})

describe("#538: Space-Pflicht auf jedem Anlege-Pfad, auch liveUpdate", () => {
  async function typeTitle(text: string) {
    const title = host.querySelector<HTMLInputElement>('input[type="text"], input:not([type])')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(title, text)
      title.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
    await settle()
  }

  it("liveUpdate ohne gewählten Space bei mehreren möglichen: kein createItem, sichtbarer Hinweis", async () => {
    connector.setCurrentGroup("g")
    const create = vi.spyOn(connector, "createItem")
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], undefined, null)
    expect(types[0]!.defaultGroup).toBeUndefined()
    await render(createElement(ItemComposer, {
      contentTypes: types, initialContentType: "task", mapper: mapComposerSubmission,
      onDone: () => {}, onCancel: () => {}, composerProps: { liveUpdate: true },
    }))
    await typeTitle("Ohne Space")
    expect(create).not.toHaveBeenCalled()
    expect(host.querySelector('button[aria-label^="Space wählen"]')?.getAttribute("aria-invalid")).toBe("true")
    expect(host.querySelector("[data-space-required]")?.textContent).toContain("Space")
  })

  it("liveUpdate mit genau einem möglichen Space: die Vorauswahl greift, angelegt wird dort", async () => {
    connector.setCurrentGroup(null)
    const create = vi.spyOn(connector, "createItem")
    const types = withGroupOptions([contentTypeFromRegister("task")], [{ id: "h", name: "Hof" }], undefined, null)
    await render(createElement(ItemComposer, {
      contentTypes: types, initialContentType: "task", mapper: mapComposerSubmission,
      onDone: () => {}, onCancel: () => {}, composerProps: { liveUpdate: true },
    }))
    await typeTitle("Mit Space")
    expect(create).toHaveBeenCalled()
    for (const call of create.mock.calls) expect(call[1]).toEqual({ group: "h" })
    expect(host.querySelector("[data-space-required]")).toBeNull()
  })

  it("Bearbeiten ohne bekannten Space bleibt mit liveUpdate speicherbar (Regel 8)", async () => {
    const loose = item("t-z", "task", { title: "Z", status: "open" })
    connector = makeConnector([IN_G, IN_H, loose], { g: ["t-g"], h: ["t-h"] })
    await connector.init()
    connector.setCurrentGroup(null)
    const update = vi.spyOn(connector, "updateItem")
    await render(createElement(ItemComposer, {
      contentTypes: [{ ...contentTypeFromRegister("task"), groupOptions: [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }] }],
      initialContentType: "task", existingItem: loose, mapper: mapComposerSubmission,
      initialData: { title: "Z", status: "open" }, onDone: () => {}, onCancel: () => {}, composerProps: { liveUpdate: true },
    }))
    await typeTitle("Z2")
    expect(update).toHaveBeenCalled()
  })
})

describe("#538 Codex-Runde: Übergänge", () => {
  it("ein ausstehender liveUpdate prüft beim Auslösen den aktuellen Stand (Konfiguration während der Frist)", async () => {
    const { ContentComposer } = await import("../src/components/composer/content-composer")
    const submitted: Array<Record<string, unknown>> = []
    let api: { patchData: (p: Record<string, unknown>) => void } | null = null
    const apiRef = { get current() { return api }, set current(v) { api = v } }
    const base = contentTypeFromRegister("task")
    const props = (types: unknown[]) => ({
      contentTypes: types, initialContentType: "task", apiRef, liveUpdate: true,
      onSubmit: (d: { data: Record<string, unknown> }) => { submitted.push(d.data) },
    }) as never
    await act(async () => { root.render(createElement(ContentComposer, props([base]))) })
    submitted.length = 0
    await act(async () => api!.patchData({ title: "Neu" }))
    // Innerhalb der 300 ms kommen Space-Optionen ohne Vorauswahl dazu.
    await act(async () => { root.render(createElement(ContentComposer, props([{ ...base, groupOptions: [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }] }]))) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
    expect(submitted.filter((d) => d.title === "Neu")).toEqual([])
  })

  it("ohne GroupScopeCapable in der Übersicht: kein Anlegen ohne bestimmbaren Space, mit Grund", async () => {
    const { GROUP_UNAVAILABLE_NO_SCOPE } = await import("../src/components/composer/composer-mapping")
    const types = withCreateGroup(withGroupOptions([contentTypeFromRegister("task")], [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], undefined, null), false, undefined)
    expect(types[0]!.groupUnavailableReason).toBe(GROUP_UNAVAILABLE_NO_SCOPE)
    connector.setCurrentGroup(null)
    const create = vi.spyOn(connector, "createItem")
    await render(createElement(ItemComposer, {
      contentTypes: types, initialContentType: "task", mapper: mapComposerSubmission,
      initialData: { title: "T" }, onDone: () => {}, onCancel: () => {}, composerProps: { liveUpdate: true },
    }), withoutScope(connector))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
    expect(create).not.toHaveBeenCalled()
    expect(host.querySelector("[data-space-required]")?.textContent).toContain(GROUP_UNAVAILABLE_NO_SCOPE)
  })
})

describe("#538 Codex-Runde 2: Spaces noch nicht geladen", () => {
  it("withSpacesPending sperrt das Anlegen, solange die Spaces laden und keine Option bekannt ist", async () => {
    const { withSpacesPending, GROUPS_LOADING } = await import("../src/components/composer/composer-mapping")
    const base = [contentTypeFromRegister("task")]
    expect(withSpacesPending(base, false)).toBe(base)
    const pending = withSpacesPending(base, true)
    expect(pending[0]!.groupUnavailableReason).toBe(GROUPS_LOADING)
    // Sind Optionen schon bekannt, gilt die normale Pflicht.
    const withOptions = withGroupOptions(base, [{ id: "g", name: "Garten" }, { id: "h", name: "Hof" }], undefined, null)
    expect(withSpacesPending(withOptions, true)).toBe(withOptions)
    const create = vi.spyOn(connector, "createItem")
    await render(createElement(ItemComposer, {
      contentTypes: pending, initialContentType: "task", mapper: mapComposerSubmission,
      initialData: { title: "T" }, onDone: () => {}, onCancel: () => {}, composerProps: { liveUpdate: true },
    }))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)) })
    expect(create).not.toHaveBeenCalled()
    expect(host.querySelector("[data-space-required]")?.textContent).toContain(GROUPS_LOADING)
  })
})
